import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Typography } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import {
  computeRSIRecommendations,
  calculatePeriodRSI,
  computeMonthlyQuarterlyPercentileBuyPoints,
  computeSinglePeriodPercentileTrades,
  WEEKLY_RSI_BUY_PERCENTILE,
  WEEKLY_RSI_SELL_PERCENTILE,
  MONTHLY_RSI_PCT_BUY_PERCENTILE,
  MONTHLY_RSI_PCT_SELL_PERCENTILE,
  isRecentDate,
} from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';

const { Link } = Typography;

/** 买点结果 localStorage 缓存键 */
const BUY_POINT_CACHE_KEY = 'commodityBuyPointsCache';

/** 单品种缓存的买点字段 */
type CommodityBuyPointCache = Pick<
  CommodityIndexData,
  '__推荐买点定量__' | '__推荐买点百分位__' | '__月RSI6百分位__' | '__周RSI6百分位__'
>;

interface CommodityIndexData {
  序号: number;
  品种: string;
  中文名: string;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  __月RSI6百分位__?: string;
  __周RSI6百分位__?: string;
}

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
  const [data, setData] = useState<CommodityIndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<CommodityIndexData[]>([]);
  // 买点结果持久化缓存：品种 -> 四类买点（刷新页面/重进后回填，避免重复计算）
  const [buyPointCache, setBuyPointCache] = useState<Record<string, CommodityBuyPointCache>>({});

  // 从 localStorage 读取买点缓存
  const loadBuyPointCache = (): Record<string, CommodityBuyPointCache> => {
    try {
      const raw = localStorage.getItem(BUY_POINT_CACHE_KEY);
      return raw ? JSON.parse(raw) as Record<string, CommodityBuyPointCache> : {};
    } catch (error) {
      console.log('读取大宗商品买点缓存失败:', error);
      return {};
    }
  };

  // 写入买点缓存到 localStorage
  const saveBuyPointCache = (cache: Record<string, CommodityBuyPointCache>) => {
    try {
      localStorage.setItem(BUY_POINT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.log('保存大宗商品买点缓存失败:', error);
    }
  };

  // 品种代码到中文名称的映射
  const getCommodityName = (code: string): string => {
    const nameMap: Record<string, string> = {
      'Au99.99': '黄金99.99',
      'Au99.95': '黄金99.95',
      'Au100g': '黄金100克',
      'Pt99.95': '铂金99.95',
      'Ag(T+D)': '白银(T+D)',
      'Au(T+D)': '黄金(T+D)',
      'mAu(T+D)': '迷你黄金(T+D)',
      'Au(T+N1)': '黄金(T+N1)',
      'Au(T+N2)': '黄金(T+N2)',
      'Ag99.99': '白银99.99',
      'iAu99.99': '国际板黄金99.99',
      'Au99.5': '黄金99.5',
      'iAu100g': '国际板黄金100克',
      'iAu99.5': '国际板黄金99.5',
      'PGC30g': '钯金30克',
      'NYAuTN06': '纽约金TN06',
      'NYAuTN12': '纽约金TN12'
    };
    return nameMap[code] || code;
  };

  // 跳转到详情页面
  const handleNavigateToDetail = (symbol: string) => {
    window.open(`/commodity/cn/index/detail?symbol=${encodeURIComponent(symbol)}`, '_blank');
  };

  const fetchData = async (cacheOverride?: Record<string, CommodityBuyPointCache>) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/spot_symbol_table_sge');
      console.log('大宗商品指数 -> response', response);
      const rawData = response?.data || [];
      // 买点优先用入参缓存（初次加载），否则用当前 state 缓存（手动刷新），按品种回填
      const cache = cacheOverride ?? buyPointCache;
      const parsedData = rawData.map((item: Omit<CommodityIndexData, '中文名'>) => {
        const existed = cache[item.品种];
        return {
          ...item,
          中文名: getCommodityName(item.品种),
          __推荐买点定量__: existed?.__推荐买点定量__,
          __推荐买点百分位__: existed?.__推荐买点百分位__,
          __月RSI6百分位__: existed?.__月RSI6百分位__,
          __周RSI6百分位__: existed?.__周RSI6百分位__,
        };
      });
      setData(parsedData);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 先读取持久化买点缓存，再拉列表并回填（避免首屏算过的买点丢失）
    const cached = loadBuyPointCache();
    setBuyPointCache(cached);
    fetchData(cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 计算单个品种的四类推荐买点（定量 + 百分位 + 月/周 RSI6 百分位策略）
  const fetchCommodityAndCalculate = async (
    symbol: string,
  ): Promise<{ quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }> => {
    try {
      const response = await apiClient.get('/api/public/spot_hist_sge', {
        params: { symbol },
      });
      const stockHistoryList =
        (response?.data || [])
          .map((item: Record<string, unknown>) => ({
            日期: String(item.date).slice(0, 10),
            收盘: Number(item.close),
          }))
          .filter((item: { 日期: string; 收盘: number }) => Number.isFinite(item.收盘)) ?? [];

      // 接口无数据或收盘价全为 0 时无分析意义，直接跳过 RSI/买点计算（结果为空，也不写入缓存）
      const hasValidPrice = stockHistoryList.length > 0
        && stockHistoryList.some((item: { 日期: string; 收盘: number }) => item.收盘 !== 0);
      if (!hasValidPrice) {
        console.warn(`品种【${symbol}】历史收盘价全为 0 或无数据，跳过买点计算`);
        return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
      }

      // 1) 计算日/周/月/季 K 线的 RSI6 值
      const periodRSIMap = calculatePeriodRSI(stockHistoryList);

      // 2) 合并为带推荐级别的数据，过滤出推荐买点并取每月最晚一条
      const chartData = computeRSIRecommendations(periodRSIMap, 'commodity');
      const buyPointList = chartData.filter(row => row.__recommendationLevel__ != null);
      const quantitative = convertToMonthlyData(buyPointList)
        .reverse()
        .map(item => moment(item['日期']).format('YYYY-MM-DD'))
        .join(',');

      // 3) 百分位策略买点（月&季 RSI6 共振）
      const percentile = computeMonthlyQuarterlyPercentileBuyPoints({
        monthlyRSI6Data: periodRSIMap.monthlyRSI,
        quarterlyRSI6Data: periodRSIMap.quarterlyRSI,
        closeValueType: 'price',
      }).map(p => moment(p.日期).format('YYYY-MM-DD')).join(',');

      // 4) 月RSI6 百分位策略（月单周期，买入分位 3%）：取每笔配对的第一次买入日期
      const monthlyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.monthlyRSI,
        buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
        sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      // 5) 周RSI6 百分位策略（周单周期，买入分位 1%）：取每笔配对的第一次买入日期
      const weeklyPercentile = computeSinglePeriodPercentileTrades({
        rsiData: periodRSIMap.weeklyRSI,
        buyPercentile: WEEKLY_RSI_BUY_PERCENTILE,
        sellPercentile: WEEKLY_RSI_SELL_PERCENTILE,
        closeValueType: 'price',
      }).map(t => moment(t.buyDate).format('YYYY-MM-DD')).join(',');

      return { quantitative, percentile, monthlyPercentile, weeklyPercentile };
    } catch (error) {
      console.log('Error fetching commodity detail:', error);
      return { quantitative: '', percentile: '', monthlyPercentile: '', weeklyPercentile: '' };
    }
  };

  // 仅对勾选的品种批量计算买点，逐行回填
  const handleCalculateRecommendation = async () => {
    setCalculating(true);
    // 基于当前缓存累积本次结果，批量结束后一次性持久化（避免逐只频繁写 localStorage）
    const nextCache: Record<string, CommodityBuyPointCache> = { ...buyPointCache };
    try {
      await runRecommendationBatchCalculation({
        targets: selectedRows,
        getKey: item => String(item['品种']),
        getName: item => item['中文名'] || String(item['品种']),
        emptyWarn: '请勾选需要计算买点的品种',
        fetchBuyPoints: item => fetchCommodityAndCalculate(String(item['品种'])),
        onItemDone: (item, result) => {
          // 空结果不覆盖已有缓存
          const entry: CommodityBuyPointCache = {
            ...(nextCache[item.品种] ?? {}),
          };
          if (result.quantitative) entry.__推荐买点定量__ = result.quantitative;
          if (result.percentile) entry.__推荐买点百分位__ = result.percentile;
          if (result.monthlyPercentile) entry.__月RSI6百分位__ = result.monthlyPercentile;
          if (result.weeklyPercentile) entry.__周RSI6百分位__ = result.weeklyPercentile;
          nextCache[item.品种] = entry;

          setData(prev =>
            prev.map(row =>
              row.品种 === item.品种
                ? {
                  ...row,
                  __推荐买点定量__: entry.__推荐买点定量__ ?? row.__推荐买点定量__,
                  __推荐买点百分位__: entry.__推荐买点百分位__ ?? row.__推荐买点百分位__,
                  __月RSI6百分位__: entry.__月RSI6百分位__ ?? row.__月RSI6百分位__,
                  __周RSI6百分位__: entry.__周RSI6百分位__ ?? row.__周RSI6百分位__,
                }
                : row,
            ),
          );
        },
      });
      setBuyPointCache(nextCache);
      saveBuyPointCache(nextCache);
    } finally {
      setCalculating(false);
    }
  };

  const columns = useMemo(() => [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 70,
      sorter: (a: CommodityIndexData, b: CommodityIndexData) => a.序号 - b.序号,
    },
    {
      title: '品种',
      dataIndex: '品种',
      key: '品种',
      width: 110,
    },
    {
      title: '中文名',
      dataIndex: '中文名',
      key: '中文名',
      width: 160,
      render: (text: string, record: CommodityIndexData) => (
        <Link onClick={() => handleNavigateToDetail(record.品种)}>{text}</Link>
      ),
    },
    {
      title: '推荐买点（百分位）',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 160,
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
      width: 160,
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
      width: 160,
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
      width: 160,
      render: renderBuyPointTags({
        backgroundColor: '#e6fffb',
        color: '#08979c',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #87e8de',
      }),
    },
  ], []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', textAlign: 'right' }}>
        <Button
          type="primary"
          onClick={handleCalculateRecommendation}
          loading={calculating}
          style={{ marginRight: 12 }}
        >
          计算勾选品种买点（已选 {selectedRows.length} 个）
        </Button>
        <Button type="default" onClick={() => fetchData()} loading={loading}>
          刷新数据
        </Button>
      </div>
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: (newKeys, newRows) => {
            setSelectedRowKeys(newKeys);
            setSelectedRows(newRows);
          },
        }}
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="序号"
        scroll={{ x: 1200, y: 'calc(100vh - 200px)' }}
        pagination={false}
      />
    </div>
  );
};

export default Index;
