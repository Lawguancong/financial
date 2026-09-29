import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spin, Empty, Tag } from 'antd';
import apiClient from '@/utils/axios';

interface FundDividendProps {
  symbol: string | null;
}

interface DividendRecord {
  序号: number;
  分红发放日期: string;
  分红发放金额: number;
  分红派息日: string;
  除息日期: string;
  单位分红: number;
  红利再投资: string;
  分红方式: string;
  权益登记日: string;
  公告日期: string;
}

const FundDividend: React.FC<FundDividendProps> = ({ symbol }) => {
  const [data, setData] = useState<DividendRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_fh_em', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formatted = rawData.map((item: Record<string, unknown>, index: number) => ({
          序号: index + 1,
          分红发放日期: String(item['分红发放日期'] || '-'),
          分红发放金额: Number(item['分红发放金额']) || 0,
          分红派息日: String(item['分红派息日'] || '-'),
          除息日期: String(item['除息日期'] || '-'),
          单位分红: Number(item['单位分红']) || 0,
          红利再投资: String(item['红利再投资'] || '-'),
          分红方式: String(item['分红方式'] || '-'),
          权益登记日: String(item['权益登记日'] || '-'),
          公告日期: String(item['公告日期'] || '-'),
        }));
        setData(formatted);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取基金分红失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 60,
      align: 'center' as const,
    },
    {
      title: '分红发放日期',
      dataIndex: '分红发放日期',
      key: '分红发放日期',
      width: 130,
      align: 'center' as const,
      sorter: (a: DividendRecord, b: DividendRecord) => 
        a.分红发放日期.localeCompare(b.分红发放日期),
      render: (date: string) => (
        <Tag color="blue">{date}</Tag>
      ),
    },
    {
      title: '分红发放金额',
      dataIndex: '分红发放金额',
      key: '分红发放金额',
      width: 130,
      align: 'right' as const,
      sorter: (a: DividendRecord, b: DividendRecord) => 
        a.分红发放金额 - b.分红发放金额,
      render: (value: number) => (
        <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
          {value > 0 ? `¥${value.toFixed(4)}` : '-'}
        </span>
      ),
    },
    {
      title: '单位分红',
      dataIndex: '单位分红',
      key: '单位分红',
      width: 100,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ color: '#1890ff', fontWeight: 500 }}>
          {value > 0 ? `¥${value.toFixed(4)}` : '-'}
        </span>
      ),
    },
    {
      title: '除息日期',
      dataIndex: '除息日期',
      key: '除息日期',
      width: 110,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ color: '#666' }}>{date}</span>
      ),
    },
    {
      title: '权益登记日',
      dataIndex: '权益登记日',
      key: '权益登记日',
      width: 110,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ color: '#666' }}>{date}</span>
      ),
    },
    {
      title: '分红派息日',
      dataIndex: '分红派息日',
      key: '分红派息日',
      width: 110,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ color: '#666' }}>{date}</span>
      ),
    },
    {
      title: '分红方式',
      dataIndex: '分红方式',
      key: '分红方式',
      width: 100,
      align: 'center' as const,
      render: (method: string) => (
        <Tag color={method === '派息' ? 'green' : 'orange'}>
          {method}
        </Tag>
      ),
    },
    {
      title: '红利再投资',
      dataIndex: '红利再投资',
      key: '红利再投资',
      width: 100,
      align: 'center' as const,
      render: (value: string) => (
        <Tag color={value === '是' ? 'success' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: '公告日期',
      dataIndex: '公告日期',
      key: '公告日期',
      width: 110,
      align: 'center' as const,
      render: (date: string) => (
        <span style={{ color: '#999', fontSize: '12px' }}>{date}</span>
      ),
    },
  ];

  const totalDividend = data.reduce((sum, item) => sum + item.分红发放金额, 0);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>💰</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>分红信息</span>
          {data.length > 0 && (
            <span style={{ color: '#999', fontSize: '14px', marginLeft: '8px' }}>
              (累计分红总额: ¥{totalDividend.toFixed(4)})
            </span>
          )}
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty
            description="暂无分红数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={data}
            pagination={{
              ...pagination,
                showSizeChanger: true,
                showTotal: (total: number) => `共 ${total} 条`,
                onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
              }}
            rowKey="序号"
            size="middle"
            scroll={{ x: 1100 }}
          />
        )}
      </Spin>
    </Card>
  );
};

export default FundDividend;
