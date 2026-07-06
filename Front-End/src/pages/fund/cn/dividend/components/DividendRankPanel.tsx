import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spin, Input, Row, Col, Statistic, Tag } from 'antd';
import {
  DollarOutlined,
  TrophyOutlined,
  CalendarOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, createRangeFilter } from '@/utils/tableUtils';
import type { TablePaginationConfig } from 'antd';

interface FundDividend extends Record<string, unknown> {
  序号: number;
  基金代码: string;
  基金简称: string;
  累计分红: number;
  累计次数: number;
  成立日期: string;
}

const DividendRankPanel: React.FC = () => {
  const [data, setData] = useState<FundDividend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState<FundDividend[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
      `共 ${total} 条记录，第 ${range[0]}-${range[1]} 条`,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_fh_rank_em');
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map(
          (item: Record<string, unknown>, index: number) => ({
            序号: index + 1,
            基金代码: String(item['基金代码'] || ''),
            基金简称: String(item['基金简称'] || '-'),
            累计分红: Number(item['累计分红']) || 0,
            累计次数: Number(item['累计次数']) || 0,
            成立日期: String(item['成立日期'] || '-'),
          })
        );
        setData(formattedData);
        setFilteredData(formattedData);
      }
    } catch (error) {
      console.error('获取基金分红数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // fetchData();
  }, []);

  useEffect(() => {
    const filtered = data.filter(
      item =>
        item.基金简称.toLowerCase().includes(searchText.toLowerCase()) ||
        item.基金代码.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredData(filtered);
    setPagination(p => ({ ...p, current: 1 }));
  }, [searchText, data]);

  const stats = {
    totalFunds: filteredData.length,
    totalDividendCount: filteredData.reduce((sum, item) => sum + item.累计次数, 0),
    totalDividendAmount: filteredData.reduce((sum, item) => sum + item.累计分红, 0),
    avgDividendPerFund:
      filteredData.length > 0
        ? filteredData.reduce((sum, item) => sum + item.累计分红, 0) / filteredData.length
        : 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any[] = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      align: 'center' as const,
      sorter: numberSorter<FundDividend>('序号'),
      ...createRangeFilter<FundDividend>('序号'),
    },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      align: 'center' as const,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 180,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
      }: {
        setSelectedKeys: (keys: React.Key[]) => void;
        selectedKeys: React.Key[];
        confirm: () => void;
      }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索基金简称"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <button
            type="button"
            onClick={() => confirm()}
            style={{
              width: '100%',
              padding: '4px 0',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            确定
          </button>
        </div>
      ),
      onFilter: (value: unknown, record: FundDividend) =>
        record.基金简称.toLowerCase().includes((value as string).toLowerCase()),
    },
    {
      title: '累计次数',
      dataIndex: '累计次数',
      key: '累计次数',
      width: 100,
      align: 'center' as const,
      sorter: numberSorter<FundDividend>('累计次数'),
      ...createRangeFilter<FundDividend>('累计次数'),
      render: (value: number) => <Tag color="green">{value}次</Tag>,
    },
    {
      title: '累计分红(元/份)',
      dataIndex: '累计分红',
      key: '累计分红',
      width: 140,
      align: 'right' as const,
      sorter: numberSorter<FundDividend>('累计分红'),
      ...createRangeFilter<FundDividend>('累计分红'),
      render: (value: number) => (
        <span style={{ color: '#f5222d', fontWeight: 500 }}>
          {value > 0
            ? `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
            : '-'}
        </span>
      ),
    },
    {
      title: '成立日期',
      dataIndex: '成立日期',
      key: '成立日期',
      width: 120,
      align: 'center' as const,
      sorter: (a: FundDividend, b: FundDividend) => a.成立日期.localeCompare(b.成立日期),
    },
  ];

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination(newPagination);
  };

  return (
    <div>
      <Card
        style={{
          marginBottom: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              基金分红排名
            </h1>
            <p
              style={{
                margin: '8px 0 0',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '14px',
              }}
            >
              东方财富网-基金分红数据统计
            </p>
          </div>
        </div>
      </Card>

      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
        <button
          type="button"
          onClick={fetchData}
          style={{
            padding: '6px 16px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ReloadOutlined /> 刷新数据
        </button>
        </Col>

      </Row>
      {/* 统计卡片 */}

      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={<span style={{ color: '#666' }}>有分红记录基金数</span>}
              value={stats.totalFunds}
              prefix={<TrophyOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={<span style={{ color: '#666' }}>累计分红次数</span>}
              value={stats.totalDividendCount}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={<span style={{ color: '#666' }}>累计分红总额</span>}
              value={stats.totalDividendAmount}
              prefix={<DollarOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d', fontWeight: 600 }}
              suffix="亿元"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <Statistic
              title={<span style={{ color: '#666' }}>平均每只分红</span>}
              value={stats.avgDividendPerFund}
              valueStyle={{ color: '#fa8c16', fontWeight: 600 }}
              suffix="元/份"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据表格 */}
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <Input
            placeholder="搜索基金代码或简称"
            prefix={<SearchOutlined style={{ color: '#ccc' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 280, borderRadius: '8px' }}
            allowClear
          />

        </div>

        <Spin spinning={loading}>
          <Table<FundDividend>
            columns={columns}
            dataSource={filteredData}
            rowKey={record => `${record.序号}-${record.基金代码}`}
            pagination={pagination}
            onChange={handleTableChange}
            size="middle"
            scroll={{ x: 1300 }}
            rowClassName={(_record, index) =>
              index % 2 === 0 ? 'table-row-even' : 'table-row-odd'
            }
          />
        </Spin>
      </Card>

      <style>{`
        .table-row-even {
          background-color: #fafafa;
        }
        .table-row-odd {
          background-color: #ffffff;
        }
        .table-row-even:hover,
        .table-row-odd:hover {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </div>
  );
};

export default DividendRankPanel;
