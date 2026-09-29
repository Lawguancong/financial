import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { UserOutlined, CalendarOutlined, TrophyOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

interface FundManagerProps {
  symbol: string | null;
}

interface ManagerInfo {
  基金经理: string;
  基金经理代码: string;
  任职日期: string;
  任职天数: number;
  任职回报: number;
  累计回报: number;
  基金代码: string;
}

const FundManager: React.FC<FundManagerProps> = ({ symbol }) => {
  const [data, setData] = useState<ManagerInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_manager_em', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formatted = rawData.map((item: Record<string, unknown>) => ({
          基金经理: String(item['基金经理'] || '-'),
          基金经理代码: String(item['基金经理代码'] || '-'),
          任职日期: String(item['任职日期'] || '-'),
          任职天数: Number(item['任职天数']) || 0,
          任职回报: Number(item['任职回报']) || 0,
          累计回报: Number(item['累计回报']) || 0,
          基金代码: String(item['基金代码'] || symbol),
        }));
        setData(formatted);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取基金经理失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDays = (days: number) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      return `${years}年${remainingDays}天`;
    }
    return `${days}天`;
  };

  const getReturnColor = (value: number) => {
    if (value > 50) return '#f5222d';
    if (value > 0) return '#52c41a';
    if (value < -20) return '#f5222d';
    return '#fa8c16';
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金经理</span>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty
            description="暂无基金经理数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.map((manager, index) => (
              <div
                key={index}
                style={{
                  padding: '20px',
                  background: index === 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fafafa',
                  borderRadius: '12px',
                  color: index === 0 ? 'white' : '#333',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        background: index === 0 ? 'rgba(255,255,255,0.2)' : '#e6f7ff',
                        borderRadius: '50%',
                      }}>
                        <UserOutlined style={{ fontSize: '24px', color: index === 0 ? 'white' : '#1890ff' }} />
                      </div>
                      <div>
                        <Link
                          to={`/fund/cn/manager?name=${encodeURIComponent(manager.基金经理)}`}
                          style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: index === 0 ? 'white' : '#333',
                            textDecoration: 'none',
                          }}
                        >
                          {manager.基金经理}
                        </Link>
                        {index === 0 && (
                          <Tag color="gold" style={{ marginLeft: '8px' }}>
                            现任
                          </Tag>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      基金经理代码: {manager.基金经理代码}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  padding: '16px',
                  background: index === 0 ? 'rgba(255,255,255,0.1)' : '#fff',
                  borderRadius: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: index === 0 ? 'rgba(255,255,255,0.7)' : '#999', marginBottom: '4px' }}>
                      <CalendarOutlined /> 任职日期
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{manager.任职日期}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: index === 0 ? 'rgba(255,255,255,0.7)' : '#999', marginBottom: '4px' }}>
                      <CalendarOutlined /> 任职天数
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{formatDays(manager.任职天数)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: index === 0 ? 'rgba(255,255,255,0.7)' : '#999', marginBottom: '4px' }}>
                      <TrophyOutlined /> 任职回报
                    </div>
                    <div style={{
                      fontWeight: 'bold',
                      color: index === 0 ? 'white' : getReturnColor(manager.任职回报),
                    }}>
                      {manager.任职回报 > 0 ? '+' : ''}{manager.任职回报.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: index === 0 ? 'rgba(255,255,255,0.7)' : '#999', marginBottom: '4px' }}>
                      <TrophyOutlined /> 累计回报
                    </div>
                    <div style={{
                      fontWeight: 'bold',
                      color: index === 0 ? 'white' : getReturnColor(manager.累计回报),
                    }}>
                      {manager.累计回报 > 0 ? '+' : ''}{manager.累计回报.toFixed(2)}%
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

export default FundManager;
