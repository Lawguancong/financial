import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spin, Input, Button, Tag, Row, Col, Statistic } from 'antd';
import {
  BankOutlined,
  FundOutlined,
  TeamOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, createRangeFilter } from '@/utils/tableUtils';

interface FundCompany extends Record<string, unknown> {
  序号: number;
  基金公司: string;
  成立时间: string;
  全部管理规模: number | null;
  全部基金数: number;
  全部经理数: number;
  更新日期: string;
}

const FundCompany: React.FC = () => {
  const [data, setData] = useState<FundCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState<FundCompany[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_aum_em');
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map((item: Record<string, unknown>) => ({
          序号: Number(item['序号']) || 0,
          基金公司: String(item['基金公司'] || '-'),
          成立时间: String(item['成立时间'] || '-').split('T')[0],
          全部管理规模: item['全部管理规模'] ? Number(item['全部管理规模']) : null,
          全部基金数: Number(item['全部基金数']) || 0,
          全部经理数: Number(item['全部经理数']) || 0,
          更新日期: String(item['更新日期'] || '-'),
        }));
        // 过滤掉规模为null的数据
        const validData = formattedData.filter(item => item.全部管理规模 !== null);
        setData(validData);
        setFilteredData(validData);
      }
    } catch (error) {
      console.error('获取基金公司数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 搜索过滤
  useEffect(() => {
    const filtered = data.filter(item =>
      item.基金公司.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredData(filtered);
    setPagination(p => ({ ...p, current: 1 }));
  }, [searchText, data]);

  // 统计
  const stats = {
    totalCompanies: filteredData.length,
    totalFunds: filteredData.reduce((sum, item) => sum + item.全部基金数, 0),
    totalManagers: filteredData.reduce((sum, item) => sum + item.全部经理数, 0),
    totalScale: (filteredData.reduce((sum, item) => sum + (item.全部管理规模 || 0), 0)),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any[] = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      align: 'center' as const,
      sorter: numberSorter<FundCompany>('序号'),
      ...createRangeFilter<FundCompany>('序号'),
    },
    {
      title: '基金公司',
      dataIndex: '基金公司',
      key: '基金公司',
      width: 250,
      fixed: 'left' as const,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }: {
        setSelectedKeys: (keys: React.Key[]) => void;
        selectedKeys: React.Key[];
        confirm: () => void;
        clearFilters: () => void;
      }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索基金公司"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 200, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 80 }}
              icon={<SearchOutlined />}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters?.();
                confirm();
              }}
              size="small"
              style={{ width: 80 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value: string | number | boolean, record: FundCompany) => {
        return String(record.基金公司).toLowerCase().includes(String(value).toLowerCase());
      },
      render: (text: string) => (
        <span style={{ fontWeight: 500, color: '#333' }}>{text}</span>
      ),
    },
    {
      title: '成立时间',
      dataIndex: '成立时间',
      key: '成立时间',
      width: 120,
      align: 'center' as const,
      sorter: (a: FundCompany, b: FundCompany) => {
        if (a.成立时间 === '-' && b.成立时间 === '-') return 0;
        if (a.成立时间 === '-') return 1;
        if (b.成立时间 === '-') return -1;
        return new Date(a.成立时间).getTime() - new Date(b.成立时间).getTime();
      },
      render: (text: string) => (
        <span style={{ color: '#666', fontFamily: 'monospace' }}>{text}</span>
      ),
    },
    {
      title: '管理规模(亿)',
      dataIndex: '全部管理规模',
      key: '全部管理规模',
      width: 150,
      align: 'right' as const,
      sorter: numberSorter<FundCompany>('全部管理规模'),
      sortOrder: 'descend' as const,
      ...createRangeFilter<FundCompany>('全部管理规模'),
      render: (value: number | null) => {
        if (value === null) return <span style={{ color: '#999' }}>-</span>;
        return (
          <span style={{ color: value > 5000 ? '#f5222d' : value > 1000 ? '#fa8c16' : '#52c41a', fontWeight: 600 }}>
            {value.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '基金数量',
      dataIndex: '全部基金数',
      key: '全部基金数',
      width: 100,
      align: 'center' as const,
      sorter: numberSorter<FundCompany>('全部基金数'),
      ...createRangeFilter<FundCompany>('全部基金数'),
      render: (value: number) => (
        <Tag color={value > 100 ? 'red' : value > 50 ? 'orange' : 'blue'} style={{ fontWeight: 600 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: '基金经理数',
      dataIndex: '全部经理数',
      key: '全部经理数',
      width: 100,
      align: 'center' as const,
      sorter: numberSorter<FundCompany>('全部经理数'),
      ...createRangeFilter<FundCompany>('全部经理数'),
      render: (value: number) => (
        <Tag color={value > 50 ? 'purple' : value > 20 ? 'cyan' : 'green'} style={{ fontWeight: 600 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: '更新日期',
      key: '更新日期',
      width: 100,
      align: 'center' as const,
      sorter: (a: FundCompany, b: FundCompany) => a.更新日期.localeCompare(b.更新日期),
      render: (text: string) => (
        <span style={{ color: '#999', fontSize: '12px' }}>{text}</span>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 页面标题 */}
      <Card
        style={{
          marginBottom: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BankOutlined style={{ fontSize: '32px' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
              基金公司
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
              基金管理规模、基金数量、基金经理数统计
            </p>
          </div>
        </div>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>基金公司数量</span>}
              value={stats.totalCompanies}
              suffix="家"
              prefix={<FundOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>管理基金总数</span>}
              value={stats.totalFunds}
              suffix="只"
              prefix={<FundOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>基金经理总数</span>}
              value={stats.totalManagers}
              suffix="人"
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>管理总规模</span>}
              value={Math.ceil(stats.totalScale >= 10000 ? stats.totalScale / 10000 : stats.totalScale)}
              suffix={stats.totalScale >= 10000 ? '万亿' : '亿'}
              prefix={<BankOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和表格 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BankOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金公司列表</span>
          </div>
        }
        extra={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Input
              placeholder="搜索基金公司名称..."
              prefix={<SearchOutlined style={{ color: '#999' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240, borderRadius: '8px' }}
              allowClear
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              style={{ borderRadius: '8px' }}
            >
              刷新
            </Button>
          </div>
        }
        style={{ borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="序号"
            size="middle"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: filteredData.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
            }}
            scroll={{ x: 900 }}
            rowClassName={(_record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default FundCompany;
