import React, { useEffect, useState } from 'react';
import { Table, Spin, Typography, Card } from 'antd';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  股票代码: string;
  开盘: number;
  收盘: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  振幅: number;
  涨跌幅: number;
  涨跌额: number;
  换手率: number;
}

const StockDetail: React.FC = () => {
  const [data, setData] = useState<StockDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stockName, setStockName] = useState('');
  const [searchParams] = useSearchParams();

  const symbol = searchParams.get('symbol') || '';
  const symbolName = searchParams.get('symbolName') || '';
  const period = searchParams.get('period') || 'daily'; // 'daily', 'weekly', 'monthly'
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const adjust = searchParams.get('adjust') || ''; // 默认返回不复权的数据; qfq: 返回前复权后的数据; hfq: 返回后复权后的数据

  useEffect(() => {
    const fetchStockDetail = async () => {
      if (!symbol) {
        return;
      }

      setLoading(true);
      try {
        const params: Record<string, string> = {
          symbol,
          period,
        };
        
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (adjust) params.adjust = adjust;

        const response = await axios.get('http://127.0.0.1:8080/api/public/stock_zh_a_hist', {
          params,
        });
        console.log('个股详情 -> response', response);
        setData(response?.data || []);
        setStockName(symbol);
      } catch (error) {
        console.log('error', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockDetail();
  }, [symbol, period, startDate, endDate, adjust]);

  const columns = [
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      fixed: 'left' as const,
      sorter: (a: StockDetailData, b: StockDetailData) => {
        return new Date(a.日期).getTime() - new Date(b.日期).getTime();
      },
    },
    {
      title: '股票代码',
      dataIndex: '股票代码',
      key: '股票代码',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '开盘',
      dataIndex: '开盘',
      key: '开盘',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.开盘 - b.开盘,
    },
    {
      title: '收盘',
      dataIndex: '收盘',
      key: '收盘',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.收盘 - b.收盘,
    },
    {
      title: '最高',
      dataIndex: '最高',
      key: '最高',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.最高 - b.最高,
    },
    {
      title: '最低',
      dataIndex: '最低',
      key: '最低',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.最低 - b.最低,
    },
    {
      title: '成交量(手)',
      dataIndex: '成交量',
      key: '成交量',
      width: 120,
      sorter: (a: StockDetailData, b: StockDetailData) => a.成交量 - b.成交量,
    },
    {
      title: '成交额(元)',
      dataIndex: '成交额',
      key: '成交额',
      width: 120,
      sorter: (a: StockDetailData, b: StockDetailData) => a.成交额 - b.成交额,
    },
    {
      title: '振幅(%)',
      dataIndex: '振幅',
      key: '振幅',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.振幅 - b.振幅,
    },
    {
      title: '涨跌幅(%)',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 120,
      sorter: (a: StockDetailData, b: StockDetailData) => a.涨跌幅 - b.涨跌幅,
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
          {value}%
        </span>
      ),
    },
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 100,
      sorter: (a: StockDetailData, b: StockDetailData) => a.涨跌额 - b.涨跌额,
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
          {value}
        </span>
      ),
    },
    {
      title: '换手率(%)',
      dataIndex: '换手率',
      key: '换手率',
      width: 120,
      sorter: (a: StockDetailData, b: StockDetailData) => a.换手率 - b.换手率,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <Title level={4}>{symbolName}({symbol}) - 历史数据</Title>
      </Card>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="日期"
          scroll={{ x: 1500, y: 'calc(100vh - 300px)' }}
          pagination={false}
        />
      </Spin>
    </div>
  );
};

export default StockDetail;
