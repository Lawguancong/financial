import React, { useMemo, memo } from 'react';
import { Line } from '@ant-design/plots';
import { Table, Typography } from 'antd';
import moment from 'moment';
import { calculateRSI, convertToKLine, filterKLineByRSI } from '@/utils/stockUtils';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  收盘: number;
  开盘: number;
  最高: number;
  最低: number;
  换手率?: number;
}

interface RsiFilterMarkProps {
  data: StockDetailData[];
}

// 静态样式配置
const tableStyle: React.CSSProperties = { marginBottom: '16px' };
const chartContainerStyle: React.CSSProperties = { height: 450 };

// 表格列配置 - 静态定义，避免每次渲染重新创建
const columns = [
  {
    title: '推荐级别',
    dataIndex: '__recommendationLevel__',
    key: '__recommendationLevel__',
    render: (level: number) => <span style={{ color: '#ffd700' }}>{'★'.repeat(level)}</span>,
  },
  {
    title: '日期',
    dataIndex: '日期',
    key: '日期',
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: '收盘价',
    dataIndex: '收盘',
    key: '收盘',
  },
  {
    title: '日RSI6',
    dataIndex: 'daily__RSI6__',
    key: 'daily__RSI6__',
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: '周RSI6',
    dataIndex: 'weekly__RSI6__',
    key: 'weekly__RSI6__',
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: '月RSI6',
    dataIndex: 'monthly__RSI6__',
    key: 'monthly__RSI6__',
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: '季RSI6',
    dataIndex: 'quarterly__RSI6__',
    key: 'quarterly__RSI6__',
    render: (value: number) => value?.toFixed(2),
  },
];

// 辅助函数：构建周期RSI映射
const buildRSIMap = (rsiData: any[], period: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
  const map: Record<string, number> = {};
  
  if (rsiData.length === 0) {
    return map;
  }
  
  // 按日期排序
  const sortedData = [...rsiData].sort((a, b) => a.日期.localeCompare(b.日期));
  
  sortedData.forEach(item => {
    const date = moment(item.日期, 'YYYYMMDD');
    const rsi = item.__RSI6__;
    
    let start: moment.Moment;
    let end: moment.Moment;
    
    switch (period) {
      case 'daily':
        map[item.日期] = rsi;
        return;
      case 'weekly':
        start = date.clone().startOf('isoWeek');
        end = date.clone().endOf('isoWeek');
        break;
      case 'monthly':
        start = date.clone().startOf('month');
        end = date.clone().endOf('month');
        break;
      case 'quarterly':
        start = date.clone().startOf('quarter');
        end = date.clone().endOf('quarter');
        break;
    }
    
    // 填充周期内的每一天
    let current = start!.clone();
    while (current.isSameOrBefore(end!)) {
      map[current.format('YYYYMMDD')] = rsi;
      current.add(1, 'day');
    }
  });
  
  return map;
};

// 辅助函数：查找RSI值，带回退逻辑
const findRSIValue = (date: string, rsiMap: Record<string, number>, maxDays: number = 7) => {
  // 首先尝试直接查找
  let rsi = rsiMap[date];
  if (rsi !== undefined) {
    return rsi;
  }
  
  // 如果没找到，尝试查找最近的RSI
  const dateMoment = moment(date, 'YYYYMMDD');
  for (let i = 1; i <= maxDays; i++) {
    const prevDate = dateMoment.clone().subtract(i, 'day').format('YYYYMMDD');
    const nextDate = dateMoment.clone().add(i, 'day').format('YYYYMMDD');
    
    if (rsiMap[prevDate] !== undefined) {
      return rsiMap[prevDate];
    }
    if (rsiMap[nextDate] !== undefined) {
      return rsiMap[nextDate];
    }
  }
  
  return undefined;
};

// 辅助函数：获取所有RSI值
const getRSIValues = (date: string, maps: {
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  quarterly: Record<string, number>;
}) => {
  return {
    daily: findRSIValue(date, maps.daily, 1),
    weekly: findRSIValue(date, maps.weekly, 7),
    monthly: findRSIValue(date, maps.monthly, 31),
    quarterly: findRSIValue(date, maps.quarterly, 92),
  };
};

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data }) => {
  // 使用 useMemo 缓存所有计算结果
  const { filteredByRSI, annotations, chartData } = useMemo(() => {
    if (data.length === 0) {
      return { filteredByRSI: [], annotations: [], chartData: [] };
    }

    // 计算不同周期的K线数据
    const weeklyData = convertToKLine({ dailyData: data, period: 'weekly' });
    const monthlyData = convertToKLine({ dailyData: data, period: 'monthly' });
    const quarterlyData = convertToKLine({ dailyData: data, period: 'quarterly' });

    // 计算不同周期的RSI
    const dailyRSIData = calculateRSI({ data, closeKey: '收盘', period: 6 });
    const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
    const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
    const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });

    // 构建周期RSI映射
    const rsiMaps = {
      daily: buildRSIMap(dailyRSIData, 'daily'),
      weekly: buildRSIMap(weeklyRSIData, 'weekly'),
      monthly: buildRSIMap(monthlyRSIData, 'monthly'),
      quarterly: buildRSIMap(quarterlyRSIData, 'quarterly'),
    };

    // 过滤RSI数据
    const filteredData = filterKLineByRSI({
      dailyData: dailyRSIData,
      weeklyData: weeklyRSIData,
      monthlyData: monthlyRSIData,
      quarterlyData: quarterlyRSIData,
      // rsiThreshold: 28,
    })?.map(item => {
      const date = item.日期;
      const rsiValues = getRSIValues(date, rsiMaps);
      
      return {
        日期: date,
        收盘: item.收盘,
        换手率: item.换手率,
        daily__RSI6__: item.__RSI6__, // 直接使用计算好的日线RSI
        weekly__RSI6__: rsiValues.weekly ?? null,
        monthly__RSI6__: rsiValues.monthly ?? null,
        quarterly__RSI6__: rsiValues.quarterly ?? null,
        __recommendationLevel__: item.__recommendationLevel__,
      };
    }) || [];

    // 为图表数据添加RSI6字段
    const chartDataWithRSI = data.map(item => {
      const date = item.日期;
      const rsiValues = getRSIValues(date, rsiMaps);
      
      return {
        ...item,
        daily__RSI6__: rsiValues.daily ?? null,
        weekly__RSI6__: rsiValues.weekly ?? null,
        monthly__RSI6__: rsiValues.monthly ?? null,
        quarterly__RSI6__: rsiValues.quarterly ?? null,
      };
    });

    // 过滤掉历史时间不足2年的数据
    let finalFilteredData = filteredData;
    if (data.length > 0) {
      // 计算数据的最早日期
      const dates = data.map(item => moment(item.日期, 'YYYYMMDD'));
      const earliestDate = moment.min(dates);
      const currentDate = moment();
      const yearsDiff = currentDate.diff(earliestDate, 'years');
      
      // 只有历史数据满2年才返回推荐买点
      if (yearsDiff < 2) {
        finalFilteredData = [];
      } else {
        // 过滤掉上市前2年内的标注点
        finalFilteredData = finalFilteredData.filter(item => {
          const itemDate = moment(item.日期, 'YYYYMMDD');
          return itemDate.diff(earliestDate, 'years') >= 2;
        });
      }
    }

    return {
      filteredByRSI: finalFilteredData,
      annotations: finalFilteredData.map(item => {
        // 根据推荐级别设置颜色
        let color = '#008000';
        let fontSize = 12;
        const level = item.__recommendationLevel__;
        if (level === 5) {
          color = '#008000';
          fontSize = 12;
        } else if (level === 3) {
          color = '#42b242ff';
          fontSize = 10;
        } else if (level === 1) {
          color = '#9fe49fff';
          fontSize = 8;
        }

        return {
          type: 'text' as const,
          data: [new Date(item.日期), item.收盘],
          style: {
            text: '●',
            fontSize: fontSize,
            dx: -(fontSize/2),
            stroke: color,
            fill: color,
          },
        };
      }),
      chartData: chartDataWithRSI,
    };
  }, [data]);

  // 缓存图表配置
  const chartConfig = useMemo(() => ({
    data: chartData,
    xField: (d: any) => new Date(d.日期),
    yField: '收盘',
    smooth: true,
    yAxis: {
      title: { text: '收盘价' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYY-MM-DD'),
      items: [
        { field: '收盘', name: '收盘价' },
        { field: '开盘', name: '开盘价' },
        { field: '最高', name: '最高价' },
        { field: '最低', name: '最低价' },
        { field: 'daily__RSI6__', name: '日RSI6' },
        { field: 'weekly__RSI6__', name: '周RSI6' },
        { field: 'monthly__RSI6__', name: '月RSI6' },
        { field: 'quarterly__RSI6__', name: '季RSI6' },
      ],
    },
    annotations,
    lineStyle: { lineWidth: 2 },
  }), [chartData, annotations]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div>
      <Title level={5}>推荐买点</Title>
      <Table
        dataSource={filteredByRSI}
        columns={columns}
        rowKey="日期"
        pagination={false}
        style={tableStyle}
      />
      <Title level={5}>RSI6 超卖（日k/后复权）</Title>
      <div style={chartContainerStyle}>
        <Line {...chartConfig} />
      </div>
    </div>
  );
};

export default memo(RsiFilterMark);
