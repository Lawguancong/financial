import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Spin, Input, Typography, Tabs } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

const { Link } = Typography;

interface FundData {
  序号: number;
  姓名: string;
  所属公司: string;
  现任基金代码: string;
  现任基金: string;
  累计从业时间: number; // 天
  现任基金资产总规模: number; // 亿元
  现任基金最佳回报: number; // %
}

const FundOpen: React.FC = () => {
  const [data, setData] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });
  const fetchFundData = async () => {
    // todo
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_manager_em',);
      console.log('基金经理 -> response', response);
      setData(response?.data?.map((item, idx) => ({
        ...item,
        id: idx,
        ['从业年限']: (item['累计从业时间'] / 365),
      })));
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };



  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 40,
      fixed: 'left' as const,
    },
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '姓名',
      dataIndex: '姓名',
      key: '姓名',
      width: 120,
      fixed: 'left' as const,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入姓名"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['姓名'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '所属公司',
      dataIndex: '所属公司',
      key: '所属公司',
      width: 120,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入所属公司"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['所属公司'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '现任基金代码',
      dataIndex: '现任基金代码',
      key: '现任基金代码',
      width: 120,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['现任基金代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },

    {
      title: '现任基金',
      dataIndex: '现任基金',
      key: '现任基金',
      width: 200,
      render: (name: string, record: FundData) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${record['现任基金代码']}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['现任基金'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
    },
    {
      title: '从业年限(年)',
      dataIndex: '从业年限',
      key: '从业年限',
      width: 100,
      sorter: numberSorter('从业年限'),
      render: (value: number) => value?.toFixed(1),
      ...createRangeFilter('从业年限'),
    },
        {
      title: '现任基金资产总规模(亿元)',
      dataIndex: '现任基金资产总规模',
      key: '现任基金资产总规模',
      width: 100,
      sorter: numberSorter('现任基金资产总规模'),
      render: (value: number) => value?.toFixed(1),
      ...createRangeFilter('现任基金资产总规模'),
    },
        {
      title: '现任基金最佳回报(%)',
      dataIndex: '现任基金最佳回报',
      key: '现任基金最佳回报',
      width: 100,
      sorter: numberSorter('现任基金最佳回报'),
      render: (value: number) => value?.toFixed(1),
      ...createRangeFilter('现任基金最佳回报'),
    },

  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Button type="primary" onClick={fetchFundData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        <Card>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            scroll={{ x: 2000 }}
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
