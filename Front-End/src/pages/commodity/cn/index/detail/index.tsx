import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Card, Spin } from 'antd';
import { useSearchParams } from 'react-router-dom';
import apiClient from '@/utils/axios';
import type { KLineData } from '@/utils/stockUtils';
import { message } from 'antd';


const IndexMetrics = React.lazy(() => import('@/components/IndexMetrics'));
const RsiFilterMark = React.lazy(() => import('@/components/RsiFilterMark'));

const { Title } = Typography;

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
    'NYAuTN12': '纽约金TN12',
  };
  return nameMap[code] || code;
};

const Detail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (sym: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/spot_hist_sge', {
        params: { symbol: sym },
      });
      setData(
        response?.data?.map((item: Record<string, unknown>) => ({
          日期: String(item.date).slice(0, 10),
          收盘: Number(item.close),
        })) ?? [],
      );
    } catch (error) {
      console.log('error', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchData(symbol);
    }
  }, [symbol]);

  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>
        {getCommodityName(symbol)} - 历史数据
      </Title>
      <Spin spinning={loading}>
        {useMemo(() => <IndexMetrics data={data} />, [data])}
        {useMemo(() => <RsiFilterMark data={data} type="commodity" />, [data])}
      </Spin>
    </Card>
  );
};

export default Detail;
