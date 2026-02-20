import React, { useEffect, useState } from 'react';
import { Spin, Typography, Card, Radio } from 'antd';
import { Stock } from '@ant-design/plots';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';

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
  const [adjust, setAdjust] = useState<string>('');
  const [period, setPeriod] = useState<string>('daily');
  const [searchParams] = useSearchParams();

  const symbol = searchParams.get('symbol') || '';
  const symbolName = searchParams.get('symbolName') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';

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
      } catch (error) {
        console.log('error', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockDetail();
  }, [symbol, period, startDate, endDate, adjust]);

  const color = (d: StockDetailData) => {
    const trend = Math.sign(d.收盘 - d.开盘);
    return trend > 0 ? '#4daf4a' : trend === 0 ? '#999999' : '#e41a1c';
  };

  const chartConfig = {
    data,
    xField: (d: StockDetailData) => moment(d.日期).format('YYYYMMDD'),
    yField: ['开盘', '收盘', '最高', '最低'],
    style: {
      fill: color,
    },
    lineStyle: {
      stroke: color,
    },
    tooltip: {
      title: (d: StockDetailData) => moment(d.日期).format('YYYYMMDD'),
      items: [
        { field: '开盘', name: '开盘价' },
        { field: '收盘', name: '收盘价' },
        { field: '最低', name: '最低价' },
        { field: '最高', name: '最高价' },
      ],
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>{symbolName}({symbol})</Title>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)}>
              <Radio.Button value="daily">日K</Radio.Button>
              <Radio.Button value="weekly">周K</Radio.Button>
              <Radio.Button value="monthly">月K</Radio.Button>
            </Radio.Group>
            <Radio.Group value={adjust} onChange={(e) => setAdjust(e.target.value)}>
              <Radio.Button value="">不复权</Radio.Button>
              <Radio.Button value="qfq">前复权</Radio.Button>
              <Radio.Button value="hfq">后复权</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </Card>
      <Spin spinning={loading}>
        <Card>
          <Stock {...chartConfig} />
        </Card>
      </Spin>
    </div>
  );
};

export default StockDetail;
