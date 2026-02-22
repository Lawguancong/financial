import React, { useState } from 'react';
import { Select, Button, Table, Card, Spin } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

interface FundData {
  序号: number;
  基金代码: string;
  基金简称: string;
  日期: string;
  单位净值: number;
  累计净值: number;
  日增长率: number;
  近1周: number;
  近1月: number;
  近3月: number;
  近6月: number;
  近1年: number;
  近2年: number;
  近3年: number;
  今年来: number;
  成立来: number;
  自定义: number;
  手续费: string;
}

const FundOpen: React.FC = () => {
  const [fundType, setFundType] = useState<string>('全部');
  const [data, setData] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current:1,
    pageSize: 20,
  });

  const fundTypeOptions = [
    { label: '全部', value: '全部' },
    { label: '股票型', value: '股票型' },
    { label: '混合型', value: '混合型' },
    { label: '债券型', value: '债券型' },
    { label: '指数型', value: '指数型' },
    { label: 'QDII', value: 'QDII' },
    { label: 'FOF', value: 'FOF' },
  ];

  const fetchFundData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8080/api/public/fund_open_fund_rank_em', {
        params: {
          symbol: fundType,
        },
      });
      console.log('开放式基金 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 200,
      fixed: 'left' as const,
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      render: (value: string) => {
        return value && moment(value).format('YYYY-MM-DD') || '-';
      },
    },
    {
      title: '单位净值',
      dataIndex: '单位净值',
      key: '单位净值',
      width: 100,
      sorter: numberSorter('单位净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('单位净值'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '累计净值',
      dataIndex: '累计净值',
      key: '累计净值',
      width: 100,
      sorter: numberSorter('累计净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('累计净值'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '日增长率',
      dataIndex: '日增长率',
      key: '日增长率',
      width: 100,
      sorter: numberSorter('日增长率'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('日增长率'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1周',
      dataIndex: '近1周',
      key: '近1周',
      width: 100,
      sorter: numberSorter('近1周'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1周'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1月',
      dataIndex: '近1月',
      key: '近1月',
      width: 100,
      sorter: numberSorter('近1月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近3月',
      dataIndex: '近3月',
      key: '近3月',
      width: 100,
      sorter: numberSorter('近3月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近6月',
      dataIndex: '近6月',
      key: '近6月',
      width: 100,
      sorter: numberSorter('近6月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近6月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1年',
      dataIndex: '近1年',
      key: '近1年',
      width: 100,
      sorter: numberSorter('近1年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近2年',
      dataIndex: '近2年',
      key: '近2年',
      width: 100,
      sorter: numberSorter('近2年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近2年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近3年',
      dataIndex: '近3年',
      key: '近3年',
      width: 100,
      sorter: numberSorter('近3年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '今年来',
      dataIndex: '今年来',
      key: '今年来',
      width: 100,
      sorter: numberSorter('今年来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('今年来'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '成立来',
      dataIndex: '成立来',
      key: '成立来',
      width: 100,
      sorter: numberSorter('成立来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('成立来'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '自定义',
      dataIndex: '自定义',
      key: '自定义',
      width: 100,
      sorter: numberSorter('自定义'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('自定义'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any,
    {
      title: '手续费',
      dataIndex: '手续费',
      key: '手续费',
      width: 150,
      sorter: numberSorter('手续费'),
      // render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('手续费'),
    },
  ];

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
      <Card style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>基金类型：</span>
            <Select
              style={{ width: 200 }}
              value={fundType}
              onChange={setFundType}
              options={fundTypeOptions}
            />
          </div>
          <Button type="primary" onClick={fetchFundData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading} style={{ flex: 1 }}>
        <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="序号"
            scroll={{ x: 2000, y: 'calc(100vh - 280px)' }}
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
        </Card>
      </Spin>
    </div>
  );
};

export default FundOpen;
