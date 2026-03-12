import React from 'react';
import { Line } from '@ant-design/plots';
import { Row, Col } from 'antd';
import moment from 'moment';
import { calculateRSI, convertToKLine } from '@/utils';

interface RsiData {
  日期: string;
  __RSI6__: number;
}

interface RsiPeriodsProps {
  data: any[];
  // dailyRSIData: RsiData[];
  // weeklyRSIData: RsiData[];
  // monthlyRSIData: RsiData[];
  // quarterlyRSIData: RsiData[];
}

const RsiPeriods: React.FC<RsiPeriodsProps> = ({
  data
}) => {

  const weeklyData = convertToKLine({ dailyData: data, period: 'weekly' });
  const monthlyData = convertToKLine({ dailyData: data, period: 'monthly' });
  const quarterlyData = convertToKLine({ dailyData: data, period: 'quarterly' });
  const dailyRSIData = calculateRSI({ data, closeKey: '收盘', period: 6 });
  const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
  const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
  const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });
  return (
    <>
      <div >
        <div style={{ height: 300 }}>
          <div>日K：RSI6</div>
          <Line
            data={dailyRSIData}
            xField={(d: any) => new Date(d.日期)}
            yField="__RSI6__"
            height={200}
            smooth={true}
            xAxis={{
              type: 'time',
              tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
            }}
            yAxis={{
              min: 0,
              max: 100,
              title: { text: '日K RSI6' },
            }}
            tooltip={{
              title: (d: any) => moment(d.日期).format('YYYYMMDD'),
              items: [{ field: '__RSI6__', name: 'RSI6' }],
            }}
          />
        </div>
      </div>
      <div >
        <div style={{ height: 300 }}>
          <div>周K：RSI6</div>
          <Line
            data={weeklyRSIData}
            xField={(d: any) => new Date(d.日期)}
            yField="__RSI6__"
            height={200}
            smooth={true}
            xAxis={{
              type: 'time',
              tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
            }}
            yAxis={{
              min: 0,
              max: 100,
              title: { text: '周K RSI6' },
            }}
            tooltip={{
              title: (d: any) => moment(d.日期).format('YYYYMMDD'),
              items: [{ field: '__RSI6__', name: 'RSI6' }],
            }}
          />
        </div>
      </div>
      <div >
        <div style={{ height: 300 }}>
          <div>月K：RSI6</div>
          <Line
            data={monthlyRSIData}
            xField={(d: any) => new Date(d.日期)}
            yField="__RSI6__"
            height={200}
            smooth={true}
            xAxis={{
              type: 'time',
              tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
            }}
            yAxis={{
              min: 0,
              max: 100,
              title: { text: '月K RSI6' },
            }}
            tooltip={{
              title: (d: any) => moment(d.日期).format('YYYYMMDD'),
              items: [{ field: '__RSI6__', name: 'RSI6' }],
            }}
          />
        </div>
      </div>
      <div >
        <div style={{ height: 300 }}>
          <div>季K：RSI6</div>
          <Line
            data={quarterlyRSIData}
            xField={(d: any) => new Date(d.日期)}
            yField="__RSI6__"
            height={200}
            smooth={true}
            xAxis={{
              type: 'time',
              tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
            }}
            yAxis={{
              min: 0,
              max: 100,
              title: { text: '季K RSI6' },
            }}
            tooltip={{
              title: (d: any) => moment(d.日期).format('YYYYMMDD'),
              items: [{ field: '__RSI6__', name: 'RSI6' }],
            }}
          />
        </div>
      </div>
    </>
  );
};

export default RsiPeriods;