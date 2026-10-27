import React, { useEffect, useState } from 'react';
import { Card, Spin, Select, Space } from 'antd';
import apiClient from '@/utils/axios';
import type { KLineData } from '@/utils/stockUtils';
import IndexMetrics from '@/components/IndexMetrics';
import DailyReturnAnalysis from '@/components/DailyReturnAnalysis';
const RsiFilterMark = React.lazy(() => import('@/components/RsiFilterMark'));


const indexOptions = [
  { label: '标普500指数', value: '.INX' },
  { label: '纳斯达克综合指数', value: '.IXIC' },
  { label: '道琼斯工业指数', value: '.DJI' },
  { label: '纳斯达克100指数', value: '.NDX' },
];

const UsIndexPage: React.FC = () => {
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState<string>('.INX');

  const fetchData = async (sym: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_us_stock_sina', {
        params: { symbol: sym },
      });
      setData(response?.data?.map((item: { date: string; close: number }) => ({
      日期: item.date,
      收盘: Number(item.close),
      })) || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(symbol);
  }, [symbol]);

  const handleSymbolChange = (value: string) => {
    setSymbol(value);
  };
  return (
    <Card
      title="美股指数"
      extra={
        <Space>
          <span>指数：</span>
          <Select
            value={symbol}
            onChange={handleSymbolChange}
            style={{ width: 220 }}
            options={indexOptions}
          />
        </Space>
      }
    >

      <Spin spinning={loading}>
        <IndexMetrics data={data} />
        <RsiFilterMark data={data} type="index" />
        <DailyReturnAnalysis data={data} />
      </Spin>
    </Card>
  );
};

export default UsIndexPage;
