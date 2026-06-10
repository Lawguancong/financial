import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Progress } from 'antd';
import apiClient from '@/utils/axios';

interface FundAssetAllocationProps {
  symbol: string | null;
}

interface AssetData {
  序号: number;
  报告日期: string;
  股票占净比: number;
  债券占净比: number;
  现金占净比: number;
  基金占净比: number;
  其他占净比: number;
  净资产: number;
}

const FundAssetAllocation: React.FC<FundAssetAllocationProps> = ({ symbol }) => {
  const [data, setData] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_asset_allocation_em', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formatted = rawData.map((item: Record<string, unknown>, index: number) => ({
          序号: index + 1,
          报告日期: String(item['报告日期'] || '-'),
          股票占净比: Number(item['股票占净比']) || 0,
          债券占净比: Number(item['债券占净比']) || 0,
          现金占净比: Number(item['现金占净比']) || 0,
          基金占净比: Number(item['基金占净比']) || 0,
          其他占净比: Number(item['其他占净比']) || 0,
          净资产: Number(item['净资产']) || 0,
        }));
        setData(formatted);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取资产配置失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getColor = (ratio: number) => {
    if (ratio > 80) return '#f5222d';
    if (ratio > 50) return '#fa8c16';
    if (ratio > 20) return '#52c41a';
    return '#1890ff';
  };

  const formatNetAsset = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    } else if (value >= 10000) {
      return `${(value / 10000).toFixed(2)}万`;
    }
    return value.toFixed(2);
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>💼</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>资产配置</span>
          {data.length > 0 && (
            <span style={{ color: '#999', fontSize: '14px', marginLeft: '8px' }}>
              (最新: {data[0]?.报告日期 || '-'})
            </span>
          )}
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty
            description="暂无资产配置数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {data.slice(0, 4).map((item) => (
              <div
                key={item.序号}
                style={{
                  padding: '20px',
                  background: '#fafafa',
                  borderRadius: '12px',
                  border: '1px solid #e8e8e8',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e8e8e8',
                }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                    {item.报告日期}
                  </span>
                  <span style={{ color: '#1890ff', fontWeight: 500 }}>
                    净资产: {formatNetAsset(item.净资产)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>📈 股票</span>
                      <span style={{ fontWeight: 'bold', color: getColor(item.股票占净比) }}>
                        {item.股票占净比.toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      percent={item.股票占净比}
                      size="small"
                      strokeColor={getColor(item.股票占净比)}
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>📜 债券</span>
                      <span style={{ fontWeight: 'bold', color: '#722ed1' }}>
                        {item.债券占净比.toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      percent={item.债券占净比}
                      size="small"
                      strokeColor="#722ed1"
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>💵 现金</span>
                      <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                        {item.现金占净比.toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      percent={item.现金占净比}
                      size="small"
                      strokeColor="#52c41a"
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>📚 基金</span>
                      <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>
                        {item.基金占净比.toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      percent={item.基金占净比}
                      size="small"
                      strokeColor="#fa8c16"
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>📦 其他</span>
                      <span style={{ fontWeight: 'bold', color: '#13c2c2' }}>
                        {item.其他占净比.toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      percent={item.其他占净比}
                      size="small"
                      strokeColor="#13c2c2"
                      showInfo={false}
                    />
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

export default FundAssetAllocation;
