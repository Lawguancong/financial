import React, { useEffect, useState } from 'react';
import { Spin, Typography, Card, Radio, Tabs, Row, Col } from 'antd';
import { Line, Area } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';
import { calculateRSI, convertToKLine, filterKLineByRSI, findThreeConsecutiveRises } from '@/utils/stockUtils';
import PriceAndTurnover from './components/PriceAndTurnover';
import TurnoverTrend from './components/TurnoverTrend';
import RsiFilterMark from './components/RsiFilterMark';
import ThreeConsecutiveRisesComponent from './components/ThreeConsecutiveRises';
import RsiPeriods from './components/RsiPeriods';

const { Title } = Typography;
const { TabPane } = Tabs;

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
  const [symbolInfo, setSymbolInfo] = useState<Record<string, string>>({});
  // console.log('symbolInfo', symbolInfo)
  const [rawData, setRawData] = useState<StockDetailData[]>([]);
  // const [rsiData, setRsiData] = useState({
  //   dailyRSIData: [],
  //   weeklyRSIData: [],
  //   monthlyRSIData: [],
  //   quarterlyRSIData: [],
  // });

  // console.log('222 response1?.data 日数据', rawData)
  // console.log('222 findThreeConsecutiveRises', findThreeConsecutiveRises({ rawData }))
  // console.log('222 weeklyData 周数据', rsiData.weeklyRSIData)
  // console.log('222 monthlyData 月数据', rsiData.monthlyRSIData)
  // console.log('222 quarterlyData 季数据', rsiData.quarterlyRSIData)

  // console.log('222 dailyRSIData 日K RSI6', rsiData.dailyRSIData)
  // console.log('222 weeklyRSIData 周K RSI6', rsiData.weeklyRSIData)
  // console.log('222 monthlyRSIData 月K RSI6', rsiData.monthlyRSIData)
  // console.log('222 quarterlyRSIData 季K RSI6', rsiData.quarterlyRSIData)

  // console.log('222 sort 季K RSI6', [...rsiData.quarterlyRSIData].sort((a, b) => a?.__RSI6__ - b?.__RSI6__))
  // console.log('222 sort 季K RSI6', [...rsiData.quarterlyRSIData].sort((a, b) => b?.__RSI6__ - a?.__RSI6__))
  // console.log('222 filterKLineByRSI', filterKLineByRSI({
  //   dailyData: rsiData.dailyRSIData,
  //   weeklyData: rsiData.weeklyRSIData,
  //   monthlyData: rsiData.monthlyRSIData,
  //   quarterlyData: rsiData.quarterlyRSIData,
  //   rsiThreshold: 28,
  // }))

  // const data = calculateRSI({
  //   data: rawData,
  //   closeKey: '收盘',
  //   period: 6
  // });

  // console.log('22222 原始数据', data);

  // const [startDate, setStartDate] = useState<string>('');
  // const [endDate, setEndDate] = useState<string>(moment().format('YYYYMMDD'));

  const [searchParams] = useSearchParams();

  const symbol = searchParams.get('symbol') || '';
  // const symbolInfo = searchParams.get('symbolInfo') || '';

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

      // if (startDate) params.start_date = startDate;
      // if (endDate) params.end_date = endDate;
      if (adjust) params.adjust = adjust;

      const [response1, response2] = await Promise.all([
        apiClient.get('/api/public/stock_zh_a_hist', {
          params,
        }),
        apiClient.get('/api/public/stock_individual_info_em', {
          params: {
            symbol,
          }
        }),
      ]);

      setRawData(response1?.data || []);
      setSymbolInfo(response2?.data?.reduce((acc: Record<string, string>, curr: { item: string, value: string }) => {
        acc[curr.item] = curr.value;
        return acc;
      }, {}));

      // const weeklyData = convertToKLine({ dailyData: response1?.data || [], period: 'weekly' });
      // const monthlyData = convertToKLine({ dailyData: response1?.data || [], period: 'monthly' });
      // const quarterlyData = convertToKLine({ dailyData: response1?.data || [], period: 'quarterly' });

      // const dailyRSIData = calculateRSI({ data: response1?.data || [], closeKey: '收盘', period: 6 });
      // const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
      // const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
      // const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });

      // setRsiData({
      //   dailyRSIData,
      //   weeklyRSIData,
      //   monthlyRSIData,
      //   quarterlyRSIData,
      // })
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  // const color = (d: StockDetailData) => {
  //   const trend = Math.sign(d.收盘 - d.开盘);
  //   return trend > 0 ? '#4daf4a' : trend === 0 ? '#999999' : '#e41a1c';
  // };

  // const getSliderRange = () => {
  //   if (data.length === 0) {
  //     return [0, 1];
  //   }

  //   const oneMonthAgo = moment().subtract(6, 'month');
  //   let startIndex = data.findIndex(item => moment(item.日期).isSameOrAfter(oneMonthAgo));

  //   if (startIndex === -1) {
  //     startIndex = 0;
  //   }

  //   const startRatio = startIndex / (data.length - 1);
  //   return [Math.max(0, startRatio), 1];
  // };

  // const chartConfig = {
  //   data,
  //   xField: (d: StockDetailData) => moment(d.日期).format('YYYYMMDD'),
  //   yField: ['开盘', '收盘', '最高', '最低'],
  //   style: {
  //     fill: color,
  //   },
  //   lineStyle: {
  //     stroke: color,
  //   },
  //   tooltip: {
  //     title: (d: any) => moment(d.日期).format('YYYYMMDD'),
  //     items: [
  //       { field: '开盘', name: '开盘价' },
  //       { field: '收盘', name: '收盘价' },
  //       { field: '最低', name: '最低价' },
  //       { field: '最高', name: '最高价' },
  //       { field: '成交量', name: '成交量' },
  //       { field: '成交额', name: '成交额' },
  //       { field: '振幅', name: '振幅' },
  //       { field: '涨跌幅', name: '涨跌幅' },
  //       { field: '涨跌额', name: '涨跌额' },
  //       { field: '换手率', name: '换手率' },
  //       { field: '__RSI6__', name: 'RSI6' },
  //     ],
  //   },
  //   axis: {
  //     x: false
  //   },
  //   slider: {
  //     x: {
  //       values: getSliderRange(),
  //       labelFormatter: (d: string) => d,
  //     },
  //   },
  //   interaction: {
  //     sliderWheel: true,
  //     sliderFilter: {
  //       adaptiveMode: 'filter',
  //     }
  //   },
  // };

  // const rsiChartConfig = {
  //   data,
  //   xField: (d: StockDetailData) => moment(d.日期).format('YYYYMMDD'),
  //   yField: '__RSI6__',
  //   smooth: true,
  //   axis: {
  //     x: false
  //   },
  //   yAxis: {
  //     min: 0,
  //     max: 100,
  //     title: {
  //       text: 'RSI6',
  //     },
  //   },
  //   tooltip: {
  //     title: (d: any) => moment(d.日期).format('YYYYMMDD'),
  //     items: [
  //       { field: '__RSI6__', name: 'RSI6' },
  //     ],
  //   },
  //   slider: {
  //     x: {
  //       values: getSliderRange(),
  //       labelFormatter: (d: string) => d,
  //     },
  //   },
  // };

  useEffect(() => {
    fetchStockDetail();
  }, [period, adjust]);

  // console.log('render渲染 个股详情')

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>{symbolInfo?.['股票简称']}({symbolInfo?.['股票代码']})</Title>
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
        <Tabs defaultActiveKey="rsi-filter">
          <TabPane tab="价格与换手率" key="price-turnover">
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>价格与换手率</Title>
              <PriceAndTurnover data={rawData} />
            </Card>
          </TabPane>
          <TabPane tab="RSI 过滤日期标记" key="rsi-filter">
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>RSI 过滤日期标记</Title>
              <RsiFilterMark data={rawData} />
            </Card>
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>不同周期 RSI6</Title>
              <RsiPeriods 
                data={rawData}
                // dailyRSIData={rsiData.dailyRSIData}
                // weeklyRSIData={rsiData.weeklyRSIData}
                // monthlyRSIData={rsiData.monthlyRSIData}
                // quarterlyRSIData={rsiData.quarterlyRSIData}
              />
            </Card>
          </TabPane>
          {/* <TabPane tab="换手率趋势" key="turnover">
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>换手率趋势</Title>
              <TurnoverTrend data={rawData} />
            </Card>
          </TabPane>
          
          <TabPane tab="三连阳日期标记" key="three-rises">
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>三连阳日期标记</Title>
              <ThreeConsecutiveRisesComponent data={rawData} />
            </Card>
          </TabPane>
          <TabPane tab="不同周期 RSI6" key="rsi-periods">
            <Card style={{ marginTop: '16px' }}>
              <Title level={5}>不同周期 RSI6</Title>
              <RsiPeriods 
                dailyRSIData={rsiData.dailyRSIData}
                weeklyRSIData={rsiData.weeklyRSIData}
                monthlyRSIData={rsiData.monthlyRSIData}
                quarterlyRSIData={rsiData.quarterlyRSIData}
              />
            </Card>
          </TabPane> */}
        </Tabs>
      </Spin>
    </div>
  );
};

export default StockDetail;