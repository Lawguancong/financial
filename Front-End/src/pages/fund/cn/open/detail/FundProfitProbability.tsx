import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Row, Col, Progress, Tag } from 'antd';
import { ClockCircleOutlined, TrophyOutlined, RiseOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

interface FundProfitProbabilityProps {
  symbol: string | null;
}

interface ProfitData {
  持有时长: string;
  盈利概率: number;
  平均收益: number;
}

const FundProfitProbability: React.FC<FundProfitProbabilityProps> = ({ symbol }) => {
  const [data, setData] = useState<ProfitData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_individual_profit_probability_xq', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        setData(rawData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取基金盈利概率失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getProbabilityColor = (value: number) => {
    if (value >= 70) return '#52c41a';
    if (value >= 50) return '#1890ff';
    if (value >= 30) return '#faad14';
    return '#f5222d';
  };

  const getProbabilityLevel = (value: number) => {
    if (value >= 70) return '高';
    if (value >= 50) return '中';
    if (value >= 30) return '低';
    return '极低';
  };

  const getReturnColor = (value: number) => {
    if (value >= 50) return '#f5222d';
    if (value >= 30) return '#fa8c16';
    if (value >= 10) return '#1890ff';
    return '#52c41a';
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🎯</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金盈利概率</span>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty description="暂无盈利概率数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 概览统计 */}
            <div
              style={{
                display: 'flex',
                gap: '24px',
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                color: 'white',
              }}
            >
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>最高盈利概率</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {Math.max(...data.map(d => d.盈利概率))}%
                </div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>最高平均收益</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {Math.max(...data.map(d => d.平均收益)).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* 盈利概率详情 */}
            <Row gutter={[16, 16]}>
              {data.map((item) => (
                <Col xs={24} sm={12} key={item.持有时长}>
                  <div
                    style={{
                      padding: '20px',
                      background: '#fafafa',
                      borderRadius: '12px',
                      borderLeft: `4px solid ${getProbabilityColor(item.盈利概率)}`,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '40px',
                          height: '40px',
                          background: `${getProbabilityColor(item.盈利概率)}20`,
                          borderRadius: '50%',
                        }}
                      >
                        <ClockCircleOutlined style={{ fontSize: '20px', color: getProbabilityColor(item.盈利概率) }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>{item.持有时长}</div>
                        <Tag color={getProbabilityColor(item.盈利概率)} style={{ marginTop: '4px' }}>
                          {getProbabilityLevel(item.盈利概率)}概率
                        </Tag>
                      </div>
                    </div>

                    {/* 盈利概率 */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          <TrophyOutlined style={{ marginRight: '4px' }} />
                          盈利概率
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: getProbabilityColor(item.盈利概率) }}>
                          {item.盈利概率}%
                        </span>
                      </div>
                      <Progress
                        percent={item.盈利概率}
                        showInfo={false}
                        strokeColor={getProbabilityColor(item.盈利概率)}
                        trailColor="#e8e8e8"
                      />
                    </div>

                    {/* 平均收益 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          <RiseOutlined style={{ marginRight: '4px' }} />
                          平均收益
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: getReturnColor(item.平均收益) }}>
                          {item.平均收益}%
                        </span>
                      </div>
                      <Progress
                        percent={Math.min(item.平均收益, 100)}
                        showInfo={false}
                        strokeColor={getReturnColor(item.平均收益)}
                        trailColor="#e8e8e8"
                      />
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* 投资建议 */}
            <div
              style={{
                padding: '16px',
                background: '#f6ffed',
                borderRadius: '8px',
                border: '1px solid #b7eb8f',
              }}
            >
              <div style={{ fontWeight: 500, color: '#52c41a', marginBottom: '8px' }}>💡 投资建议</div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.8 }}>
                {data.length > 0 && (
                  <>
                    根据历史数据，持有该基金
                    <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
                      {data[data.length - 1].持有时长.replace('满', '')}
                    </span>
                    的盈利概率为
                    <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                      {data[data.length - 1].盈利概率}%
                    </span>
                    ，平均收益可达
                    <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>
                      {data[data.length - 1].平均收益}%
                    </span>
                    。
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default FundProfitProbability;
