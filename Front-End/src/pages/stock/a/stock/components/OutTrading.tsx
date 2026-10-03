import React, { useEffect, useState, useRef } from 'react';
import { Table, Typography, InputNumber, Space, Button, Input, Tabs, message, Dropdown, Modal, Popconfirm } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined, CheckOutlined, FieldTimeOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, computeMonthlyQuarterlyPercentileBuyPoints, computeSinglePeriodPercentileTrades, WEEKLY_RSI_BUY_PERCENTILE, WEEKLY_RSI_SELL_PERCENTILE, MONTHLY_RSI_PCT_BUY_PERCENTILE, MONTHLY_RSI_PCT_SELL_PERCENTILE, isRecentDate } from '@/utils/stockUtils';
import type { KLineData } from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';

const { Search } = Input;

const { Link } = Typography;
const { TabPane } = Tabs;

interface StockData {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌额: number;
  涨跌幅: number;
  买入: number;
  卖出: number;
  昨收: number;
  今开: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  时间戳: unknown;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  /** 月 RSI6 百分位策略建仓日期（逗号分隔，取每笔配对的第一次买入） */
  __月RSI6百分位__?: string;
  /** 周 RSI6 百分位策略建仓日期（逗号分隔，取每笔配对的第一次买入） */
  __周RSI6百分位__?: string;
}

// 周期 RSI 字段名（与 stockUtils 中返回的字段保持一致）
type RsiFieldKey =
  | '__daily__RSI6__'
  | '__weekly__RSI6__'
  | '__monthly__RSI6__'
  | '__quarterly__RSI6__';

// 单行数据：日期 + 收盘价 + 各周期 RSI6 + 推荐级别（null 表示非买点）
type ChartRow = KLineData & {
  __recommendationLevel__: number | null;
} & Record<RsiFieldKey, number | null>;

// 过滤后的买点数据行（推荐级别必不为 null）
type BuyPointRow = ChartRow & { __recommendationLevel__: number };

/** 固定 tab：全部 A 股列表、自选（不可删除/重命名） */
const ALL_TAB_KEY = 'all';
const SELECTED_TAB_KEY = 'selected';
const SELECTED_TAB_LABEL = '自选';

/** 自定义分组：key 唯一且不变，label 可编辑 */
interface CustomTab {
  key: string;
  label: string;
}

const CUSTOM_TABS_STORAGE_KEY = 'OutTrading-customTabs';
const CUSTOM_STOCKS_STORAGE_KEY = 'OutTrading-customStocks';

const numberSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key] || 0;
  const bValue = b[key] || 0;
  return (aValue as number) - (bValue as number);
};

const stringSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key];
  const bValue = b[key];
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue, 'zh-CN');
  }
  return 0;
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

const handleNavigateToDetail = (record: StockData) => {
  window.open(`/stock/a/stock/detail?symbol=${record.代码}&name=${encodeURIComponent(record.名称 || '')}`, '_blank');
};

/**
 * 用最新行情刷新分组内股票（代码/买点字段保留分组内原值，其余字段以行情为准）
 */
const mergeFreshQuotes = (groupStocks: StockData[], freshData: StockData[]): StockData[] =>
  groupStocks.map(groupStock => {
    const matchedStock = freshData.find(stock => stock['代码'] === groupStock['代码']);
    if (!matchedStock) return groupStock;
    return {
      ...matchedStock,
      '代码': groupStock['代码'],
      __推荐买点定量__: groupStock.__推荐买点定量__,
      __推荐买点百分位__: groupStock.__推荐买点百分位__,
      __月RSI6百分位__: groupStock.__月RSI6百分位__,
      __周RSI6百分位__: groupStock.__周RSI6百分位__,
    };
  });


const OutTrading: React.FC = () => {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [activeTab, setActiveTab] = useState<string>('selected');
  const [selectedStocks, setSelectedStocks] = useState<StockData[]>([]);
  const selectedStocksRef = useRef<StockData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<StockData[]>([]);

  // 自定义分组 tab（key 唯一、label 可编辑）及其股票列表
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customStocksMap, setCustomStocksMap] = useState<Record<string, StockData[]>>({});
  const customStocksMapRef = useRef<Record<string, StockData[]>>({});

  // 新建分组弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');

  // 内联重命名状态
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const renameCancelRef = useRef(false);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: StockData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  // 保持 ref 与 state 同步
  useEffect(() => {
    selectedStocksRef.current = selectedStocks;
  }, [selectedStocks]);

  useEffect(() => {
    customStocksMapRef.current = customStocksMap;
  }, [customStocksMap]);

  // 从 localStorage 加载自选股票
  useEffect(() => {
    try {
      const savedStocks = localStorage.getItem('OutTrading-selectedStocks');
      if (savedStocks) {
        setSelectedStocks(JSON.parse(savedStocks));
      }
    } catch (error) {
      console.log('加载自选股票失败:', error);
    }
  }, []);

  // 从 localStorage 加载自定义分组及各分组股票
  useEffect(() => {
    try {
      const rawTabs = localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
      const rawStocks = localStorage.getItem(CUSTOM_STOCKS_STORAGE_KEY);
      const tabs: CustomTab[] = rawTabs ? JSON.parse(rawTabs) : [];
      const stocksMap: Record<string, StockData[]> = rawStocks ? JSON.parse(rawStocks) : {};
      const validTabs = Array.isArray(tabs)
        ? tabs.filter(t => t && typeof t.key === 'string' && typeof t.label === 'string')
        : [];
      // 清理已不存在分组的残留股票数据
      const validKeys = new Set(validTabs.map(t => t.key));
      const cleanedMap: Record<string, StockData[]> = {};
      Object.keys(stocksMap).forEach(key => {
        if (validKeys.has(key) && Array.isArray(stocksMap[key])) {
          cleanedMap[key] = stocksMap[key];
        }
      });
      setCustomTabs(validTabs);
      setCustomStocksMap(cleanedMap);
    } catch (error) {
      console.log('加载自定义分组失败:', error);
    }
  }, []);

  const persistCustomTabs = (tabs: CustomTab[]) => {
    localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(tabs));
  };

  const persistCustomStocks = (map: Record<string, StockData[]>) => {
    localStorage.setItem(CUSTOM_STOCKS_STORAGE_KEY, JSON.stringify(map));
  };

  // 按分组 key 读取股票（selected 为固定自选分组）
  const getGroupStocks = (groupKey: string): StockData[] =>
    groupKey === SELECTED_TAB_KEY ? selectedStocks : (customStocksMap[groupKey] || []);

  // 按分组 key 写入股票并持久化（支持函数式更新）
  const saveGroupStocks = (
    groupKey: string,
    updater: StockData[] | ((prev: StockData[]) => StockData[]),
  ) => {
    if (groupKey === SELECTED_TAB_KEY) {
      const next = typeof updater === 'function' ? updater(selectedStocksRef.current) : updater;
      setSelectedStocks(next);
      saveSelectedStocks(next);
      return;
    }
    setCustomStocksMap(prev => {
      const nextList = typeof updater === 'function' ? updater(prev[groupKey] || []) : updater;
      const next = { ...prev, [groupKey]: nextList };
      persistCustomStocks(next);
      return next;
    });
  };

  const getGroupLabel = (groupKey: string): string =>
    groupKey === SELECTED_TAB_KEY
      ? SELECTED_TAB_LABEL
      : customTabs.find(t => t.key === groupKey)?.label || '分组';

  // 添加到指定分组
  const addToGroup = (groupKey: string, stock: StockData) => {
    const list = getGroupStocks(groupKey);
    if (list.some(s => s['代码'] === stock['代码'])) {
      message.info(`「${stock.名称 || stock.代码}」已在「${getGroupLabel(groupKey)}」中`);
      return;
    }
    saveGroupStocks(groupKey, [...list, stock]);
    message.success(`已添加 ${stock.名称 || stock.代码} 到「${getGroupLabel(groupKey)}」`);
  };

  // 从指定分组移除
  const removeFromGroup = (groupKey: string, stock: StockData) => {
    saveGroupStocks(groupKey, list => list.filter(s => s['代码'] !== stock['代码']));
    message.info(`已从「${getGroupLabel(groupKey)}」移除 ${stock.名称 || stock.代码}`);
  };

  // 分组内置顶/置底
  const moveInGroup = (groupKey: string, stock: StockData, position: 'top' | 'bottom') => {
    const list = getGroupStocks(groupKey);
    const rest = list.filter(s => s['代码'] !== stock['代码']);
    saveGroupStocks(groupKey, position === 'top' ? [stock, ...rest] : [...rest, stock]);
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
    const nextMap = { ...customStocksMap, [key]: [] };
    setCustomStocksMap(nextMap);
    persistCustomStocks(nextMap);
    setActiveTab(key);
    setCreateOpen(false);
    setNewTabName('');
    message.success(`分组「${name}」已创建`);
  };

  // 删除分组（含分组内股票）
  const handleDeleteTab = (tab: CustomTab) => {
    const nextTabs = customTabs.filter(t => t.key !== tab.key);
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    setCustomStocksMap(prev => {
      const next = { ...prev };
      delete next[tab.key];
      persistCustomStocks(next);
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
          description="分组内的股票列表将一并删除"
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

  // 行情刷新后，同步更新自选与所有自定义分组内股票的行情字段（买点字段保留）
  const refreshGroupsQuotes = (freshData: StockData[]) => {
    const currentSelected = selectedStocksRef.current;
    if (currentSelected.length > 0) {
      setSelectedStocks(mergeFreshQuotes(currentSelected, freshData));
    }
    const currentCustom = customStocksMapRef.current;
    const customKeys = Object.keys(currentCustom);
    if (customKeys.length > 0) {
      setCustomStocksMap(prev => {
        const next: Record<string, StockData[]> = { ...prev };
        customKeys.forEach(key => {
          next[key] = mergeFreshQuotes(currentCustom[key], freshData);
        });
        return next;
      });
    }
  };

  const fetchData = async () => {
    const cachedData = sessionStorage.getItem('stockListData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setData(parsedData);
        refreshGroupsQuotes(parsedData);

        setLoading(false);
        return;
      } catch (error) {
        console.log('解析缓存数据失败', error);
      }
    }

    setLoading(true);
    try {
      let response;
      try {
        response = await apiClient.get('/api/public/stock_zh_a_spot');
      } catch {
        // 
      }
      console.log('个股列表 -> response', response);
      const newData = response?.data?.map((item: any, index: number) => ({
        ...item,
        序号: item.序号 || index + 1,
      })) || [];
      setData(newData);
      refreshGroupsQuotes(newData);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  // 同步自选股票到 localStorage
  const saveSelectedStocks = (stocks: StockData[]) => {
    localStorage.setItem('OutTrading-selectedStocks', JSON.stringify(stocks));
  };

  // 计算推荐买点（定量 + 月&季百分位 + 月RSI6百分位 + 周RSI6百分位）
  const fetchStockDetailAndCalculate = async (symbol: string): Promise<{
    quantitative: string;
    percentile: string;
    monthlyPercentile: string;
    weeklyPercentile: string;
  }> => {
    try {
      // 9 开头 bj, 6 开头 sh, 0 开头 sz
      const prefix = symbol.startsWith('9')
        ? 'bj'
        : symbol.startsWith('6')
          ? 'sh'
          : symbol.startsWith('0')
            ? 'sz'
            : '';
      const params: Record<string, string> = {
        symbol: prefix ? `${prefix}${symbol}` : symbol,
        adjust: 'hfq',
      };
      const response = await apiClient.get('/api/public/stock_zh_a_hist_tx', { params });
      const stockHistoryList = response?.data?.map((item: Record<string, unknown>) => ({
        日期: item.date,
        收盘: Number(item.close),
      })) || [];

      // 1) 计算日/周/月/季 K 线的 RSI6 值
      const periodRSIMap = calculatePeriodRSI(stockHistoryList);

      // 2) 合并为带推荐级别的图表数据
      const chartData = computeRSIRecommendations(periodRSIMap, 'stock') as ChartRow[];

      // 3) 过滤出推荐买点
      const buyPointList = chartData.filter(
        (row): row is BuyPointRow => row.__recommendationLevel__ != null,
      );

      // 定量买点日期
      const quantitative = buyPointList?.reverse()?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(',') || '';

      // 4) 百分位策略买点（月&季 RSI6 共振），股票为真实价格口径
      const percentileBuyPoints = computeMonthlyQuarterlyPercentileBuyPoints({
        monthlyRSI6Data: periodRSIMap.monthlyRSI,
        quarterlyRSI6Data: periodRSIMap.quarterlyRSI,
        closeValueType: 'price',
      });
      const percentile = percentileBuyPoints.map(p => moment(p.日期).format('YYYY-MM-DD')).join(',');

      // 5) 月 RSI6 百分位策略：取每笔配对交易的第一次买入（建仓）日期
      const monthlyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.monthlyRSI,
        buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
        sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      // 6) 周 RSI6 百分位策略：取每笔配对交易的第一次买入（建仓）日期
      const weeklyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.weeklyRSI,
        buyPercentile: WEEKLY_RSI_BUY_PERCENTILE,
        sellPercentile: WEEKLY_RSI_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      return { quantitative, percentile, monthlyPercentile, weeklyPercentile };
    } catch (error) {
      console.log('Error fetching stock detail:', error);
      return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
    }
  };

  const handleCalculateRecommendation = async (groupKey: string) => {
    let working = [...getGroupStocks(groupKey)];
    await runRecommendationBatchCalculation({
      targets: selectedRows,
      getKey: stock => String(stock['代码']),
      getName: stock => stock['名称'] || String(stock['代码']),
      emptyWarn: '请选择股票',
      fetchBuyPoints: stock => fetchStockDetailAndCalculate(String(stock['代码'])),
      onItemDone: (stock, { quantitative, percentile, monthlyPercentile, weeklyPercentile }) => {
        working = working.map(s =>
          s['代码'] === stock['代码']
            ? {
              ...s,
              __推荐买点定量__: quantitative || '',
              __推荐买点百分位__: percentile || '',
              __月RSI6百分位__: monthlyPercentile || '',
              __周RSI6百分位__: weeklyPercentile || '',
            }
            : s,
        );
        // 每算完一只即更新表格与本地缓存，结果渐进可见
        if (groupKey === SELECTED_TAB_KEY) {
          selectedStocksRef.current = working;
        } else {
          customStocksMapRef.current = { ...customStocksMapRef.current, [groupKey]: working };
        }
        saveGroupStocks(groupKey, working);
      },
    });
  };

  // 判断股票是否已在某分组内
  const isInGroup = (groupKey: string, code: string): boolean =>
    getGroupStocks(groupKey).some(s => s['代码'] === code);

  // 点击菜单项：在目标分组间切换归属（复制归属，不影响当前分组）
  const toggleGroupMembership = (record: StockData, targetKey: string) => {
    if (isInGroup(targetKey, record['代码'])) {
      removeFromGroup(targetKey, record);
    } else {
      addToGroup(targetKey, record);
    }
  };

  // 构建"加入到其他分组"菜单：自选（若当前不在自选 tab）+ 其余自定义分组；已在该分组显示绿 ✓
  const buildCrossGroupMenuItems = (record: StockData, excludeKey?: string) => {
    const items: NonNullable<MenuProps['items']> = [];
    if (excludeKey !== SELECTED_TAB_KEY) {
      items.push({
        key: SELECTED_TAB_KEY,
        label: SELECTED_TAB_LABEL,
        icon: isInGroup(SELECTED_TAB_KEY, record['代码'])
          ? <CheckOutlined style={{ color: '#52c41a' }} />
          : null,
      });
    }
    const customItems = customTabs
      .filter(tab => tab.key !== excludeKey)
      .map(tab => ({
        key: tab.key,
        label: tab.label,
        icon: isInGroup(tab.key, record['代码'])
          ? <CheckOutlined style={{ color: '#52c41a' }} />
          : null,
      }));
    if (items.length > 0 && customItems.length > 0) {
      items.push({ type: 'divider' });
    }
    return [...items, ...customItems];
  };

  const columns: any[] = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter('序号'),
    },
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 100,
      fixed: 'left' as const,
      sorter: stringSorter('代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索代码"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: StockData) => {
        return record.代码.toLowerCase().includes(value.toLowerCase());
      },
      render: (text: string, record: StockData) => (
        <a onClick={() => window.open(`/stock/a/stock/detail?symbol=${text}&name=${encodeURIComponent(record.名称 || '')}`, '_blank')}>{text}</a>
      ),
    },
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 120,
      fixed: 'left' as const,
      sorter: stringSorter('名称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索名称"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: StockData) => {
        return record.名称.toLowerCase().includes(value.toLowerCase());
      },
      render: (text: string, record: StockData) => (
        <Link onClick={() => handleNavigateToDetail(record)}>{text}</Link>
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
      width: 120,
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
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',')?.reverse()?.filter(d => d.trim());
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
      width: 120,
      sorter: stringSorter('__推荐买点定量__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',')?.filter(d => d.trim());
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
      title: '买入',
      dataIndex: '买入',
      key: '买入',
      width: 100,
      sorter: numberSorter('买入'),
    },
    {
      title: '卖出',
      dataIndex: '卖出',
      key: '卖出',
      width: 100,
      sorter: numberSorter('卖出'),
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
      title: '成交量(股)',
      dataIndex: '成交量',
      key: '成交量',
      width: 120,
      sorter: numberSorter('成交量'),
    },
    {
      title: '成交额(元)',
      dataIndex: '成交额',
      key: '成交额',
      width: 120,
      sorter: numberSorter('成交额'),
    },

    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_, record: StockData) => {
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
                menu={{
                  items: crossMenuItems,
                  onClick: ({ key }) => toggleGroupMembership(record, String(key)),
                }}
              >
                <Button size="small" title={hasTargets ? '加入到其他分组（不影响当前分组）' : '请先新建分组'}>
                  加入到
                </Button>
              </Dropdown>
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
        }

        // 全部 A 股列表：添加到自选 + 添加到自定义分组
        const isSelected = selectedStocks.some(s => s['代码'] === record['代码']);
        const groupMenuItems: NonNullable<MenuProps['items']> = customTabs.map(tab => ({
          key: tab.key,
          label: tab.label,
          icon: isInGroup(tab.key, record['代码'])
            ? <CheckOutlined style={{ color: '#52c41a' }} />
            : null,
        }));
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
              disabled={customTabs.length === 0}
              menu={{
                items: groupMenuItems,
                onClick: ({ key }) => toggleGroupMembership(record, String(key)),
              }}
            >
              <Button size="small" title={customTabs.length === 0 ? '请先新建分组' : undefined}>
                加入分组
              </Button>
            </Dropdown>
          </div>
        );
      },
    },
  ];

  // 自选 / 自定义分组共用的内容：批量计算入口 + 分组股票表格
  const renderGroupContent = (groupKey: string) => (
    <>
      <div
        onClick={() => handleCalculateRecommendation(groupKey)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 20px',
          marginBottom: 16,
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
        dataSource={getGroupStocks(groupKey)}
        rowKey="代码"
        scroll={{ x: 3000, y: 'calc(100vh - 200px)' }}
        pagination={false}
      />
    </>
  );

  return (
    <div style={{ padding: '24px' }}>
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
        <span
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 600,
            color: '#1890ff',
            background: 'rgba(24,144,255,0.1)',
            border: '1px solid rgba(24,144,255,0.25)',
            borderRadius: 999,
            padding: '3px 12px',
          }}
        >
          非交易时间
        </span>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        tabBarExtraContent={
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setNewTabName('');
              setCreateOpen(true);
            }}
          >
            新建分组
          </Button>
        }
      >
        <TabPane tab="沪深京A股（非交易时间）" key={ALL_TAB_KEY}>
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
            scroll={{ x: 3000, y: 'calc(100vh - 250px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total: number) => `共 ${total} 条`,
              onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
            }}
          />
        </TabPane>
        <TabPane tab={SELECTED_TAB_LABEL} key={SELECTED_TAB_KEY}>
          {activeTab === SELECTED_TAB_KEY ? renderGroupContent(SELECTED_TAB_KEY) : null}
        </TabPane>
        {customTabs.map(tab => (
          <TabPane tab={renderCustomTabLabel(tab)} key={tab.key}>
            {activeTab === tab.key ? renderGroupContent(tab.key) : null}
          </TabPane>
        ))}
      </Tabs>

      <Modal
        title="新建分组"
        open={createOpen}
        okText="创建"
        cancelText="取消"
        onOk={handleCreateTab}
        onCancel={() => setCreateOpen(false)}
      >
        <Input
          placeholder="请输入分组名称"
          value={newTabName}
          maxLength={12}
          showCount
          autoFocus
          onChange={e => setNewTabName(e.target.value)}
          onPressEnter={handleCreateTab}
        />
      </Modal>
    </div>
  );
};

export default OutTrading;
