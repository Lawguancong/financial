import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Spin, Empty, Progress, Select, Tag, Row, Col, Statistic } from 'antd';
import { Link } from 'react-router-dom';
import apiClient from '@/utils/axios';
import moment from 'moment';

interface FundHoldingsProps {
  symbol: string | null;
}

interface StockHolding {
  序号: number;
  股票代码: string;
  股票名称: string;
  占净值比例: number;
  持股数: number;
  持仓市值: number;
  季度: string;
}

const FundHoldings: React.FC<FundHoldingsProps> = ({ symbol }) => {
  const [data, setData] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_portfolio_hold_em', {
        params: { symbol, date: moment().format('YYYY') },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formatted = rawData.map((item: Record<string, unknown>, index: number) => ({
          序号: index + 1,
          股票代码: String(item['股票代码'] || ''),
          股票名称: String(item['股票名称'] || ''),
          占净值比例: Number(item['占净值比例']) || 0,
          持股数: Number(item['持股数']) || 0,
          持仓市值: Number(item['持仓市值']) || 0,
          季度: String(item['季度'] || ''),
        }));
        setData(formatted);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取基金持仓失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取所有季度列表
  const quarters = useMemo(() => {
    const uniqueQuarters = [...new Set(data.map(item => item.季度))].filter(Boolean);
    return uniqueQuarters.sort().reverse();
  }, [data]);

  // 根据选中的季度过滤数据
  const filteredData = useMemo(() => {
    if (selectedQuarter === 'all') {
      return data;
    }
    return data.filter(item => item.季度 === selectedQuarter);
  }, [data, selectedQuarter]);

  // 当前季度的统计数据
  const currentStats = useMemo(() => {
    const quarterData = selectedQuarter === 'all' ? data : filteredData;
    const totalHolding = quarterData.reduce((sum, item) => sum + item.占净值比例, 0);
    const totalValue = quarterData.reduce((sum, item) => sum + item.持仓市值, 0);
    const stockCount = quarterData.length;
    return { totalHolding, totalValue, stockCount };
  }, [filteredData, data, selectedQuarter]);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: StockHolding, index: number) => index + 1 + (pagination.current - 1) * pagination.pageSize,
    },
    {
      title: '股票代码',
      dataIndex: '股票代码',
      key: '股票代码',
      width: 100,
      align: 'center' as const,
      render: (code: string) => (
        <span style={{ color: '#1890ff', fontFamily: 'monospace', fontWeight: 500 }}>{code}</span>
      ),
    },
    {
      title: '股票名称',
      dataIndex: '股票名称',
      key: '股票名称',
      width: 120,
      render: (name: string, record: StockHolding) => (
        <Link
          to={`/stock/a/stock/detail?symbol=${record.股票代码}`}
          style={{ color: '#333', fontWeight: 600 }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '占净值比例',
      dataIndex: '占净值比例',
      key: '占净值比例',
      width: 180,
      align: 'right' as const,
      sorter: (a: StockHolding, b: StockHolding) => a.占净值比例 - b.占净值比例,
      defaultSortOrder: 'descend' as const,
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Progress
            percent={value}
            size="small"
            strokeColor={value > 5 ? '#f5222d' : value > 3 ? '#fa8c16' : '#52c41a'}
            format={(percent) => `${percent?.toFixed(2)}%`}
            style={{ width: '100px', margin: 0 }}
          />
          <span style={{ color: value > 5 ? '#f5222d' : '#666', fontWeight: 'bold', minWidth: '60px' }}>
            {value.toFixed(2)}%
          </span>
        </div>
      ),
    },
    {
      title: '持股数',
      dataIndex: '持股数',
      key: '持股数',
      width: 120,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ color: '#666' }}>
          {value > 10000 ? `${(value / 10000).toFixed(2)}万` : value.toLocaleString()}
        </span>
      ),
    },
    {
      title: '持仓市值',
      dataIndex: '持仓市值',
      key: '持仓市值',
      width: 120,
      align: 'right' as const,
      sorter: (a: StockHolding, b: StockHolding) => a.持仓市值 - b.持仓市值,
      render: (value: number) => (
        <span style={{ color: '#1890ff', fontWeight: 500 }}>
          {value >= 10000 ? `${(value / 10000).toFixed(2)}亿` : `${value.toFixed(2)}万`}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>股票持仓</span>
          {quarters.length > 0 && (
            <Select
              value={selectedQuarter}
              onChange={(value) => {
                setSelectedQuarter(value);
                setPagination({ current: 1, pageSize: pagination.pageSize });
              }}
              style={{ width: 180, marginLeft: '16px' }}
              placeholder="选择季度"
            >
              <Select.Option value="all">全部季度</Select.Option>
              {quarters.map(q => (
                <Select.Option key={q} value={q}>
                  {q}
                </Select.Option>
              ))}
            </Select>
          )}
        </div>
      }
      extra={
        <Tag color="blue" style={{ fontSize: '14px' }}>
          {selectedQuarter === 'all' ? '全部' : selectedQuarter}
        </Tag>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        {filteredData.length > 0 && (
          <Row gutter={16} style={{ marginBottom: '16px' }}>
            <Col span={8}>
              <Statistic
                title="持仓股票数"
                value={currentStats.stockCount}
                suffix="只"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="前十大持仓合计"
                value={currentStats.totalHolding}
                suffix="%"
                precision={2}
                valueStyle={{ color: currentStats.totalHolding > 50 ? '#f5222d' : '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="持仓总市值"
                value={currentStats.totalValue >= 10000 ? currentStats.totalValue / 10000 : currentStats.totalValue}
                suffix={currentStats.totalValue >= 10000 ? '亿' : '万'}
                precision={2}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>
        )}

        {filteredData.length === 0 ? (
          <Empty
            description="暂无持仓数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: filteredData.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 只`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ current: 1, pageSize: size });
              },
            }}
            rowKey={(record) => `${record.季度}-${record.股票代码}`}
            size="middle"
            scroll={{ x: 700 }}
          />
        )}
      </Spin>
    </Card>
  );
};

export default FundHoldings;
