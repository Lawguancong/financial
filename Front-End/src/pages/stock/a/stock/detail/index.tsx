import React, { useEffect, useState, useMemo, useCallback, Suspense, memo } from 'react';
import { Spin, Typography, Card, Radio, Tabs } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';

// 懒加载组件，按需加载
const PriceAndTurnover = React.lazy(() => import('./components/PriceAndTurnover'));
const RsiFilterMark = React.lazy(() => import('./components/RsiFilterMark'));
const ThreeConsecutiveRisesComponent = React.lazy(() => import('./components/ThreeConsecutiveRises'));
const RsiPeriods = React.lazy(() => import('./components/RsiPeriods'));
const Valuation = React.lazy(() => import('./components/Valuation'));

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  股票代码: string;
  开盘: number;
  收盘: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  振幅: number;
  涨跌幅: number;
  涨跌额: number;
  换手率: number;
}

// 组件加载时的 fallback - 使用 memo 避免重复渲染
const ComponentFallback = memo(() => (
  <div style={fallbackStyle}>
    <Spin size="small" />
  </div>
));

const fallbackStyle: React.CSSProperties = { 
  height: 400, 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center' 
};

// 静态样式配置，避免每次渲染创建新对象
const headerCardStyle: React.CSSProperties = { marginBottom: '16px' };
const headerFlexStyle: React.CSSProperties = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center' 
};
const radioGroupStyle: React.CSSProperties = { display: 'flex', gap: '16px' };
const cardStyle: React.CSSProperties = { marginTop: '16px' };
const pageStyle: React.CSSProperties = { padding: '24px' };
const titleStyle: React.CSSProperties = { margin: 0 };

const StockDetail: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [adjust, setAdjust] = useState<string>('hfq');
  const [period, setPeriod] = useState<string>('daily');
  const [symbolInfo, setSymbolInfo] = useState<Record<string, string>>({});
  const [rawData, setRawData] = useState<StockDetailData[]>([]);
  const [activeTab, setActiveTab] = useState<string>('valuation');

  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '';

  // 缓存股票基本信息
  const stockTitle = useMemo(() => ({
    name: symbolInfo?.['股票简称'] || '',
    code: symbolInfo?.['股票代码'] || symbol,
  }), [symbolInfo, symbol]);

  // 数据获取函数 - 使用 useCallback 缓存
  const fetchStockDetail = useCallback(async () => {
    if (!symbol) return;
    
    setLoading(true);
    try {
      const params: Record<string, string> = { symbol, period };
      if (adjust) params.adjust = adjust;

      const [response1, response2] = await Promise.all([
        apiClient.get('/api/public/stock_zh_a_hist', { params }),
        apiClient.get('/api/public/stock_individual_info_em', { params: { symbol } }),
      ]);

      const newData = response1?.data || [];
      // 当 adjust 变化时，即使日期范围相同，也需要更新数据
      setRawData(newData);

      const newSymbolInfo = response2?.data?.reduce(
        (acc: Record<string, string>, curr: { item: string; value: string }) => {
          acc[curr.item] = curr.value;
          return acc;
        },
        {}
      ) || {};
      
      setSymbolInfo(prev => {
        if (prev['股票简称'] === newSymbolInfo['股票简称'] && 
            prev['股票代码'] === newSymbolInfo['股票代码']) {
          return prev;
        }
        return newSymbolInfo;
      });
    } catch (error) {
      console.error('fetchStockDetail error:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, adjust]);

  useEffect(() => {
    fetchStockDetail();
  }, [fetchStockDetail]);

  // 事件处理函数 - 使用 useCallback 缓存
  const handlePeriodChange = useCallback((e: RadioChangeEvent) => setPeriod(e.target.value), []);
  const handleAdjustChange = useCallback((e: RadioChangeEvent) => setAdjust(e.target.value), []);
  const handleTabChange = useCallback((key: string) => setActiveTab(key), []);

  // 缓存子组件渲染 - 避免每次渲染重新创建
  const priceAndTurnoverComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <PriceAndTurnover data={rawData} />
    </Suspense>
  ), [rawData]);

  const rsiFilterMarkComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <RsiFilterMark data={rawData} />
    </Suspense>
  ), [rawData]);

  const rsiPeriodsComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <RsiPeriods data={rawData} />
    </Suspense>
  ), [rawData]);

  const threeConsecutiveRisesComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <ThreeConsecutiveRisesComponent data={rawData} />
    </Suspense>
  ), [rawData]);

  const valuationComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <Valuation symbol={symbol} />
    </Suspense>
  ), [symbol]);

  // 缓存 Tabs 配置
  const tabItems = useMemo(() => [
    {
      key: 'price-turnover',
      label: '价格&回撤率&年化收益率',
      children: (
        <Card style={cardStyle}>
          <Title level={5}>价格&回撤率&年化收益率</Title>
          {priceAndTurnoverComponent}
        </Card>
      ),
    },
    {
      key: 'valuation',
      label: '估值',
      children: (
        <Card style={cardStyle}>
          <Title level={5}>估值指标</Title>
          {valuationComponent}
        </Card>
      ),
    },
    {
      key: 'rsi-filter',
      label: 'RSI6 超卖（日k/后复权）',
      children: (
        <>
          <Card style={cardStyle}>
            <Title level={5}>RSI6 超卖（日k/后复权）</Title>
            {rsiFilterMarkComponent}
          </Card>
          <Card style={cardStyle}>
            <Title level={5}>不同周期 RSI6</Title>
            {rsiPeriodsComponent}
          </Card>
        </>
      ),
    },
    {
      key: 'three-rises',
      label: '低换手三连阳（日k/后复权）',
      children: (
        <Card style={cardStyle}>
          <Title level={5}>低换手三连阳（日k/后复权）</Title>
          {threeConsecutiveRisesComponent}
        </Card>
      ),
    },
  ], [priceAndTurnoverComponent, rsiFilterMarkComponent, rsiPeriodsComponent, threeConsecutiveRisesComponent]);

  return (
    <div style={pageStyle}>
      <Card style={headerCardStyle}>
        <div style={headerFlexStyle}>
          <Title level={4} style={titleStyle}>
            {stockTitle.name}({stockTitle.code})
          </Title>
          <div style={radioGroupStyle}>
            <Radio.Group value={period} onChange={handlePeriodChange}>
              <Radio.Button value="daily">日K</Radio.Button>
              <Radio.Button value="weekly">周K</Radio.Button>
              <Radio.Button value="monthly">月K</Radio.Button>
            </Radio.Group>
            <Radio.Group value={adjust} onChange={handleAdjustChange}>
              <Radio.Button value="">不复权</Radio.Button>
              <Radio.Button value="qfq">前复权</Radio.Button>
              <Radio.Button value="hfq">后复权</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </Card>
      <Spin spinning={loading}>
        <Tabs 
          // defaultActiveKey="rsi-filter" 
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          destroyInactiveTabPane={false}
        />
      </Spin>
    </div>
  );
};

export default memo(StockDetail);
