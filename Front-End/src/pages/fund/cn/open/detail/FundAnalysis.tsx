import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Row, Col, Progress, Tag } from 'antd';
import {
  LineChartOutlined,
  RiseOutlined,
  FallOutlined,
  SwapOutlined,
  ExperimentOutlined,
  DragOutlined,
} from '@ant-design/icons';
import apiClient from '@/utils/axios';

interface FundAnalysisProps {
  symbol: string | null;
}

interface AnalysisData {
  周期: string;
  较同类风险收益比: number;
  较同类抗风险波动: number;
  年化波动率: number;
  年化夏普比率: number;
  最大回撤: number;
}

const FundAnalysis: React.FC<FundAnalysisProps> = ({ symbol }) => {
  const [data, setData] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_individual_analysis_xq', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        setData(rawData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取基金分析数据失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRiskLevel = (value: number, type: '波动' | '回撤' | '夏普' | '其他') => {
    if (type === '波动' || type === '回撤') {
      if (value > 30) return '#f5222d';
      if (value > 20) return '#fa8c16';
      if (value > 10) return '#faad14';
      return '#52c41a';
    }
    if (type === '夏普') {
      if (value < 0) return '#f5222d';
      if (value < 0.5) return '#fa8c16';
      if (value < 1) return '#faad14';
      return '#52c41a';
    }
    return '#1890ff';
  };

  const getRiskLabel = (value: number, type: '波动' | '回撤' | '夏普') => {
    if (type === '波动' || type === '回撤') {
      if (value > 30) return '高风险';
      if (value > 20) return '中高风险';
      if (value > 10) return '中风险';
      return '低风险';
    }
    if (type === '夏普') {
      if (value < 0) return '较差';
      if (value < 0.5) return '一般';
      if (value < 1) return '良好';
      return '优秀';
    }
    return '';
  };

  const getPeriodColor = (period: string) => {
    if (period.includes('1年')) return '#1890ff';
    if (period.includes('3年')) return '#722ed1';
    if (period.includes('5年')) return '#f5222d';
    return '#52c41a';
  };

  const renderMetricCard = (
    title: string,
    value: number,
    suffix: string,
    icon: React.ReactNode,
    type: '波动' | '回撤' | '夏普' | '其他'
  ) => {
    const color = getRiskLevel(value, type);
    const label = type !== '其他' ? getRiskLabel(value, type) : '';
    return (
      <div
        style={{
          padding: '16px',
          background: '#fafafa',
          borderRadius: '8px',
          borderLeft: `3px solid ${color}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ color: '#666', fontSize: '12px' }}>{title}</span>
          {label && <Tag color={color} style={{ marginLeft: 'auto' }}>{label}</Tag>}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>
          {value.toFixed(2)}{suffix}
        </div>
      </div>
    );
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金数据分析</span>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty description="暂无分析数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {data.map((item) => (
              <div
                key={item.周期}
                style={{
                  padding: '20px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Tag color={getPeriodColor(item.周期)} style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {item.周期}
                  </Tag>
                  <span style={{ color: '#999', fontSize: '12px' }}>风险收益指标</span>
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={8}>
                    {renderMetricCard(
                      '较同类风险收益比',
                      item.较同类风险收益比,
                      '',
                      <SwapOutlined />,
                      '其他'
                    )}
                  </Col>
                  <Col xs={12} sm={8}>
                    {renderMetricCard(
                      '较同类抗风险波动',
                      item.较同类抗风险波动,
                      '',
                      <ExperimentOutlined />,
                      '其他'
                    )}
                  </Col>
                  <Col xs={12} sm={8}>
                    {renderMetricCard(
                      '年化波动率',
                      item.年化波动率,
                      '%',
                      <LineChartOutlined />,
                      '波动'
                    )}
                  </Col>
                  <Col xs={12} sm={8}>
                    {renderMetricCard(
                      '夏普比率',
                      item.年化夏普比率,
                      '',
                      <RiseOutlined />,
                      '夏普'
                    )}
                  </Col>
                  <Col xs={12} sm={8}>
                    {renderMetricCard(
                      '最大回撤',
                      item.最大回撤,
                      '%',
                      <FallOutlined />,
                      '回撤'
                    )}
                  </Col>
                </Row>

                {/* 可视化进度条 */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <DragOutlined style={{ color: '#1890ff' }} />
                    <span style={{ color: '#666', fontSize: '12px' }}>收益风险综合评价</span>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#999' }}>风险收益比</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}>
                          {item.较同类风险收益比}
                        </span>
                      </div>
                      <Progress
                        percent={item.较同类风险收益比}
                        showInfo={false}
                        strokeColor="#1890ff"
                        trailColor="#f0f0f0"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#999' }}>抗风险波动</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}>
                          {item.较同类抗风险波动}
                        </span>
                      </div>
                      <Progress
                        percent={item.较同类抗风险波动}
                        showInfo={false}
                        strokeColor="#52c41a"
                        trailColor="#f0f0f0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default FundAnalysis;
