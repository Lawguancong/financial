import React, { useMemo, memo } from 'react';
import { Line } from '@ant-design/plots';
import moment from 'moment';
import { calculateRSI, convertToKLine } from '@/utils';

interface RsiPeriodsProps {
  data: any[];
}

// 静态样式配置
const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
const chartContainerStyle: React.CSSProperties = { height: 300 };
const labelStyle: React.CSSProperties = { fontWeight: 'bold', marginBottom: '8px' };

// 图表共享配置 - 静态部分
const baseChartConfig = {
  xField: (d: any) => new Date(d.日期),
  yField: '__RSI6__',
  height: 200,
  smooth: true,
  xAxis: {
    type: 'time' as const,
    tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
  },
  yAxis: {
    min: 0,
    max: 100,
  },
  tooltip: {
    title: (d: any) => moment(d.日期).format('YYYYMMDD'),
    items: [{ field: '__RSI6__', name: 'RSI6' }],
  },
};

const RsiPeriods: React.FC<RsiPeriodsProps> = ({ data }) => {
  // 使用 useMemo 缓存所有计算结果
  const { dailyRSIData, weeklyRSIData, monthlyRSIData, quarterlyRSIData } = useMemo(() => {
    if (data.length === 0) {
      return {
        dailyRSIData: [],
        weeklyRSIData: [],
        monthlyRSIData: [],
        quarterlyRSIData: [],
      };
    }

    // 计算不同周期的K线数据
    const weeklyData = convertToKLine({ dailyData: data, period: 'weekly' });
    const monthlyData = convertToKLine({ dailyData: data, period: 'monthly' });
    const quarterlyData = convertToKLine({ dailyData: data, period: 'quarterly' });

    // 计算不同周期的RSI
    return {
      dailyRSIData: calculateRSI({ data, closeKey: '收盘', period: 6 }),
      weeklyRSIData: calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 }),
      monthlyRSIData: calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 }),
      quarterlyRSIData: calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 }),
    };
  }, [data]);

  // 缓存各图表配置
  const dailyConfig = useMemo(() => ({
    ...baseChartConfig,
    data: dailyRSIData,
    yAxis: { ...baseChartConfig.yAxis, title: { text: '日K RSI6' } },
  }), [dailyRSIData]);

  const weeklyConfig = useMemo(() => ({
    ...baseChartConfig,
    data: weeklyRSIData,
    yAxis: { ...baseChartConfig.yAxis, title: { text: '周K RSI6' } },
  }), [weeklyRSIData]);

  const monthlyConfig = useMemo(() => ({
    ...baseChartConfig,
    data: monthlyRSIData,
    yAxis: { ...baseChartConfig.yAxis, title: { text: '月K RSI6' } },
  }), [monthlyRSIData]);

  const quarterlyConfig = useMemo(() => ({
    ...baseChartConfig,
    data: quarterlyRSIData,
    yAxis: { ...baseChartConfig.yAxis, title: { text: '季K RSI6' } },
  }), [quarterlyRSIData]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={chartContainerStyle}>
        <div style={labelStyle}>日K：RSI6</div>
        <Line {...dailyConfig} />
      </div>
      <div style={chartContainerStyle}>
        <div style={labelStyle}>周K：RSI6</div>
        <Line {...weeklyConfig} />
      </div>
      <div style={chartContainerStyle}>
        <div style={labelStyle}>月K：RSI6</div>
        <Line {...monthlyConfig} />
      </div>
      <div style={chartContainerStyle}>
        <div style={labelStyle}>季K：RSI6</div>
        <Line {...quarterlyConfig} />
      </div>
    </div>
  );
};

export default memo(RsiPeriods);
