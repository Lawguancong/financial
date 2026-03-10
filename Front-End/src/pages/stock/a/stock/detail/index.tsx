import React, { useEffect, useMemo, useState } from 'react';
import { Spin, Typography, Card, Radio, Row, Col } from 'antd';
import { Stock, Line } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';
import testData from './data.json';
import { calculateRSI, convertToKLine } from '@/utils/stockUtils';
console.log('222 testData 原始数据', (testData))
const weeklyData = convertToKLine({ dailyData: testData.daily, period: 'weekly' });
const monthlyData = convertToKLine({ dailyData: testData.daily, period: 'monthly' });
const quarterlyData = convertToKLine({ dailyData: testData.daily, period: 'quarterly' });

// 计算周K、月K、季K的RSI6
const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });

console.log('222 weeklyData 周K', weeklyData)
console.log('222 monthlyData 月K', monthlyData)
console.log('222 quarterlyData 季K', quarterlyData)
console.log('222 weeklyRSIData 周K RSI', weeklyRSIData)
console.log('222 monthlyRSIData 月K RSI', monthlyRSIData)
console.log('222 quarterlyRSIData 季K RSI', quarterlyRSIData)

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
  // const [rawData, setRawData] = useState<StockDetailData[]>(testData[period as 'daily' | 'weekly' | 'monthly'] || []);
  const [rawData, setRawData] = useState<StockDetailData[]>([]);
  console.log('1111 rawData', rawData);

  // 计算 RSI6
  // const data = useMemo(() => {
  //   return calculateRSI({
  //     data: rawData,
  //     closeKey: '收盘',
  //     period: 6
  //   });
  // }, [rawData]);
    const data = calculateRSI({
      data: rawData,
      closeKey: '收盘',
      period: 6
    });

  console.log('22222 原始数据', data);
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
      setRawData(response?.data || []);
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
      title: (d: any) => moment(d.日期).format('YYYYMMDD'),
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
        { field: '__RSI__', name: 'RSI6' },
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

  // RSI6 图表配置
  const rsiChartConfig = {
    data,
    xField: (d: StockDetailData) => moment(d.日期).format('YYYYMMDD'),
    yField: '__RSI__',
    smooth: true,
     axis: {
      x: false
    },
    yAxis: {
      min: 0,
      max: 100,
      title: {
        text: 'RSI6',
      },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYYMMDD'),
      items: [
        { field: '__RSI__', name: 'RSI6' },
      ],
    },
    // annotations: [
    //   {
    //     type: 'line',
    //     start: ['min', 70],
    //     end: ['max', 70],
    //     style: {
    //       stroke: '#e41a1c',
    //       lineDash: [4, 4],
    //     },
    //   },
    //   {
    //     type: 'line',
    //     start: ['min', 30],
    //     end: ['max', 30],
    //     style: {
    //       stroke: '#4daf4a',
    //       lineDash: [4, 4],
    //     },
    //   },
    // ],
    slider: {
      x: {
        values: getSliderRange(),
        labelFormatter: (d: string) => d,
      },
    },
    // interaction: {
    //   sliderWheel: true,
    //   sliderFilter: {
    //     adaptiveMode: 'filter',
    //   }
    // },
  };

  useEffect(() => {
    fetchStockDetail();
  }, [period, adjust]);

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
        <Card style={{ marginBottom: '16px' }}>
          {/* <Stock {...chartConfig} /> */}
        </Card>
        <Card>
          <Line {...rsiChartConfig} />
        </Card>
        <Card style={{ marginTop: '16px' }}>
          <Title level={5}>不同周期 RSI6</Title>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ height: 300 }}>
                <div>周K：RSI6</div>
                <Line
                  data={weeklyRSIData}
                  xField={(d: any) => moment(d.日期).format('YYYYMMDD')}
                  yField="__RSI__"
                  smooth={true}
                  yAxis={{
                    min: 0,
                    max: 100,
                    title: { text: '周K RSI6' },
                  }}
                  tooltip={{
                    title: (d: any) => moment(d.日期).format('YYYYMMDD'),
                    items: [{ field: '__RSI__', name: 'RSI6' }],
                  }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ height: 300 }}>
                <div>月K：RSI6</div>
                <Line
                  data={monthlyRSIData}
                  xField={(d: any) => moment(d.日期).format('YYYYMMDD')}
                  yField="__RSI__"
                  smooth={true}
                  yAxis={{
                    min: 0,
                    max: 100,
                    title: { text: '月K RSI6' },
                  }}
                  tooltip={{
                    title: (d: any) => moment(d.日期).format('YYYYMMDD'),
                    items: [{ field: '__RSI__', name: 'RSI6' }],
                  }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ height: 300 }}>
                <div>季K：RSI6</div>
                <Line
                  data={quarterlyRSIData}
                  xField={(d: any) => moment(d.日期).format('YYYYMMDD')}
                  yField="__RSI__"
                  smooth={true}
                  yAxis={{
                    min: 0,
                    max: 100,
                    title: { text: '季K RSI6' },
                  }}
                  tooltip={{
                    title: (d: any) => moment(d.日期).format('YYYYMMDD'),
                    items: [{ field: '__RSI__', name: 'RSI6' }],
                  }}
                />
              </div>
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  );
};

export default StockDetail;
