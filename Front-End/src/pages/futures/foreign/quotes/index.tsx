import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table, Typography, Input, Button, Tabs, message, Dropdown, Modal, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, CloseOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { isRecentDate } from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
import { computeBuyPoints } from '@/utils/buyPointWorker';

const { Link } = Typography;
const { TabPane } = Tabs;

/** 固定 tab：全部外盘期货列表（「外盘」）、自选（不可删除/重命名） */
const ALL_TAB_KEY = 'all';
const ALL_TAB_LABEL = '外盘';
const SELECTED_TAB_KEY = 'selected';
const SELECTED_TAB_LABEL = '自选';

/** 自定义分组：key 唯一且不变，label 可编辑 */
interface CustomTab {
  key: string;
  label: string;
}

const CUSTOM_TABS_STORAGE_KEY = 'FuturesQuotes-customTabs';
const CUSTOM_FUTURES_STORAGE_KEY = 'FuturesQuotes-customFutures';
const SELECTED_FUTURES_STORAGE_KEY = 'futuresQuotes-selected';

/**
 * 外盘期货列表接口 futures_hq_subscribe_exchange_symbol 返回字段：
 * - symbol：品种中文名（如「NYMEX原油」）
 * - code：品种代码（如「CL」，用于详情接口 futures_foreign_hist?symbol=CL）
 */
interface FuturesData {
  symbol: string;
  code: string;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  __月RSI6百分位__?: string;
  __周RSI6百分位__?: string;
}

const stringSorter = (key: keyof FuturesData) => (a: FuturesData, b: FuturesData) => {
  const aValue = String(a[key] || '');
  const bValue = String(b[key] || '');
  return aValue.localeCompare(bValue, 'zh-CN');
};

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

const FuturesForeignQuotes: React.FC = () => {
  const [data, setData] = useState<FuturesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
  });
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_KEY);
  const [selectedFutures, setSelectedFutures] = useState<FuturesData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<FuturesData[]>([]);

  // 自定义分组
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customFuturesMap, setCustomFuturesMap] = useState<Record<string, FuturesData[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const renameCancelRef = useRef(false);
  const selectedFuturesRef = useRef<FuturesData[]>([]);

  useEffect(() => {
    selectedFuturesRef.current = selectedFutures;
  }, [selectedFutures]);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: FuturesData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const handleCalculateRecommendation = async () => {
    // 仅收集结果，全部计算完成后再一次性更新表格与缓存
    const resultMap = new Map<string, { quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }>();
    await runRecommendationBatchCalculation({
      targets: selectedRows,
      getKey: item => String(item.code),
      getName: item => item.symbol || String(item.code),
      emptyWarn: '请选择期货品种',
      fetchBuyPoints: item => fetchFuturesDetailAndCalculate(String(item.code)),
      onItemDone: (item, result) => {
        resultMap.set(String(item.code), result);
      },
    });
    if (resultMap.size === 0) return;

    // 将买点结果写回当前活动分组（自选或自定义分组）
    const applyResults = (list: FuturesData[]): FuturesData[] =>
      list.map(item => {
        const result = resultMap.get(String(item.code));
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
      const latest = applyResults(selectedFuturesRef.current);
      setSelectedFutures(latest);
      saveSelectedFutures(latest);
      return;
    }

    // 自定义分组
    const isCustomTab = customTabs.some(t => t.key === activeTab);
    if (isCustomTab) {
      saveGroupFutures(activeTab, prev => applyResults(prev));
    }
  };

  // 计算推荐买点（定量 + 百分位 + 月/周 RSI6 百分位策略）
  const fetchFuturesDetailAndCalculate = async (code: string): Promise<{ quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }> => {
    try {
      const response = await apiClient.get('/api/public/futures_foreign_hist', {
        params: { symbol: code },
      });
      // 接口返回英文字段：date/open/high/low/close，此处映射为 KLineData 所需的中文字段
      const stockHistoryList = (response?.data || [])
        .map((item: Record<string, unknown>) => ({
          日期: String(item.date).slice(0, 10),
          收盘: Number(item.close),
        }))
        .filter((item: { 日期: string; 收盘: number }) => Number.isFinite(item.收盘));

      // 接口无数据时无分析意义，直接返回空结果（不覆盖已有买点）
      if (stockHistoryList.length === 0) {
        return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
      }

      return computeBuyPoints({ type: 'commodity', rawData: stockHistoryList });
    } catch (error) {
      console.log('Error fetching futures detail:', error);
      return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
    }
  };

  const columns = useMemo<ColumnsType<FuturesData>>(() => [
    {
      title: '品种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      sorter: stringSorter('symbol'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入品种名称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90 }}>
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters?.();
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
      onFilter: (value, record) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record.symbol || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
      render: (name, record) => (
        <Link
          onClick={() => window.open(`/futures/foreign/quotes/detail?code=${record.code}&name=${encodeURIComponent(record.symbol || '')}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 80,
      sorter: stringSorter('code'),
    },
    {
      title: '推荐买点（百分位）',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 90,
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
      width: 90,
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
      width: 90,
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
      width: 90,
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
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record) => {
        const isSelected = isFuturesSelected(record.code);

        // 「外盘」Tab：添加到自选 + 加入分组
        if (activeTab === ALL_TAB_KEY) {
          const joinGroupItems: MenuProps['items'] = [
            {
              key: SELECTED_TAB_KEY,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                  <span>{SELECTED_TAB_LABEL}</span>
                  {isSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
                </span>
              ),
              onClick: () => toggleGroupMembership(record, SELECTED_TAB_KEY),
            },
            ...customTabs.map(tab => {
              const inGroup = isInGroup(tab.key, record.code);
              return {
                key: tab.key,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                    <span>{tab.label}</span>
                    {inGroup && <CheckOutlined style={{ color: '#52c41a' }} />}
                  </span>
                ),
                onClick: () => toggleGroupMembership(record, tab.key),
              };
            }),
          ];

          return (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type={isSelected ? 'default' : 'primary'}
                size="small"
                onClick={() => isSelected ? removeFromSelected(record) : addToSelected(record)}
              >
                {isSelected ? '取消自选' : '添加到自选'}
              </Button>
              <Dropdown menu={{ items: joinGroupItems }} placement="bottomRight">
                <Button type="default" size="small">
                  加入分组
                </Button>
              </Dropdown>
            </div>
          );
        }

        // 自选或自定义分组 Tab：移出 + 加入到 + 置顶置底
        const groupKey = activeTab;
        const crossMenuItems = buildCrossGroupMenuItems(record, groupKey);

        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              type="default"
              danger
              size="small"
              onClick={() => removeFromGroup(groupKey, record)}
            >
              移出{groupKey === SELECTED_TAB_KEY ? '自选' : '分组'}
            </Button>
            {crossMenuItems && crossMenuItems.length > 0 && (
              <Dropdown menu={{ items: crossMenuItems }} placement="bottomRight">
                <Button type="default" size="small">
                  加入到
                </Button>
              </Dropdown>
            )}
            <Button type="link" size="small" onClick={() => moveInGroup(groupKey, record, 'top')}>
              置顶
            </Button>
            <Button type="link" size="small" onClick={() => moveInGroup(groupKey, record, 'bottom')}>
              置底
            </Button>
          </div>
        );
      },
    },
  ], [data, selectedFutures, activeTab, customTabs, customFuturesMap, renaming]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 外盘期货订阅列表：返回 symbol（中文名）/ code（代码）
      const response = await apiClient.get('/api/public/futures_hq_subscribe_exchange_symbol');
      console.log('外盘期货列表 -> response', response);
      const newData: FuturesData[] = (response?.data || []).map((item: FuturesData) => ({
        symbol: item.symbol,
        code: item.code,
      }));

      setData(newData);

      // 用新数据刷新自选与所有自定义分组（保留买点字段）
      const mergeFreshFutures = (oldList: FuturesData[], freshList: FuturesData[]): FuturesData[] => {
        return oldList.map(oldItem => {
          const matched = freshList.find(f => f.code === oldItem.code);
          if (!matched) return oldItem;
          return {
            ...matched,
            code: oldItem.code,
            __推荐买点定量__: oldItem.__推荐买点定量__,
            __推荐买点百分位__: oldItem.__推荐买点百分位__,
            __月RSI6百分位__: oldItem.__月RSI6百分位__,
            __周RSI6百分位__: oldItem.__周RSI6百分位__,
          };
        });
      };

      if (selectedFutures.length > 0) {
        const updated = mergeFreshFutures(selectedFutures, newData);
        setSelectedFutures(updated);
        saveSelectedFutures(updated);
      }

      const customKeys = Object.keys(customFuturesMap);
      if (customKeys.length > 0) {
        setCustomFuturesMap(prev => {
          const next: Record<string, FuturesData[]> = { ...prev };
          customKeys.forEach(key => {
            next[key] = mergeFreshFutures(prev[key] || [], newData);
          });
          persistCustomFutures(next);
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
    loadSelectedFutures();
    loadCustomTabs();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从localStorage加载自选期货
  const loadSelectedFutures = () => {
    try {
      const saved = localStorage.getItem(SELECTED_FUTURES_STORAGE_KEY);
      if (saved) {
        setSelectedFutures(JSON.parse(saved));
      }
    } catch (error) {
      console.log('加载自选期货失败:', error);
    }
  };

  // 保存自选期货到localStorage
  const saveSelectedFutures = (list: FuturesData[]) => {
    try {
      localStorage.setItem(SELECTED_FUTURES_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      console.log('保存自选期货失败:', error);
    }
  };

  // 加载自定义分组
  const loadCustomTabs = () => {
    try {
      const savedTabs = localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
      const savedMap = localStorage.getItem(CUSTOM_FUTURES_STORAGE_KEY);
      const validTabs: CustomTab[] = savedTabs ? JSON.parse(savedTabs) : [];
      const futuresMap: Record<string, FuturesData[]> = savedMap ? JSON.parse(savedMap) : {};
      const validKeys = new Set(validTabs.map(t => t.key));
      const cleanedMap: Record<string, FuturesData[]> = {};
      Object.keys(futuresMap).forEach(key => {
        if (validKeys.has(key) && Array.isArray(futuresMap[key])) {
          cleanedMap[key] = futuresMap[key];
        }
      });
      setCustomTabs(validTabs);
      setCustomFuturesMap(cleanedMap);
    } catch (error) {
      console.log('加载自定义分组失败:', error);
    }
  };

  const persistCustomTabs = (tabs: CustomTab[]) => {
    localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(tabs));
  };

  const persistCustomFutures = (map: Record<string, FuturesData[]>) => {
    localStorage.setItem(CUSTOM_FUTURES_STORAGE_KEY, JSON.stringify(map));
  };

  // 按分组 key 读取期货（selected 为固定自选分组）
  // 注意：渲染与事件读取都必须走 state，不能用 ref——ref 仅在 setState 后的 effect 里同步，
  // 若用它作为表格 dataSource，则 setState 触发的重渲染读到的仍是旧数组，导致算完买点后表格不刷新
  const getGroupFutures = (groupKey: string): FuturesData[] =>
    groupKey === SELECTED_TAB_KEY ? selectedFutures : (customFuturesMap[groupKey] || []);

  // 按分组 key 写入期货并持久化（支持函数式更新）
  const saveGroupFutures = (
    groupKey: string,
    updater: FuturesData[] | ((prev: FuturesData[]) => FuturesData[]),
  ) => {
    if (groupKey === SELECTED_TAB_KEY) {
      const next = typeof updater === 'function' ? updater(selectedFuturesRef.current) : updater;
      setSelectedFutures(next);
      saveSelectedFutures(next);
      return;
    }
    setCustomFuturesMap(prev => {
      const nextList = typeof updater === 'function' ? updater(prev[groupKey] || []) : updater;
      const next = { ...prev, [groupKey]: nextList };
      persistCustomFutures(next);
      return next;
    });
  };

  const getGroupLabel = (groupKey: string): string =>
    groupKey === SELECTED_TAB_KEY
      ? SELECTED_TAB_LABEL
      : customTabs.find(t => t.key === groupKey)?.label || '分组';

  // 从指定分组移除
  const removeFromGroup = (groupKey: string, item: FuturesData) => {
    saveGroupFutures(groupKey, list => list.filter(s => s.code !== item.code));
    message.info(`已从「${getGroupLabel(groupKey)}」移除 ${item.symbol || item.code}`);
  };

  // 切换某品种在目标分组的归属状态——已在则移除，不在则加入
  const toggleGroupMembership = (record: FuturesData, targetKey: string) => {
    const list = getGroupFutures(targetKey);
    if (list.some(s => s.code === record.code)) {
      saveGroupFutures(targetKey, list.filter(s => s.code !== record.code));
    } else {
      saveGroupFutures(targetKey, [...list, record]);
    }
  };

  // 判断品种是否已在某分组
  const isInGroup = (groupKey: string, code: string) =>
    getGroupFutures(groupKey).some(s => s.code === code);

  // 分组内置顶/置底
  const moveInGroup = (groupKey: string, item: FuturesData, position: 'top' | 'bottom') => {
    const list = getGroupFutures(groupKey);
    const rest = list.filter(s => s.code !== item.code);
    saveGroupFutures(groupKey, position === 'top' ? [item, ...rest] : [...rest, item]);
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
    const nextMap = { ...customFuturesMap, [key]: [] };
    setCustomFuturesMap(nextMap);
    persistCustomFutures(nextMap);
    setActiveTab(key);
    setCreateOpen(false);
    setNewTabName('');
    message.success(`分组「${name}」已创建`);
  };

  // 删除分组（含分组内期货）
  const handleDeleteTab = (tab: CustomTab) => {
    const nextTabs = customTabs.filter(t => t.key !== tab.key);
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    setCustomFuturesMap(prev => {
      const next = { ...prev };
      delete next[tab.key];
      persistCustomFutures(next);
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
  const buildCrossGroupMenuItems = (record: FuturesData, currentGroupKey: string): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    // 自选
    if (currentGroupKey !== SELECTED_TAB_KEY) {
      const inSelected = isInGroup(SELECTED_TAB_KEY, record.code);
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
      const inGroup = isInGroup(tab.key, record.code);
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
          title="点击重命名"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            startRename(tab);
          }}
        />
        <Popconfirm
          title={`删除分组「${tab.label}」？`}
          description="分组内的期货品种将一并删除"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeleteTab(tab)}
        >
          <CloseOutlined
            title="删除分组"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          />
        </Popconfirm>
      </span>
    );
  };

  // 添加到自选
  const addToSelected = (item: FuturesData) => {
    const isAlreadySelected = selectedFutures.some(i => i.code === item.code);
    if (!isAlreadySelected) {
      const next = [...selectedFutures, item];
      setSelectedFutures(next);
      saveSelectedFutures(next);
    }
  };

  // 从自选中移除
  const removeFromSelected = (item: FuturesData) => {
    const next = selectedFutures.filter(i => i.code !== item.code);
    setSelectedFutures(next);
    saveSelectedFutures(next);
  };

  // 检查品种是否已在自选中
  const isFuturesSelected = (code: string) => {
    return selectedFutures.some(i => i.code === code);
  };

  // 渲染分组表格（自选和自定义分组通用）
  const renderGroupTable = (groupKey: string) => {
    const list = getGroupFutures(groupKey);
    return (
      <>
        <div
          onClick={handleCalculateRecommendation}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            borderRadius: '25px',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 8px 25px rgba(56, 239, 125, 0.5), 0 0 0 3px rgba(56, 239, 125, 0.2)',
            cursor: 'pointer',
            transform: 'scale(1.02)',
            border: '2px solid transparent',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✓</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              计算推荐买点
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginTop: '2px' }}>
              启用后将计算RSI指标
            </span>
          </div>
        </div>
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: onSelectChange,
          }}
          columns={columns}
          dataSource={list}
          rowKey="code"
          scroll={{ x: 1600, y: 'calc(100vh - 350px)' }}
          pagination={false}
        />
      </>
    );
  };

  return (
    <div style={{ padding: '0 24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
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
        <TabPane tab={ALL_TAB_LABEL} key={ALL_TAB_KEY}>
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              刷新
            </Button>
          </div>
          <Table
            columns={columns?.filter(c => c.key !== '__推荐买点定量__' && c.key !== '__推荐买点百分位__' && c.key !== '__月RSI6百分位__' && c.key !== '__周RSI6百分位__') || []}
            dataSource={data}
            loading={loading}
            rowKey="code"
            scroll={{ x: 600, y: 'calc(100vh - 350px)' }}
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

export default FuturesForeignQuotes;
