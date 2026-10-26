import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table, Typography, Input, Button, Tabs, message, Dropdown, Modal, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined, CheckOutlined, FieldTimeOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { isRecentDate } from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
import { computeBuyPoints } from '@/utils/buyPointWorker';
import type { BuyPointResult } from '@/utils/buyPointCompute';
import { exportBuyPlan, exportBuySellReport } from '@/utils/buySellReportExport';
import { BuyPointActionGroup } from '@/components/BuyPointActionGroup';

const { Link } = Typography;
const { TabPane } = Tabs;

/** 固定 tab：全部指数列表、自选（不可删除/重命名） */
const ALL_TAB_KEY = 'all';
const SELECTED_TAB_KEY = 'selected';
const SELECTED_TAB_LABEL = '自选';

/** 自定义分组：key 唯一且不变，label 可编辑 */
interface CustomTab {
  key: string;
  label: string;
}

const CUSTOM_TABS_STORAGE_KEY = 'HkIndexPage-customTabs';
const CUSTOM_INDICES_STORAGE_KEY = 'HkIndexPage-customIndices';
const SELECTED_INDICES_STORAGE_KEY = 'HkIndexPage-selectedIndices';

interface IndexData {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌额: number;
  涨跌幅: number;
  昨收: number;
  今开: number;
  最高: number;
  最低: number;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  /** 月 RSI6 百分位策略建仓日期（逗号分隔，取每笔配对的第一次买入） */
  __月RSI6百分位__?: string;
  /** 周 RSI6 百分位策略建仓日期（逗号分隔，取每笔配对的第一次买入） */
  __周RSI6百分位__?: string;
}

const numberSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) =>
  Number(a[key] ?? 0) - Number(b[key] ?? 0);

const stringSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) =>
  String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'zh-CN');

/** 近 100 天买点的高亮样式（橙色加粗描边，与其他买点列保持一致） */
const recentBuyTagStyle: React.CSSProperties = {
  backgroundColor: '#fff7e6',
  color: '#d46b08',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 'bold',
  border: '2px solid #fa8c16',
};

/**
 * 构造买点日期标签渲染器：逗号分隔日期 → 标签组（最新日期在前）；
 * 近 100 天的买点用橙色高亮，其余用该列传入的常规配色
 */
const renderBuyPointTags = (normalStyle: React.CSSProperties) => (value: string) => {
  if (!value) return <span style={{ color: '#999' }}>-</span>;
  const dates = value.split(',').map(d => d.trim()).filter(Boolean).reverse();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {dates.map((date, index) => (
        <span
          key={index}
          title={isRecentDate(date) ? '近期买点（100天内）' : undefined}
          style={isRecentDate(date) ? recentBuyTagStyle : normalStyle}
        >
          {date}
        </span>
      ))}
    </div>
  );
};

const HkIndex: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_KEY);
  const [selectedIndices, setSelectedIndices] = useState<IndexData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<IndexData[]>([]);

  // 自定义分组
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customIndicesMap, setCustomIndicesMap] = useState<Record<string, IndexData[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const renameCancelRef = useRef(false);
  const selectedIndicesRef = useRef<IndexData[]>([]);

  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: IndexData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  // 计算推荐买点（定量 + 月&季百分位 + 月RSI6百分位 + 周RSI6百分位）
  const fetchIndexDetailAndCalculate = async (symbol: string): Promise<BuyPointResult> => {
    const response = await apiClient.get('/api/public/stock_hk_index_daily_sina', {
      params: { symbol },
    });
    const stockHistoryList = (response?.data || [])
      .map((item: Record<string, unknown>) => ({
        日期: item.date,
        收盘: Number(item.close),
      }))
      .filter((item: { 收盘: number }) => Number.isFinite(item.收盘));

    // 接口异常（空数据 / 无有效收盘价）需抛出，由批量编排统一重试并汇总提示
    if (stockHistoryList.length === 0) throw new Error('接口返回空数据');

    return computeBuyPoints({ type: 'index', rawData: stockHistoryList });
  };

  const handleCalculateRecommendation = async () => {
    // 仅收集结果，全部计算完成后再一次性更新表格与缓存
    const resultMap = new Map<string, { quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }>();
    await runRecommendationBatchCalculation({
      targets: selectedRows,
      getKey: item => String(item['代码']),
      getName: item => item['名称'] || String(item['代码']),
      emptyWarn: '请选择指数',
      fetchBuyPoints: item => fetchIndexDetailAndCalculate(String(item['代码'])),
      onItemDone: (item, result) => {
        resultMap.set(String(item['代码']), result);
      },
    });
    if (resultMap.size === 0) return;

    // 将买点结果写回当前活动分组（自选或自定义分组）
    const applyResults = (list: IndexData[]): IndexData[] =>
      list.map(item => {
        const result = resultMap.get(String(item['代码']));
        return result
          ? {
            ...item,
            __推荐买点定量__: result.quantitative || item.__推荐买点定量__,
            __推荐买点百分位__: result.percentile || item.__推荐买点百分位__,
            __月RSI6百分位__: result.monthlyPercentile || item.__月RSI6百分位__,
            __周RSI6百分位__: result.weeklyPercentile || item.__周RSI6百分位__,
          }
          : item;
      });

    if (activeTab === SELECTED_TAB_KEY) {
      const latest = applyResults(selectedIndicesRef.current);
      setSelectedIndices(latest);
      saveSelectedIndices(latest);
      return;
    }

    // 自定义分组
    const isCustomTab = customTabs.some(t => t.key === activeTab);
    if (isCustomTab) {
      saveGroupIndices(activeTab, prev => applyResults(prev));
    }
  };

  /** 导出「买入&卖出报告」：仅导出已完成买卖配对的 ★5 信号 */
  const handleExportBuySellReport = () =>
    exportBuySellReport<IndexData>({
      targets: selectedRows,
      getCode: item => String(item['代码']),
      getName: item => item['名称'] || String(item['代码']),
      getKey: item => String(item['代码']),
      fetchPoints: async item => (await fetchIndexDetailAndCalculate(String(item['代码']))).mqBuyPoints,
      emptyWarn: '请选择指数',
      itemLabel: '指数',
      filePrefix: '港股指数',
    });

  /** 导出「买入计划」：仅导出尚未卖出的 ★5 买入信号 */
  const handleExportBuyPlan = () =>
    exportBuyPlan<IndexData>({
      targets: selectedRows,
      getCode: item => String(item['代码']),
      getName: item => item['名称'] || String(item['代码']),
      getKey: item => String(item['代码']),
      fetchPoints: async item => (await fetchIndexDetailAndCalculate(String(item['代码']))).mqBuyPoints,
      emptyWarn: '请选择指数',
      itemLabel: '指数',
      filePrefix: '港股指数',
    });

  const columns = useMemo((): any[] => [ // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 70,
      sorter: numberSorter('序号'),
    },
    {
      title: '指数代码',
      dataIndex: '代码',
      key: '代码',
      width: 90,
      sorter: stringSorter('代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: IndexData) =>
        String(record['代码'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '指数名称',
      dataIndex: '名称',
      key: '名称',
      width: 160,
      sorter: stringSorter('名称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数名称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: IndexData) =>
        String(record['名称'] || '').toLowerCase().includes(String(value).toLowerCase()),
      render: (name: string, record: IndexData) => (
        <Link
          onClick={() => window.open(`/stock/hk/index/detail?code=${record['代码']}&name=${encodeURIComponent(record['名称'] || '')}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '最新价',
      dataIndex: '最新价',
      key: '最新价',
      width: 100,
      sorter: numberSorter('最新价'),
    },
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 100,
      sorter: numberSorter('涨跌额'),
    },
    {
      title: '涨跌幅(%)',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 110,
      sorter: numberSorter('涨跌幅'),
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
          {value}%
        </span>
      ),
    },
    {
      title: '推荐买点（百分位）',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 120,
      sorter: stringSorter('__推荐买点百分位__'),
      render: renderBuyPointTags({
        backgroundColor: '#f6ffed',
        color: '#52c41a',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #b7eb8f',
      }),
    },
    {
      title: '推荐买点（定量）',
      dataIndex: '__推荐买点定量__',
      key: '__推荐买点定量__',
      width: 120,
      sorter: stringSorter('__推荐买点定量__'),
      render: renderBuyPointTags({
        backgroundColor: '#e6f7ff',
        color: '#1890ff',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #91caff',
      }),
    },
    {
      title: '月RSI6百分位策略',
      dataIndex: '__月RSI6百分位__',
      key: '__月RSI6百分位__',
      width: 120,
      sorter: stringSorter('__月RSI6百分位__'),
      render: renderBuyPointTags({
        backgroundColor: '#f9f0ff',
        color: '#722ed1',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #d3adf7',
      }),
    },
    {
      title: '周RSI6百分位策略',
      dataIndex: '__周RSI6百分位__',
      key: '__周RSI6百分位__',
      width: 120,
      sorter: stringSorter('__周RSI6百分位__'),
      render: renderBuyPointTags({
        backgroundColor: '#e6fffb',
        color: '#08979c',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #87e8de',
      }),
    },
    {
      title: '昨收',
      dataIndex: '昨收',
      key: '昨收',
      width: 100,
      sorter: numberSorter('昨收'),
    },
    {
      title: '今开',
      dataIndex: '今开',
      key: '今开',
      width: 100,
      sorter: numberSorter('今开'),
    },
    {
      title: '最高',
      dataIndex: '最高',
      key: '最高',
      width: 100,
      sorter: numberSorter('最高'),
    },
    {
      title: '最低',
      dataIndex: '最低',
      key: '最低',
      width: 100,
      sorter: numberSorter('最低'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, record: IndexData) => {
        // 自选 / 自定义分组内：移出当前分组 + 加入到其他分组 + 置顶/置底
        if (activeTab !== ALL_TAB_KEY) {
          const groupKey = activeTab;
          const crossMenuItems = buildCrossGroupMenuItems(record, groupKey);
          const hasTargets = crossMenuItems.some(item => !!item && 'key' in item);
          return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                type="default"
                size="small"
                onClick={() => removeFromGroup(groupKey, record)}
              >
                {groupKey === SELECTED_TAB_KEY ? '取消自选' : '移出分组'}
              </Button>
              <Dropdown
                trigger={['click']}
                disabled={!hasTargets}
                menu={{ items: crossMenuItems }}
              >
                <Button size="small" title={hasTargets ? '加入到其他分组（不影响当前分组）' : '请先新建分组'}>
                  加入到
                </Button>
              </Dropdown>
              <Button type="link" size="small" onClick={() => moveInGroup(groupKey, record, 'top')}>
                置顶
              </Button>
              <Button type="link" size="small" onClick={() => moveInGroup(groupKey, record, 'bottom')}>
                置底
              </Button>
            </div>
          );
        }

        // 全部指数列表：添加到自选 + 加入分组
        const isSelected = isIndexSelected(record['代码']);
        const joinGroupItems: MenuProps['items'] = [
          {
            key: SELECTED_TAB_KEY,
            label: (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                <span>{SELECTED_TAB_LABEL}</span>
                {isSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
              </span>
            ),
          },
          ...customTabs.map(tab => {
            const inGroup = isInGroup(tab.key, record['代码']);
            return {
              key: tab.key,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                  <span>{tab.label}</span>
                  {inGroup && <CheckOutlined style={{ color: '#52c41a' }} />}
                </span>
              ),
            };
          }),
        ];
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={isSelected ? 'default' : 'primary'}
              size="small"
              onClick={() => toggleGroupMembership(record, SELECTED_TAB_KEY)}
            >
              {isSelected ? '取消自选' : '添加到自选'}
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: joinGroupItems,
                onClick: ({ key }) => toggleGroupMembership(record, String(key)),
              }}
            >
              <Button size="small" title={customTabs.length === 0 ? '可先新建分组' : undefined}>
                加入分组
              </Button>
            </Dropdown>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data, selectedIndices, activeTab, customTabs, customIndicesMap, renaming]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_hk_index_spot_sina');
      console.log('港股指数列表 -> response', response);
      const newData: IndexData[] = (response?.data || []).map((item: Record<string, unknown>, index: number) => ({
        ...(item as unknown as IndexData),
        序号: index + 1,
      }));
      setData(newData);

      // 用新数据刷新自选与所有自定义分组（保留买点字段）
      const mergeFreshIndices = (oldList: IndexData[], freshList: IndexData[]): IndexData[] =>
        oldList.map(oldItem => {
          const matched = freshList.find(f => f['代码'] === oldItem['代码']);
          if (!matched) return oldItem;
          return {
            ...matched,
            __推荐买点定量__: oldItem.__推荐买点定量__,
            __推荐买点百分位__: oldItem.__推荐买点百分位__,
            __月RSI6百分位__: oldItem.__月RSI6百分位__,
            __周RSI6百分位__: oldItem.__周RSI6百分位__,
          };
        });

      if (selectedIndices.length > 0) {
        const updated = mergeFreshIndices(selectedIndices, newData);
        setSelectedIndices(updated);
        saveSelectedIndices(updated);
      }

      const customKeys = Object.keys(customIndicesMap);
      if (customKeys.length > 0) {
        setCustomIndicesMap(prev => {
          const next: Record<string, IndexData[]> = { ...prev };
          customKeys.forEach(key => {
            next[key] = mergeFreshIndices(prev[key] || [], newData);
          });
          persistCustomIndices(next);
          return next;
        });
      }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelectedIndices();
    loadCustomTabs();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从 localStorage 加载自选指数
  const loadSelectedIndices = () => {
    try {
      const saved = localStorage.getItem(SELECTED_INDICES_STORAGE_KEY);
      if (saved) {
        setSelectedIndices(JSON.parse(saved));
      }
    } catch (error) {
      console.log('加载自选指数失败:', error);
    }
  };

  // 保存自选指数到 localStorage
  const saveSelectedIndices = (indices: IndexData[]) => {
    try {
      localStorage.setItem(SELECTED_INDICES_STORAGE_KEY, JSON.stringify(indices));
    } catch (error) {
      console.log('保存自选指数失败:', error);
    }
  };

  // 加载自定义分组
  const loadCustomTabs = () => {
    try {
      const savedTabs = localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
      const savedMap = localStorage.getItem(CUSTOM_INDICES_STORAGE_KEY);
      const validTabs: CustomTab[] = savedTabs ? JSON.parse(savedTabs) : [];
      const indicesMap: Record<string, IndexData[]> = savedMap ? JSON.parse(savedMap) : {};
      const validKeys = new Set(validTabs.map(t => t.key));
      const cleanedMap: Record<string, IndexData[]> = {};
      Object.keys(indicesMap).forEach(key => {
        if (validKeys.has(key) && Array.isArray(indicesMap[key])) {
          cleanedMap[key] = indicesMap[key];
        }
      });
      setCustomTabs(validTabs);
      setCustomIndicesMap(cleanedMap);
    } catch (error) {
      console.log('加载自定义分组失败:', error);
    }
  };

  const persistCustomTabs = (tabs: CustomTab[]) => {
    localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(tabs));
  };

  const persistCustomIndices = (map: Record<string, IndexData[]>) => {
    localStorage.setItem(CUSTOM_INDICES_STORAGE_KEY, JSON.stringify(map));
  };

  // 按分组 key 读取指数（selected 为固定自选分组）
  // 注意：渲染必须走 state，不能用 ref——ref 仅在 setState 后的 effect 里同步，
  // 若用它作为表格 dataSource，则 setState 触发的重渲染读到的仍是旧数组，导致算完买点后表格不刷新
  const getGroupIndices = (groupKey: string): IndexData[] =>
    groupKey === SELECTED_TAB_KEY ? selectedIndices : (customIndicesMap[groupKey] || []);

  // 按分组 key 写入指数并持久化（支持函数式更新）
  const saveGroupIndices = (
    groupKey: string,
    updater: IndexData[] | ((prev: IndexData[]) => IndexData[]),
  ) => {
    if (groupKey === SELECTED_TAB_KEY) {
      const next = typeof updater === 'function' ? updater(selectedIndicesRef.current) : updater;
      setSelectedIndices(next);
      saveSelectedIndices(next);
      return;
    }
    setCustomIndicesMap(prev => {
      const nextList = typeof updater === 'function' ? updater(prev[groupKey] || []) : updater;
      const next = { ...prev, [groupKey]: nextList };
      persistCustomIndices(next);
      return next;
    });
  };

  const getGroupLabel = (groupKey: string): string =>
    groupKey === SELECTED_TAB_KEY
      ? SELECTED_TAB_LABEL
      : customTabs.find(t => t.key === groupKey)?.label || '分组';

  // 从指定分组移除
  const removeFromGroup = (groupKey: string, index: IndexData) => {
    saveGroupIndices(groupKey, list => list.filter(s => s['代码'] !== index['代码']));
    message.info(`已从「${getGroupLabel(groupKey)}」移除 ${index['名称'] || index['代码']}`);
  };

  // 切换某指数在目标分组的归属状态——已在则移除，不在则加入
  const toggleGroupMembership = (record: IndexData, targetKey: string) => {
    const list = getGroupIndices(targetKey);
    if (list.some(s => s['代码'] === record['代码'])) {
      saveGroupIndices(targetKey, list.filter(s => s['代码'] !== record['代码']));
    } else {
      saveGroupIndices(targetKey, [...list, record]);
    }
  };

  // 判断指数是否已在某分组
  const isInGroup = (groupKey: string, code: string) =>
    getGroupIndices(groupKey).some(s => s['代码'] === code);

  // 分组内置顶/置底
  const moveInGroup = (groupKey: string, index: IndexData, position: 'top' | 'bottom') => {
    const list = getGroupIndices(groupKey);
    const rest = list.filter(s => s['代码'] !== index['代码']);
    saveGroupIndices(groupKey, position === 'top' ? [index, ...rest] : [...rest, index]);
  };

  // 新建分组
  const handleCreateTab = () => {
    const name = newTabName.trim();
    if (!name) {
      message.warning('请输入分组名称');
      return;
    }
    if (customTabs.some(t => t.label === name) || name === SELECTED_TAB_LABEL) {
      message.error('分组名称已存在');
      return;
    }
    const key = `custom-${Date.now()}`;
    const nextTabs = [...customTabs, { key, label: name }];
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    const nextMap = { ...customIndicesMap, [key]: [] };
    setCustomIndicesMap(nextMap);
    persistCustomIndices(nextMap);
    setActiveTab(key);
    setCreateOpen(false);
    setNewTabName('');
    message.success(`分组「${name}」已创建`);
  };

  // 删除分组（含分组内指数）
  const handleDeleteTab = (tab: CustomTab) => {
    const nextTabs = customTabs.filter(t => t.key !== tab.key);
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    setCustomIndicesMap(prev => {
      const next = { ...prev };
      delete next[tab.key];
      persistCustomIndices(next);
      return next;
    });
    if (activeTab === tab.key) {
      setActiveTab(SELECTED_TAB_KEY);
    }
    setRenaming(null);
    message.success(`分组「${tab.label}」已删除`);
  };

  const startRename = (tab: CustomTab) => {
    renameCancelRef.current = false;
    setRenaming({ key: tab.key, value: tab.label });
  };

  // 提交重命名（空名称/Esc 取消）
  const commitRename = () => {
    if (!renaming || renameCancelRef.current) return;
    const value = renaming.value.trim();
    setRenaming(null);
    if (!value) {
      message.warning('分组名称不能为空，已还原');
      return;
    }
    const target = customTabs.find(t => t.key === renaming.key);
    if (!target || target.label === value) return;
    if (customTabs.some(t => t.key !== renaming.key && t.label === value) || value === SELECTED_TAB_LABEL) {
      message.error('分组名称已存在，已还原');
      return;
    }
    const nextTabs = customTabs.map(t => (t.key === renaming.key ? { ...t, label: value } : t));
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
  };

  // 切换 tab 时退出重命名并清空批量选择
  const handleTabChange = (key: string) => {
    setRenaming(null);
    setActiveTab(key);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  // 构建跨分组「加入到」菜单项（排除当前分组）
  const buildCrossGroupMenuItems = (record: IndexData, currentGroupKey: string): NonNullable<MenuProps['items']> => {
    const items: NonNullable<MenuProps['items']> = [];
    // 自选
    if (currentGroupKey !== SELECTED_TAB_KEY) {
      const inSelected = isInGroup(SELECTED_TAB_KEY, record['代码']);
      items.push({
        key: SELECTED_TAB_KEY,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
            <span>{SELECTED_TAB_LABEL}</span>
            {inSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
          </span>
        ),
        onClick: () => toggleGroupMembership(record, SELECTED_TAB_KEY),
      });
    }
    // 其他自定义分组
    customTabs.forEach(tab => {
      if (tab.key === currentGroupKey) return;
      const inGroup = isInGroup(tab.key, record['代码']);
      items.push({
        key: tab.key,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
            <span>{tab.label}</span>
            {inGroup && <CheckOutlined style={{ color: '#52c41a' }} />}
          </span>
        ),
        onClick: () => toggleGroupMembership(record, tab.key),
      });
    });
    return items;
  };

  // 渲染自定义分组的 tab 标题：点铅笔图标重命名（单击即编辑），× 删除
  const renderCustomTabLabel = (tab: CustomTab) => {
    if (renaming?.key === tab.key) {
      return (
        <Input
          size="small"
          autoFocus
          value={renaming.value}
          maxLength={12}
          style={{ width: 130, margin: '0 4px' }}
          onChange={e => setRenaming({ key: tab.key, value: e.target.value })}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onFocus={e => e.target.select()}
          onPressEnter={commitRename}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              renameCancelRef.current = true;
              setRenaming(null);
            }
          }}
        />
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <span>{tab.label}</span>
        <EditOutlined
          className="outtrading-tab-action outtrading-tab-edit"
          title="点击重命名"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            startRename(tab);
          }}
        />
        <Popconfirm
          title={`删除分组「${tab.label}」？`}
          description="分组内的指数列表将一并删除"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeleteTab(tab)}
        >
          <CloseOutlined
            className="outtrading-tab-action outtrading-tab-close"
            title="删除分组"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          />
        </Popconfirm>
      </span>
    );
  };

  // 检查指数是否已在自选中
  const isIndexSelected = (code: string) => selectedIndices.some(i => i['代码'] === code);

  // 渲染分组表格（自选和自定义分组通用）
  const renderGroupTable = (groupKey: string) => {
    const list = getGroupIndices(groupKey);
    return (
      <>
        <BuyPointActionGroup
          onCalculate={handleCalculateRecommendation}
          onExportReport={handleExportBuySellReport}
          onExportPlan={handleExportBuyPlan}
          itemLabel="指数"
        />
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: onSelectChange,
          }}
          columns={columns}
          dataSource={list}
          rowKey="代码"
          scroll={{ x: 2600, y: 'calc(100vh - 350px)' }}
          pagination={false}
        />
      </>
    );
  };

  return (
    <div style={{ padding: '0 24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
      {/* 非实时数据提示：接口稳定性原因，非交易时间获取的为收盘/缓存行情 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: 'linear-gradient(90deg, rgba(24,144,255,0.09) 0%, rgba(24,144,255,0.02) 100%)',
          border: '1px solid rgba(24,144,255,0.22)',
          borderLeft: '3px solid #1890ff',
          boxShadow: '0 1px 4px rgba(24,144,255,0.06)',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(24,144,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FieldTimeOutlined style={{ color: '#1890ff', fontSize: 17 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1d39c4', lineHeight: 1.4, marginBottom: 2 }}>
            非实时数据提示
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: '#46536b' }}>
            由于行情接口稳定性原因，当前获取的为
            <span style={{ color: '#fa541c', fontWeight: 600 }}>非实时数据</span>
            （最近一次收盘 / 缓存行情），价格与指标可能存在延迟，仅供参考。
          </div>
        </div>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        tabBarExtraContent={{
          right: (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setNewTabName('');
                setCreateOpen(true);
              }}
            >
              新建分组
            </Button>
          ),
        }}
      >
        <TabPane tab="全部" key={ALL_TAB_KEY}>
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Button type="primary" onClick={fetchData} loading={loading}>
              搜索
            </Button>
          </div>
          <Table
            columns={columns?.filter(c => c.key !== '__推荐买点定量__' && c.key !== '__推荐买点百分位__' && c.key !== '__月RSI6百分位__' && c.key !== '__周RSI6百分位__') || []}
            dataSource={data}
            loading={loading}
            rowKey="代码"
            scroll={{ x: 2000, y: 'calc(100vh - 350px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
              onShowSizeChange: (_current, size) => {
                setPagination({ current: 1, pageSize: size });
              },
            }}
          />
        </TabPane>
        <TabPane tab={SELECTED_TAB_LABEL} key={SELECTED_TAB_KEY}>
          {renderGroupTable(SELECTED_TAB_KEY)}
        </TabPane>
        {customTabs.map(tab => (
          <TabPane tab={renderCustomTabLabel(tab)} key={tab.key}>
            {renderGroupTable(tab.key)}
          </TabPane>
        ))}
      </Tabs>

      <Modal
        title="新建分组"
        open={createOpen}
        onOk={handleCreateTab}
        onCancel={() => {
          setCreateOpen(false);
          setNewTabName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入分组名称"
          value={newTabName}
          maxLength={12}
          autoFocus
          onChange={e => setNewTabName(e.target.value)}
          onPressEnter={handleCreateTab}
        />
      </Modal>
    </div>
  );
};

export default HkIndex;
