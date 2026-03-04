import React, { useEffect, useMemo, useState } from 'react';
import { Spin, Typography, Card, Radio } from 'antd';
import { Stock } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';
import testData from './data.json';

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
  const [loading, setLoading] = useState(false);
  const [adjust, setAdjust] = useState<string>('');
  const [period, setPeriod] = useState<string>('daily');
  const [data, setData] = useState<StockDetailData[]>(testData[period as 'daily' | 'weekly' | 'monthly'] || []);
  // const [data, setData] = useState<StockDetailData[]>([]);

  // const [startDate, setStartDate] = useState<string>(moment().subtract(60, 'month').format('YYYYMMDD'));
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(moment().format('YYYYMMDD'));
  const [searchParams] = useSearchParams();

  const symbol = searchParams.get('symbol') || '';
  const symbolName = searchParams.get('symbolName') || '';

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

      const response = await apiClient.get('/api/public/stock_zh_a_hist', {
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

  const color = (d: StockDetailData) => {
    const trend = Math.sign(d.收盘 - d.开盘);
    return trend > 0 ? '#4daf4a' : trend === 0 ? '#999999' : '#e41a1c';
  };

  const getSliderRange = () => {
    if (data.length === 0) {
      return [0, 1];
    }

    const oneMonthAgo = moment().subtract(6, 'month');
    let startIndex = data.findIndex(item => moment(item.日期).isSameOrAfter(oneMonthAgo));

    if (startIndex === -1) {
      startIndex = 0;
    }

    const startRatio = startIndex / (data.length - 1);
    return [Math.max(0, startRatio), 1];
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
        { field: '成交量', name: '成交量' },
        { field: '成交额', name: '成交额' },
        { field: '振幅', name: '振幅' },
        { field: '涨跌幅', name: '涨跌幅' },
        { field: '涨跌额', name: '涨跌额' },
        { field: '换手率', name: '换手率' },
      ],
    },
    axis: {
      x: false
    },
    slider: {
      x: {
        values: getSliderRange(),
        labelFormatter: (d: string) => d,
      },
    },
    interaction: {
      sliderWheel: true, // 启用滚轮缩放交互
      sliderFilter: {
        adaptiveMode: 'filter', // 启用自适应
      }
    },
  };

  console.log('render渲染 个股详情')

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
