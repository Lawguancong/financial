import React, { useEffect, useState } from 'react';
import { Table, Card, Spin, Select, Space } from 'antd';
import type { TablePaginationConfig } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
const RsiFilterMark = React.lazy(() => import('@/pages/stock/a/stock/detail/components/RsiFilterMark'));

interface IndexData extends Record<string, unknown> {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

const indexOptions = [
  { label: '标普500指数', value: '.INX' },
  { label: '纳斯达克综合指数', value: '.IXIC' },
  { label: '道琼斯工业指数', value: '.DJI' },
  { label: '纳斯达克100指数', value: '.NDX' },
];

const UsIndexPage: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState<string>('.INX');
  // const [pagination, setPagination] = useState<TablePaginationConfig>({
  //   current: 1,
  //   pageSize: 20,
  // });

  const fetchData = async (sym: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_us_stock_sina', {
        params: { symbol: sym },
      });
      setData(response?.data?.map((item: AnimationPlayState) => ({
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
    // setPagination((prev) => ({ ...prev, current: 1 }));
  };

  // const columns = [
  //   {
  //     title: '日期',
  //     dataIndex: 'date',
  //     key: 'date',
  //     width: 140,
  //     sorter: stringSorter<IndexData>('date'),
  //   },
  //   {
  //     title: '开盘',
  //     dataIndex: 'open',
  //     key: 'open',
  //     sorter: numberSorter<IndexData>('open'),
  //     ...createRangeFilter<IndexData>('open'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  //   {
  //     title: '最高',
  //     dataIndex: 'high',
  //     key: 'high',
  //     sorter: numberSorter<IndexData>('high'),
  //     ...createRangeFilter<IndexData>('high'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  //   {
  //     title: '最低',
  //     dataIndex: 'low',
  //     key: 'low',
  //     sorter: numberSorter<IndexData>('low'),
  //     ...createRangeFilter<IndexData>('low'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  //   {
  //     title: '收盘',
  //     dataIndex: 'close',
  //     key: 'close',
  //     sorter: numberSorter<IndexData>('close'),
  //     ...createRangeFilter<IndexData>('close'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  //   {
  //     title: '成交量',
  //     dataIndex: 'volume',
  //     key: 'volume',
  //     sorter: numberSorter<IndexData>('volume'),
  //     ...createRangeFilter<IndexData>('volume'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  //   {
  //     title: '成交金额',
  //     dataIndex: 'amount',
  //     key: 'amount',
  //     sorter: numberSorter<IndexData>('amount'),
  //     ...createRangeFilter<IndexData>('amount'),
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } as any,
  // ];

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

      <span style={{ color: 'red' }}>todo 增加 指数/回撤率/年化收益率/波动率等</span>
      <Spin spinning={loading}>
      <RsiFilterMark data={data} />
        {/* <Table
          rowKey="date"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={pagination}
          onChange={(p) => setPagination(p)}
          scroll={{ x: 'max-content' }}
        /> */}
      </Spin>
    </Card>
  );
};

export default UsIndexPage;
