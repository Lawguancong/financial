import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Table } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, createRangeFilter } from '@/utils/tableUtils';

interface FundAchievementProps {
  symbol: string;
}

interface AchievementData {
  业绩类型: string;
  周期: string;
  周期收益同类排名: string;
  本产品区间收益: number;
  本产品最大回撒: number;
}

const FundAchievement: React.FC<FundAchievementProps> = ({ symbol }) => {
  const [data, setData] = useState<AchievementData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol || symbol === '-') return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_individual_achievement_xq', {
        params: { symbol },
      });
      console.log('基金业绩 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.error('获取基金业绩数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: '业绩类型',
      dataIndex: '业绩类型',
      key: '业绩类型',
      width: 100,
    },
    {
      title: '周期',
      dataIndex: '周期',
      key: '周期',
      width: 120,
    },
    {
      title: '同类排名',
      dataIndex: '周期收益同类排名',
      key: '周期收益同类排名',
      width: 120,
    },
    {
      title: '区间收益(%)',
      dataIndex: '本产品区间收益',
      key: '本产品区间收益',
      width: 120,
      sorter: numberSorter('本产品区间收益'),
      ...createRangeFilter('本产品区间收益'),
      render: (value: number) => {
        if (value === undefined || value === null) return '-';
        const color = value >= 0 ? '#f5222d' : '#52c41a';
        return <span style={{ color, fontWeight: 500 }}>{value?.toFixed(2)}%</span>;
      },
    },
    {
      title: '最大回撤(%)',
      dataIndex: '本产品最大回撒',
      key: '本产品最大回撒',
      width: 120,
      sorter: numberSorter('本产品最大回撒'),
      ...createRangeFilter('本产品最大回撒'),
      render: (value: number) => {
        if (value === undefined || value === null) return '-';
        return <span style={{ color: '#fa8c16' }}>{value?.toFixed(2)}%</span>;
      },
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrophyOutlined style={{ fontSize: '18px', color: '#faad14' }} />
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金业绩</span>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <Table
            columns={columns}
            dataSource={data}
            rowKey={(record, index) => `${record.业绩类型}-${record.周期}-${index}`}
            scroll={{ x: 600 }}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            size="small"
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Spin>
    </Card>
  );
};

export default FundAchievement;
