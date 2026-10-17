import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table, Typography, Input, Button, Tabs, Select, message, Dropdown, Modal, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { numberSorter, createRangeFilter, createDateRangeFilter } from '@/utils/tableUtils';
import type { IndexDetailData } from './detail';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, computeMonthlyQuarterlyPercentileBuyPoints, computeSinglePeriodPercentileTrades, WEEKLY_RSI_BUY_PERCENTILE, WEEKLY_RSI_SELL_PERCENTILE, MONTHLY_RSI_PCT_BUY_PERCENTILE, MONTHLY_RSI_PCT_SELL_PERCENTILE, isRecentDate } from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';



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

const CUSTOM_TABS_STORAGE_KEY = 'IndexPage-customTabs';
const CUSTOM_INDICES_STORAGE_KEY = 'IndexPage-customIndices';

interface IndexData {
  指数代码: string;
  指数简称: string;
  指数全称: string;
  发布时间: string;
  基日: string;
  基点: number;
  指数类别: string;
  指数系列: string;
  资产类别: string;
  指数币种: string;
  样本数量: number;
  最新收盘: number;
  近一个月收益率: number;
  合作指数: string;
  跟踪产品: string;
  指数合规: string;
  指数热点: string | null;
  指数年化率?: number;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  __月RSI6百分位__?: string;
  __周RSI6百分位__?: string;
}

const stringSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) => {
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

const Index: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
  });
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_KEY);
  const [selectedIndices, setSelectedIndices] = useState<IndexData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<IndexData[]>([]);
  const [excludedNames, setExcludedNames] = useState<string[]>(["债", "CS", "韩", "年", "-", "+", "对冲", "目标", "海外", "ESG", "内地", "SHS", "易方达", "AA", "交银", "太保", "智选", "SSH", "ABS", "海外", "期权", "城镇"]);

  // 自定义分组
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customIndicesMap, setCustomIndicesMap] = useState<Record<string, IndexData[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const renameCancelRef = useRef(false);
  const selectedIndicesRef = useRef<IndexData[]>([]);
  const customIndicesMapRef = useRef<Record<string, IndexData[]>>({});

  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);
  useEffect(() => {
    customIndicesMapRef.current = customIndicesMap;
  }, [customIndicesMap]);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: IndexData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const handleCalculateRecommendation = async () => {
    // 仅收集结果，全部计算完成后再一次性更新表格与缓存
    const resultMap = new Map<string, { quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }>();
    await runRecommendationBatchCalculation({
      targets: selectedRows,
      getKey: item => String(item['指数代码']),
      getName: item => item['指数简称'] || String(item['指数代码']),
      emptyWarn: '请选择指数',
      fetchBuyPoints: item => fetchIndexDetailAndCalculate(String(item['指数代码'])),
      onItemDone: (item, result) => {
        resultMap.set(String(item['指数代码']), result);
      },
    });
    if (resultMap.size === 0) return;

    // 将买点结果写回当前活动分组（自选或自定义分组）
    const applyResults = (list: IndexData[]): IndexData[] =>
      list.map(item => {
        const result = resultMap.get(String(item['指数代码']));
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

  console.log('11111 selectedIndices', selectedIndices)

  // 计算推荐买点（定量 + 百分位 + 月/周 RSI6 百分位策略）
  const fetchIndexDetailAndCalculate = async (symbol: string): Promise<{ quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }> => {
    try {

      const startDate = '19800101'; // 默认从1980年1月1日开始查询，并去除第一个日期的空值
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=${symbol}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
      const data = response?.data || [];
      const firstNonMultipleIndex = data.findIndex((item: IndexDetailData) => Number(item.收盘) % 100 !== 0);
      const formatData = (0 < firstNonMultipleIndex && firstNonMultipleIndex < 10) ? data.slice(firstNonMultipleIndex - 1) : data;
      const stockHistoryList = formatData?.map((item: IndexDetailData) => ({
        日期: item.日期,
        收盘: Number(item.收盘),
      })) || [];

      // 1) 计算日/周/月/季 K 线的 RSI6 值
      const periodRSIMap = calculatePeriodRSI(stockHistoryList);

      // 2) 合并为带推荐级别的图表数据
      const chartData = computeRSIRecommendations(periodRSIMap, 'index') as any[];

      // 3) 过滤出推荐买点
      const buyPointList = chartData.filter(
        (row): row is any => row.__recommendationLevel__ != null,
      );

      // 4) 过滤 每月最晚（最新）的一条记录
      const chartDataMonthly = convertToMonthlyData(buyPointList);

      // 定量买点日期
      const quantitative = chartDataMonthly?.reverse()?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(',') || '';

      // 5) 百分位策略买点（月&季 RSI6 共振）
      const percentileBuyPoints = computeMonthlyQuarterlyPercentileBuyPoints({
        monthlyRSI6Data: periodRSIMap.monthlyRSI,
        quarterlyRSI6Data: periodRSIMap.quarterlyRSI,
        closeValueType: 'price',
      });
      const percentile = percentileBuyPoints.map(p => moment(p.日期).format('YYYY-MM-DD')).join(',');

      // 6) 月RSI6 百分位策略（月单周期，买入分位 3%）：取每笔配对的第一次买入日期
      const monthlyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.monthlyRSI,
        buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
        sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      // 7) 周RSI6 百分位策略（周单周期，买入分位 1%）：取每笔配对的第一次买入日期
      const weeklyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.weeklyRSI,
        buyPercentile: WEEKLY_RSI_BUY_PERCENTILE,
        sellPercentile: WEEKLY_RSI_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      return { quantitative, percentile, monthlyPercentile, weeklyPercentile };
    } catch (error) {
      console.log('Error fetching index detail:', error);
      return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
    }
  };



  const getUniqueValues = (data: IndexData[], key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => String(item[key] || ''))))
      .filter(value => value !== 'null' && value !== 'undefined')
      .sort();
  };

  const columns = useMemo(() => [
    {
      title: '指数代码',
      dataIndex: '指数代码',
      key: '指数代码',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['指数代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '指数简称',
      dataIndex: '指数简称',
      key: '指数简称',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数简称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>

            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['指数简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
      render: (name: string, record: IndexData) => (
        <Link
          onClick={() => window.open(`/stock/a/index/detail?code=${record['指数代码']}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '推荐买点（百分位）',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 90,
      sorter: stringSorter('__推荐买点百分位__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#f6ffed',
                      color: '#52c41a',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #b7eb8f',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      title: '推荐买点（定量）',
      dataIndex: '__推荐买点定量__',
      key: '__推荐买点定量__',
      width: 90,
      sorter: stringSorter('__推荐买点定量__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#e6f7ff',
                      color: '#1890ff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #91caff',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
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
    // {
    //   title: '发布时间',
    //   dataIndex: '发布时间',
    //   key: '发布时间',
    //   width: 60,
    //   ...createDateRangeFilter('发布时间'),
    //   sorter: stringSorter('发布时间'),
    //   render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
    // },
    {
      title: '指数类别',
      dataIndex: '指数类别',
      key: '指数类别',
      width: 60,
      sorter: stringSorter('指数类别'),
      filters: getUniqueValues(data, '指数类别').map(value => ({ text: value, value })),
      onFilter: (value: React.Key, record: IndexData) => record['指数类别']?.includes(value as string),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '基点',
      dataIndex: '基点',
      key: '基点',
      width: 60,
      sorter: stringSorter('基点'),
    },
    {
      title: '样本数量',
      dataIndex: '样本数量',
      key: '样本数量',
      width: 60,
      sorter: stringSorter('样本数量'),
    },
    {
      title: '最新收盘',
      dataIndex: '最新收盘',
      key: '最新收盘',
      width: 60,
      sorter: stringSorter('最新收盘'),
    },
    // {
    //   title: '指数年化率',
    //   key: '指数年化率',
    //   width: 80,
    //   sorter: stringSorter('指数年化率'),
    //   ...createRangeFilter('指数年化率'),
    //   render: (_, record: IndexData) => `${(record['指数年化率'])?.toFixed(2)}%`,
    // },

    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record: IndexData) => {
        const isSelected = isIndexSelected(record['指数代码']);

        // 「全部」Tab：添加到自选 + 加入分组
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
              const inGroup = isInGroup(tab.key, record['指数代码']);
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
            <Button
              type="link"
              size="small"
              onClick={() => moveInGroup(groupKey, record, 'top')}
            >
              置顶
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => moveInGroup(groupKey, record, 'bottom')}
            >
              置底
            </Button>
          </div>
        );
      },
    },
  ], [data, selectedIndices, activeTab, customTabs, customIndicesMap, renaming]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_csindex_all');
      console.log('指数列表 -> response', response);
      let newData = (response?.data || []).map((item: IndexData) => {
        if (!item['发布时间'] || !item['最新收盘'] || !item['基点'] || item['基点'] === 0) {
          return { ...item, '指数年化率': undefined };
        }
        const years = moment().diff(moment(item['发布时间']), 'years', true);
        if (years < 1) {
          return { ...item, '指数年化率': undefined };
        }
        const annualReturn = Math.pow(item['最新收盘'] / item['基点'], 1 / years) - 1;
        return { ...item, '指数年化率': annualReturn * 100 };
      });

      if (excludedNames.length > 0) {
        newData = newData.filter((item: any) => {
          const indexNameShortName = String(item['指数简称'] || '').toLowerCase();
          return !excludedNames.some(excludedName =>
            indexNameShortName.includes(excludedName.toLowerCase())
          );
        });
      }

      setData(newData);

      // 用新数据刷新自选与所有自定义分组（保留买点字段）
      const mergeFreshIndices = (oldList: IndexData[], freshList: IndexData[]): IndexData[] => {
        return oldList.map(oldItem => {
          const matched = freshList.find(f => f['指数代码'] === oldItem['指数代码']);
          if (!matched) return oldItem;
          return {
            ...matched,
            '指数代码': oldItem['指数代码'],
            __推荐买点定量__: oldItem.__推荐买点定量__,
            __推荐买点百分位__: oldItem.__推荐买点百分位__,
            __月RSI6百分位__: oldItem.__月RSI6百分位__,
            __周RSI6百分位__: oldItem.__周RSI6百分位__,
          };
        });
      };

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
  }, []);

  // 从localStorage加载自选指数
  const loadSelectedIndices = () => {
    try {
      const savedIndices = localStorage.getItem('selectedIndices');
      if (savedIndices) {
        setSelectedIndices(JSON.parse(savedIndices));
      }
    } catch (error) {
      console.log('加载自选指数失败:', error);
    }
  };

  // 保存自选指数到localStorage
  const saveSelectedIndices = (indices: IndexData[]) => {
    try {
      localStorage.setItem('selectedIndices', JSON.stringify(indices));
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
      const stocksMap: Record<string, IndexData[]> = savedMap ? JSON.parse(savedMap) : {};
      const validKeys = new Set(validTabs.map(t => t.key));
      const cleanedMap: Record<string, IndexData[]> = {};
      Object.keys(stocksMap).forEach(key => {
        if (validKeys.has(key) && Array.isArray(stocksMap[key])) {
          cleanedMap[key] = stocksMap[key];
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
  const getGroupIndices = (groupKey: string): IndexData[] =>
    groupKey === SELECTED_TAB_KEY ? selectedIndicesRef.current : (customIndicesMapRef.current[groupKey] || []);

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

  // 添加到指定分组
  const addToGroup = (groupKey: string, index: IndexData) => {
    const list = getGroupIndices(groupKey);
    if (list.some(s => s['指数代码'] === index['指数代码'])) {
      message.info(`「${index['指数简称'] || index['指数代码']}」已在「${getGroupLabel(groupKey)}」中`);
      return;
    }
    saveGroupIndices(groupKey, [...list, index]);
    message.success(`已添加 ${index['指数简称'] || index['指数代码']} 到「${getGroupLabel(groupKey)}」`);
  };

  // 从指定分组移除
  const removeFromGroup = (groupKey: string, index: IndexData) => {
    saveGroupIndices(groupKey, list => list.filter(s => s['指数代码'] !== index['指数代码']));
    message.info(`已从「${getGroupLabel(groupKey)}」移除 ${index['指数简称'] || index['指数代码']}`);
  };

  // 切换某指数在目标分组的归属状态——已在则移除，不在则加入
  const toggleGroupMembership = (record: IndexData, targetKey: string) => {
    const list = getGroupIndices(targetKey);
    if (list.some(s => s['指数代码'] === record['指数代码'])) {
      saveGroupIndices(targetKey, list.filter(s => s['指数代码'] !== record['指数代码']));
    } else {
      saveGroupIndices(targetKey, [...list, record]);
    }
  };

  // 判断指数是否已在某分组
  const isInGroup = (groupKey: string, code: string) =>
    getGroupIndices(groupKey).some(s => s['指数代码'] === code);

  // 分组内置顶/置底
  const moveInGroup = (groupKey: string, index: IndexData, position: 'top' | 'bottom') => {
    const list = getGroupIndices(groupKey);
    const rest = list.filter(s => s['指数代码'] !== index['指数代码']);
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
  const buildCrossGroupMenuItems = (record: IndexData, currentGroupKey: string): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    // 自选
    if (currentGroupKey !== SELECTED_TAB_KEY) {
      const inSelected = isInGroup(SELECTED_TAB_KEY, record['指数代码']);
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
      const inGroup = isInGroup(tab.key, record['指数代码']);
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
          description="分组内的指数列表将一并删除"
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
  const addToSelected = (index: IndexData) => {
    const isAlreadySelected = selectedIndices.some(i => i['指数代码'] === index['指数代码']);
    if (!isAlreadySelected) {
      const newSelectedIndices = [...selectedIndices, index];
      setSelectedIndices(newSelectedIndices);
      saveSelectedIndices(newSelectedIndices);
    }
  };

  // 从自选中移除
  const removeFromSelected = (index: IndexData) => {
    const newSelectedIndices = selectedIndices.filter(i => i['指数代码'] !== index['指数代码']);
    setSelectedIndices(newSelectedIndices);
    saveSelectedIndices(newSelectedIndices);
  };

  // 检查指数是否已在自选中
  const isIndexSelected = (indexCode: string) => {
    return selectedIndices.some(i => i['指数代码'] === indexCode);
  };


  // 渲染分组表格（自选和自定义分组通用）
  const renderGroupTable = (groupKey: string) => {
    const list = getGroupIndices(groupKey);
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
            position: 'relative'
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
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
              ✓
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontWeight: 'bold', color: '#fff', fontSize: '14px',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              计算推荐买点
            </span>
            <span style={{
              color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginTop: '2px'
            }}>
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
          rowKey="指数代码"
          scroll={{ x: 2400, y: 'calc(100vh - 350px)' }}
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
        <TabPane tab="全部" key={ALL_TAB_KEY}>
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            不包含指数简称：
            <Select
              mode="tags"
              style={{ width: 500 }}
              placeholder="不包含指数简称"
              value={excludedNames}
              onChange={setExcludedNames}
            />


            <Button type="primary" onClick={fetchData} loading={loading}>
              搜索
            </Button>
          </div>
          <Table
            columns={columns?.filter(c => c.key !== '__推荐买点定量__' && c.key !== '__推荐买点百分位__' && c.key !== '__月RSI6百分位__' && c.key !== '__周RSI6百分位__') || []}
            dataSource={data}
            loading={loading}
            rowKey="指数代码"
            scroll={{ x: 2000, y: 'calc(100vh - 350px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
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

export default Index;
