import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, Input, Button } from 'antd';
import axios from 'axios';
import moment from 'moment';

const { Link } = Typography;

interface IndexData {
  指数代码: string;
  指数简称: string;
  指数全称: string;
  发布时间: string;
  基日: string;
  基点: number;
  指数类别: string;
  指数系列: string;
  资产类别: string;
  指数币种: string;
  样本数量: number;
  最新收盘: number;
  近一个月收益率: number;
  合作指数: string;
  跟踪产品: string;
  指数合规: string;
  指数热点: string | null;
}

const stringSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) => {
  const aValue = String(a[key] || '');
  const bValue = String(b[key] || '');
  return aValue.localeCompare(bValue, 'zh-CN');
};

const Index: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const getUniqueValues = (data: IndexData[], key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => String(item[key] || ''))))
      .filter(value => value !== 'null' && value !== 'undefined')
      .sort();
  };

  const columns = useMemo(() => [
    {
      title: '指数代码',
      dataIndex: '指数代码',
      key: '指数代码',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数代码"
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['指数代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '指数简称',
      dataIndex: '指数简称',
      key: '指数简称',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数简称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数简称"
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['指数简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
      render: (name: string, record: IndexData) => (
        <Link
          onClick={() => window.open(`/stock/a/index/detail?code=${record['指数代码']}&publishDate=${record['发布时间'] ? moment(record['发布时间']).format('YYYYMMDD') : ''}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '发布时间',
      dataIndex: '发布时间',
      key: '发布时间',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('发布时间'),
      render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
    },
    {
      title: '指数类别',
      dataIndex: '指数类别',
      key: '指数类别',
      width: 60,
      sorter: stringSorter('指数类别'),
      filters: getUniqueValues(data, '指数类别').map(value => ({ text: value, value })),
      onFilter: (value: React.Key, record: IndexData) => record['指数类别']?.includes(value as string),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '基点',
      dataIndex: '基点',
      key: '基点',
      width: 60,
      sorter: stringSorter('基点'),
    },
    {
      title: '样本数量',
      dataIndex: '样本数量',
      key: '样本数量',
      width: 60,
      sorter: stringSorter('样本数量'),
    },
    {
      title: '最新收盘',
      dataIndex: '最新收盘',
      key: '最新收盘',
      width: 60,
      sorter: stringSorter('最新收盘'),
    },
  ], [data]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8080/api/public/index_csindex_all');
      console.log('指数列表 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);



  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="指数代码"
        scroll={{ x: 2000, y: 'calc(100vh - 200px)' }}
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
    </div>
  );
};

export default Index;
