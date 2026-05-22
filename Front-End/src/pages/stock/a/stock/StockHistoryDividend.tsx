import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button } from 'antd';
import apiClient from '@/utils/axios';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

interface DividendData {
  代码: string;
  名称: string;
  上市日期: string;
  累计股息: number;
  年均股息: number;
  分红次数: number;
  融资总额: number;
  融资次数: number;
  上市年限: number;
  年均分红次数: number;
}

const StockHistoryDividend: React.FC = () => {
  const [data, setData] = useState<DividendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current:1,
    pageSize: 20,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_history_dividend', {
      });
      if (response.data && response.data) {
        const rawData = response.data as Omit<DividendData, '上市年限' | '年均分红次数'>[];
        const processedData = rawData.map(item => {
          const 上市年限 = item.上市日期 ? calculateListingYears(item.上市日期) : 0;
          const 年均分红次数 = 上市年限 > 0 ? (item.分红次数 / 上市年限) : 0;
          return {
            ...item,
            上市年限: parseFloat(上市年限.toFixed(1)),
            年均分红次数: parseFloat(年均分红次数.toFixed(2)),
          };
        });
        setData(processedData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('获取历史分红数据失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateListingYears = (dateStr: string): number => {
    const listingDate = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - listingDate.getTime();
    const years = diff / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, years);
  };


  const columns = useMemo(() => [
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 100,
      align: 'center',
    },
    // todo 点击名称跳转详情页 stock_dividend_cninfo 单次获取指定股票的历史分红数据
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 120,
      align: 'center',
    },
    {
      title: '上市日期',
      dataIndex: '上市日期',
      key: '上市日期',
      width: 150,
      align: 'center',
      render: (text: string) => {
        if (text) {
          const date = new Date(text);
          return date.toLocaleDateString('zh-CN');
        }
        return '-';
      },
    },
    {
      title: '上市年限（年）',
      dataIndex: '上市年限',
      key: '上市年限',
      width: 120,
      align: 'center',
      sorter: numberSorter('上市年限'),
      ...createRangeFilter('上市年限'),
    },
    {
      title: '累计股息(%)',
      dataIndex: '累计股息',
      key: '累计股息',
      width: 100,
      align: 'center',
      sorter: numberSorter('累计股息'),
      ...createRangeFilter('累计股息'),
    },
    {
      title: '年均股息(%)',
      dataIndex: '年均股息',
      key: '年均股息',
      width: 100,
      align: 'center',
      sorter: numberSorter('年均股息'),
      ...createRangeFilter('年均股息'),
    },
    {
      title: '分红次数',
      dataIndex: '分红次数',
      key: '分红次数',
      width: 100,
      align: 'center',
      sorter: numberSorter('分红次数'),
      ...createRangeFilter('分红次数'),
    },
    {
      title: '年均分红次数',
      dataIndex: '年均分红次数',
      key: '年均分红次数',
      width: 120,
      align: 'center',
      sorter: numberSorter('年均分红次数'),
      ...createRangeFilter('年均分红次数'),
    },
    {
      title: '融资总额(亿)',
      dataIndex: '融资总额',
      key: '融资总额',
      width: 100,
      align: 'center',
      sorter: numberSorter('融资总额'),
      ...createRangeFilter('融资总额'),
    },
    {
      title: '融资次数',
      dataIndex: '融资次数',
      key: '融资次数',
      width: 100,
      align: 'center',
      sorter: numberSorter('融资次数'),
      ...createRangeFilter('融资次数'),
    },
  ], []);


  return (
    <div>
      <div style={{ marginBottom: '16px', textAlign: 'right' }}>
        <Button type="primary" onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="代码"
        scroll={{ x: 1000, y: 'calc(100vh - 250px)' }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize });
          },
          onShowSizeChange: (current, size) => {
            setPagination({ current: 1, pageSize: size });
          },
        }}
      />
    </div>
  );
};

export default StockHistoryDividend;
