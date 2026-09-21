import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Tabs, Typography, message } from 'antd';
import type { TablePaginationConfig } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import cachedData from '../../../../../Back-End/cachedData/index_global_spot_em.json';
const { Link } = Typography;

interface SpotData extends Record<string, unknown> {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌额: number;
  涨跌幅: number;
  开盘价: number;
  最高价: number;
  最低价: number;
  昨收价: number;
  振幅: number;
  最新行情时间: string;
}

const GlobalIndexPage: React.FC = () => {
  const [data, setData] = useState<SpotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
  });

  const fetchSpotData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_global_spot_em');
      console.log('全球指数实时行情 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      message.error('接口不稳定，请稍后重试。');
      message.info('读取缓存数据');
      setData(cachedData);
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpotData();
  }, []);

  const spotColumns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter<SpotData>('序号'),
    },
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 120,
      sorter: stringSorter<SpotData>('代码'),
    },
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 180,
      sorter: stringSorter<SpotData>('名称'),
      render: (name: string) => (
        <Link
          onClick={() => window.open(`/global/index/detail?symbol=${encodeURIComponent(name)}`)}
          style={{ cursor: 'pointer' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '最新价',
      dataIndex: '最新价',
      key: '最新价',
      sorter: numberSorter<SpotData>('最新价'),
      ...createRangeFilter<SpotData>('最新价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      sorter: numberSorter<SpotData>('涨跌额'),
      ...createRangeFilter<SpotData>('涨跌额'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌幅',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      sorter: numberSorter<SpotData>('涨跌幅'),
      ...createRangeFilter<SpotData>('涨跌幅'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (val: number) => <span style={{ color: val >= 0 ? '#f5222d' : '#52c41a' }}>{val?.toFixed(2)}%</span>,
    } as any,
    {
      title: '开盘价',
      dataIndex: '开盘价',
      key: '开盘价',
      sorter: numberSorter<SpotData>('开盘价'),
      ...createRangeFilter<SpotData>('开盘价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最高价',
      dataIndex: '最高价',
      key: '最高价',
      sorter: numberSorter<SpotData>('最高价'),
      ...createRangeFilter<SpotData>('最高价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最低价',
      dataIndex: '最低价',
      key: '最低价',
      sorter: numberSorter<SpotData>('最低价'),
      ...createRangeFilter<SpotData>('最低价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '昨收价',
      dataIndex: '昨收价',
      key: '昨收价',
      sorter: numberSorter<SpotData>('昨收价'),
      ...createRangeFilter<SpotData>('昨收价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '振幅',
      dataIndex: '振幅',
      key: '振幅',
      sorter: numberSorter<SpotData>('振幅'),
      ...createRangeFilter<SpotData>('振幅'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (val: number) => `${val?.toFixed(2)}%`,
    } as any,
    {
      title: '最新行情时间',
      dataIndex: '最新行情时间',
      key: '最新行情时间',
      width: 180,
      sorter: stringSorter<SpotData>('最新行情时间'),
    },
  ];

  const tabItems = [
    {
      key: 'spot',
      label: '实时行情数据',
      children: (
        <Spin spinning={loading}>
          <Table
            rowKey="序号"
            columns={spotColumns}
            dataSource={data}
            loading={loading}
            pagination={pagination}
            onChange={(p) => setPagination(p)}
            scroll={{ x: 'max-content' }}
          />
        </Spin>
      ),
    },
  ];

  return (
    <Card title="全球指数">
      <Tabs items={tabItems} />
    </Card>
  );
};

export default GlobalIndexPage;
