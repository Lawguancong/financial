import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Spin, Empty, Progress, Select, Tag, Row, Col, Statistic } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';

interface FundIndustryAllocationProps {
  symbol: string | null;
}

interface IndustryData {
  序号: number;
  行业类别: string;
  占净值比例: number;
  市值: number;
  截止时间: string;
}

const FundIndustryAllocation: React.FC<FundIndustryAllocationProps> = ({ symbol }) => {
  const [data, setData] = useState<IndustryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_portfolio_industry_allocation_em', {
        params: { symbol, date: moment().format('YYYY') },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formatted = rawData.map((item: Record<string, unknown>) => ({
          序号: Number(item['序号']) || 0,
          行业类别: String(item['行业类别'] || '-'),
          占净值比例: Number(item['占净值比例']) || 0,
          市值: Number(item['市值']) || 0,
          截止时间: String(item['截止时间'] || '-'),
        }));
        setData(formatted);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取行业配置失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取所有截止时间列表
  const quarters = useMemo(() => {
    const uniqueQuarters = [...new Set(data.map(item => item.截止时间))].filter(Boolean);
    return uniqueQuarters.sort().reverse();
  }, [data]);

  // 根据选中的季度过滤数据
  const filteredData = useMemo(() => {
    if (selectedQuarter === 'all') {
      // 如果选择全部，返回每个行业的最新数据
      const latestByIndustry: Record<string, IndustryData> = {};
      data.forEach(item => {
        if (!latestByIndustry[item.行业类别] || item.截止时间 > latestByIndustry[item.行业类别].截止时间) {
          latestByIndustry[item.行业类别] = item;
        }
      });
      return Object.values(latestByIndustry).sort((a, b) => b.占净值比例 - a.占净值比例);
    }
    return data.filter(item => item.截止时间 === selectedQuarter).sort((a, b) => b.占净值比例 - a.占净值比例);
  }, [data, selectedQuarter]);

  // 当前季度的统计数据
  const currentStats = useMemo(() => {
    const totalHolding = filteredData.reduce((sum, item) => sum + item.占净值比例, 0);
    const totalValue = filteredData.reduce((sum, item) => sum + item.市值, 0);
    const industryCount = filteredData.length;
    return { totalHolding, totalValue, industryCount };
  }, [filteredData]);

  const getColorByRank = (index: number) => {
    const colors = ['#f5222d', '#fa8c16', '#faad14', '#52c41a', '#1890ff', '#722ed1', '#eb2f96', '#13c2c2', '#2f54eb', '#fa541c'];
    return colors[index % colors.length];
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🏭</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>行业配置</span>
          {quarters.length > 0 && (
            <Select
              value={selectedQuarter}
              onChange={setSelectedQuarter}
              style={{ width: 180, marginLeft: '16px' }}
              placeholder="选择季度"
            >
              <Select.Option value="all">最新配置</Select.Option>
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
        <Tag color="green" style={{ fontSize: '14px' }}>
          {selectedQuarter === 'all' ? '最新' : selectedQuarter}
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
                title="配置行业数"
                value={currentStats.industryCount}
                suffix="个"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="行业配置合计"
                value={currentStats.totalHolding}
                suffix="%"
                precision={2}
                valueStyle={{ color: currentStats.totalHolding > 80 ? '#f5222d' : '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="配置总市值"
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
            description="暂无行业配置数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredData.map((item, index) => (
              <div
                key={`${item.截止时间}-${item.行业类别}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: '#fafafa',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${getColorByRank(index)}`,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: getColorByRank(index),
                  borderRadius: '50%',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>
                      {item.行业类别}
                    </span>
                    <span style={{ fontWeight: 'bold', color: getColorByRank(index), fontSize: '16px' }}>
                      {item.占净值比例.toFixed(2)}%
                    </span>
                  </div>
                  <Progress
                    percent={item.占净值比例}
                    size="small"
                    strokeColor={getColorByRank(index)}
                    format={() => ''}
                    style={{ marginBottom: '4px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
                    <span>截止时间: {item.截止时间}</span>
                    <span>
                      {item.市值 >= 10000 
                        ? `市值: ${(item.市值 / 10000).toFixed(2)}亿` 
                        : `市值: ${item.市值.toFixed(2)}万`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '16px',
              background: '#f0f5ff',
              borderRadius: '8px',
              marginTop: '8px',
            }}>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>合计</span>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                行业配置: {currentStats.totalHolding.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default FundIndustryAllocation;
