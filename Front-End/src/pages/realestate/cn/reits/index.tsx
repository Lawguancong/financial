import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import type { TablePaginationConfig } from 'antd';
import { message } from 'antd';

const { Search } = Input;

interface ReitsRealtimeData extends Record<string, unknown> {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌额: number;
  涨跌幅: number;
  成交量: number;
  成交额: number;
  开盘价: number;
  最高价: number;
  最低价: number;
  昨收: number;
}

const ReitsRealtime: React.FC = () => {
  const [data, setData] = useState<ReitsRealtimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/reits_realtime_em');
      console.log('REITs 实时数据 -> response', response);

      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map((item: Record<string, unknown>, index: number) => ({
          序号: Number(item['序号']) || index + 1,
          代码: String(item['代码'] || ''),
          名称: String(item['名称'] || ''),
          最新价: Number(item['最新价']) || 0,
          涨跌额: Number(item['涨跌额']) || 0,
          涨跌幅: Number(item['涨跌幅']) || 0,
          成交量: Number(item['成交量']) || 0,
          成交额: Number(item['成交额']) || 0,
          开盘价: Number(item['开盘价']) || 0,
          最高价: Number(item['最高价']) || 0,
          最低价: Number(item['最低价']) || 0,
          昨收: Number(item['昨收']) || 0,
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取 REITs 实时数据失败:', error);
      message.error('获取 REITs 实时数据失败(请在交易时间查询)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter<ReitsRealtimeData>('序号'),
    },
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 120,
      sorter: stringSorter<ReitsRealtimeData>('代码'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索代码"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: ReitsRealtimeData) => {
        return record.代码.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 180,
      sorter: stringSorter<ReitsRealtimeData>('名称'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索名称"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: ReitsRealtimeData) => {
        return record.名称.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: '最新价(元)',
      dataIndex: '最新价',
      key: '最新价',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('最新价'),
      ...createRangeFilter<ReitsRealtimeData>('最新价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌额(元)',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('涨跌额'),
      ...createRangeFilter<ReitsRealtimeData>('涨跌额'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌幅(%)',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('涨跌幅'),
      ...createRangeFilter<ReitsRealtimeData>('涨跌幅'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '成交量(股)',
      dataIndex: '成交量',
      key: '成交量',
      width: 180,
      sorter: numberSorter<ReitsRealtimeData>('成交量'),
      ...createRangeFilter<ReitsRealtimeData>('成交量'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '成交额(元)',
      dataIndex: '成交额',
      key: '成交额',
      width: 180,
      sorter: numberSorter<ReitsRealtimeData>('成交额'),
      ...createRangeFilter<ReitsRealtimeData>('成交额'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '开盘价(元)',
      dataIndex: '开盘价',
      key: '开盘价',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('开盘价'),
      ...createRangeFilter<ReitsRealtimeData>('开盘价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最高价(元)',
      dataIndex: '最高价',
      key: '最高价',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('最高价'),
      ...createRangeFilter<ReitsRealtimeData>('最高价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最低价(元)',
      dataIndex: '最低价',
      key: '最低价',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('最低价'),
      ...createRangeFilter<ReitsRealtimeData>('最低价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '昨收(元)',
      dataIndex: '昨收',
      key: '昨收',
      width: 140,
      sorter: numberSorter<ReitsRealtimeData>('昨收'),
      ...createRangeFilter<ReitsRealtimeData>('昨收'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ];

  return (
    <Card
      title="REITs 实时数据"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      }
    >
      <Table
        rowKey="序号"
        columns={columns}
        dataSource={data}
        loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total: number) => `共 ${total} 条`,
                onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
              }}
        onChange={(newPagination) => {
          setPagination(newPagination);
        }}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default ReitsRealtime;
