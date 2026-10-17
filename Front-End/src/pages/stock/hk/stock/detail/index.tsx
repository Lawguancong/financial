import React, { useEffect, useState, useMemo, useCallback, Suspense, memo } from 'react';
import { Spin, Typography, Card, Tabs } from 'antd';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';

// 懒加载组件，按需加载
const HkPriceAndTurnover = React.lazy(() => import('./components/HkPriceAndTurnover'));
const RsiFilterMark = React.lazy(() => import('../../../../../components/RsiFilterMark'));

const { Title } = Typography;

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
const cardStyle: React.CSSProperties = { marginTop: '16px' };
const pageStyle: React.CSSProperties = { padding: '24px' };
const titleStyle: React.CSSProperties = { margin: 0 };

const HkStockDetail: React.FC = () => {
  const [rawData, setRawData] = useState<Array<{ 日期: string; 收盘: number }>>([]);
  const [activeTab, setActiveTab] = useState<string>('rsi-filter');

  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const name = decodeURIComponent(searchParams.get('name') || '') || '';

  // 事件处理函数 - 使用 useCallback 缓存
  const handleTabChange = useCallback((key: string) => setActiveTab(key), []);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        // 港股代码为 5 位数字（如 00700），无需交易所前缀
        const params: Record<string, string> = {
          symbol,
          adjust: 'hfq',
        };
        const response = await apiClient.get('/api/public/stock_hk_daily', { params });
        setRawData(response?.data?.map((item: Record<string, unknown>) => ({
          日期: item.date,
          收盘: Number(item.close),
        })) || []);
      } catch (error) {
        console.error('Error fetching stock_hk_daily data:', error);
      }
    };
    fetchData();
  }, [symbol]);

  // 缓存子组件渲染 - 避免每次渲染重新创建
  const priceAndTurnoverComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <HkPriceAndTurnover />
    </Suspense>
  ), []);

  const rsiFilterMarkComponent = useMemo(() => (
    <Suspense fallback={<ComponentFallback />}>
      <RsiFilterMark data={rawData} type="stock" />
    </Suspense>
  ), [rawData]);

  // 缓存 Tabs 配置
  const tabItems = useMemo(() => [
    {
      key: 'price-turnover',
      label: '价格&回撤率&年化收益率',
      children: (
        <Card style={cardStyle}>
          {priceAndTurnoverComponent}
        </Card>
      ),
    },
    {
      key: 'rsi-filter',
      label: 'RSI6 技术指标',
      children: (
        <Card style={cardStyle}>
          <Title level={5}>RSI6 技术指标</Title>
          {rsiFilterMarkComponent}
        </Card>
      ),
    },
  ], [priceAndTurnoverComponent, rsiFilterMarkComponent]);

  return (
    <div style={pageStyle}>
      <Card style={headerCardStyle}>
        <Title level={4} style={titleStyle}>
          {name}({symbol})
        </Title>
      </Card>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        destroyInactiveTabPane={false}
      />
    </div>
  );
};

export default memo(HkStockDetail);
