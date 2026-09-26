import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Card, Spin, Typography } from 'antd';
import type { TablePaginationConfig } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
const RsiFilterMark = React.lazy(() => import('@/pages/stock/a/stock/detail/components/RsiFilterMark'));
import { message } from 'antd';

const { Title } = Typography;

interface HistData extends Record<string, unknown> {
  日期: string;
  代码: string;
  名称: string;
  今开: number;
  最新价: number;
  最高: number;
  最低: number;
  振幅: number;
}

const GlobalIndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const [data, setData] = useState<HistData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (sym: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_global_hist_em', {
        params: { symbol: sym },
      });
      console.log('全球指数历史 -> response', response);
      setData(response?.data?.map((item:any ) => ({
        日期: item.日期,
        收盘: Number(item.最新价),
      })));
    } catch (error) {
      console.log('error', error);
      message.error('获取详情失败');
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
      <Title level={4} style={{ marginTop: 0 }}>{symbol || '全球指数详情'}</Title>
      <Spin spinning={loading}>
        {useMemo(() => <RsiFilterMark data={data} type="index" />, [data])}
      </Spin>
    </Card>
  );
};

export default GlobalIndexDetail;
