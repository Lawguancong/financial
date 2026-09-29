import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter } from '@/utils/tableUtils';

interface IndexFundData {
  [key: string]: string | number;
}

const IndexFund: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('全部');
  const [indicator, setIndicator] = useState<string>('全部');
  const [data, setData] = useState<IndexFundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const symbolOptions = [
    { label: '全部', value: '全部' },
    { label: '沪深指数', value: '沪深指数' },
    { label: '行业主题', value: '行业主题' },
    { label: '大盘指数', value: '大盘指数' },
    { label: '中盘指数', value: '中盘指数' },
    { label: '小盘指数', value: '小盘指数' },
    { label: '股票指数', value: '股票指数' },
    { label: '债券指数', value: '债券指数' },
  ];

  const indicatorOptions = [
    { label: '全部', value: '全部' },
    { label: '被动指数型', value: '被动指数型' },
    { label: '增强指数型', value: '增强指数型' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_info_index_em', {
        params: { symbol, indicator },
      });
      console.log('指数型基金 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, indicator]);

  const columns = [
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 100,
      fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金代码'),
    },
    {
      title: '基金名称',
      dataIndex: '基金名称',
      key: '基金名称',
      width: 260,
      fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金名称'),
    },
    {
      title: '单位净值',
      dataIndex: '单位净值',
      key: '单位净值',
      width: 100,
      sorter: numberSorter<IndexFundData>('单位净值'),
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      sorter: stringSorter<IndexFundData>('日期'),
    },
    {
      title: '日增长率',
      dataIndex: '日增长率',
      key: '日增长率',
      width: 100,
      sorter: numberSorter<IndexFundData>('日增长率'),
    },
    {
      title: '近1周',
      dataIndex: '近1周',
      key: '近1周',
      width: 80,
      sorter: numberSorter<IndexFundData>('近1周'),
    },
    {
      title: '近1月',
      dataIndex: '近1月',
      key: '近1月',
      width: 80,
      sorter: numberSorter<IndexFundData>('近1月'),
    },
    {
      title: '近3月',
      dataIndex: '近3月',
      key: '近3月',
      width: 80,
      sorter: numberSorter<IndexFundData>('近3月'),
    },
    {
      title: '近6月',
      dataIndex: '近6月',
      key: '近6月',
      width: 80,
      sorter: numberSorter<IndexFundData>('近6月'),
    },
    {
      title: '近1年',
      dataIndex: '近1年',
      key: '近1年',
      width: 80,
      sorter: numberSorter<IndexFundData>('近1年'),
    },
    {
      title: '近2年',
      dataIndex: '近2年',
      key: '近2年',
      width: 80,
      sorter: numberSorter<IndexFundData>('近2年'),
    },
    {
      title: '近3年',
      dataIndex: '近3年',
      key: '近3年',
      width: 80,
      sorter: numberSorter<IndexFundData>('近3年'),
    },
    {
      title: '今年来',
      dataIndex: '今年来',
      key: '今年来',
      width: 90,
      sorter: numberSorter<IndexFundData>('今年来'),
    },
    {
      title: '成立来',
      dataIndex: '成立来',
      key: '成立来',
      width: 90,
      sorter: numberSorter<IndexFundData>('成立来'),
    },
    {
      title: '手续费',
      dataIndex: '手续费',
      key: '手续费',
      width: 80,
      sorter: numberSorter<IndexFundData>('手续费'),
    },
    {
      title: '起购金额',
      dataIndex: '起购金额',
      key: '起购金额',
      width: 100,
      sorter: stringSorter<IndexFundData>('起购金额'),
    },
    {
      title: '跟踪标的',
      dataIndex: '跟踪标的',
      key: '跟踪标的',
      width: 200,
      sorter: stringSorter<IndexFundData>('跟踪标的'),
    },
    {
      title: '跟踪方式',
      dataIndex: '跟踪方式',
      key: '跟踪方式',
      width: 100,
      sorter: stringSorter<IndexFundData>('跟踪方式'),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          style={{ width: 140 }}
          value={symbol}
          onChange={setSymbol}
          options={symbolOptions}
        />
        <Select
          style={{ width: 140 }}
          value={indicator}
          onChange={setIndicator}
          options={indicatorOptions}
        />
        <Button type="primary" onClick={fetchData}>
          刷新数据
        </Button>
      </div>
      <Table
        rowKey="基金代码"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 2200 }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize });
          },
        }}
      />
    </Card>
  );
};

export default IndexFund;
