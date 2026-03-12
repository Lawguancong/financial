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

    // 构建周期RSI映射 - 使用对象替代 Map 提高性能
    const weeklyRSIMap: Record<string, number> = {};
    const monthlyRSIMap: Record<string, number> = {};
    const quarterlyRSIMap: Record<string, number> = {};

    // 构建周RSI映射 - 为每个周K线数据，填充该周的所有日期
    if (weeklyRSIData.length > 0) {
      // 按日期排序
      const sortedWeeklyData = [...weeklyRSIData].sort((a, b) => a.日期.localeCompare(b.日期));
      
      sortedWeeklyData.forEach((item, index) => {
        const weekEnd = moment(item.日期, 'YYYYMMDD');
        const weekStart = weekEnd.clone().startOf('isoWeek');
        const weekEndFixed = weekEnd.clone().endOf('isoWeek');
        const rsi = item.__RSI6__;
        
        // 填充整周的每一天
        let current = weekStart.clone();
        while (current.isSameOrBefore(weekEndFixed)) {
          weeklyRSIMap[current.format('YYYYMMDD')] = rsi;
          current.add(1, 'day');
        }
      });
    }

    // 构建月RSI映射 - 为每个月K线数据，填充该月的所有日期
    if (monthlyRSIData.length > 0) {
      // 按日期排序
      const sortedMonthlyData = [...monthlyRSIData].sort((a, b) => a.日期.localeCompare(b.日期));
      
      sortedMonthlyData.forEach((item, index) => {
        const monthEnd = moment(item.日期, 'YYYYMMDD');
        const monthStart = monthEnd.clone().startOf('month');
        const monthEndFixed = monthEnd.clone().endOf('month');
        const rsi = item.__RSI6__;
        
        // 填充整月的每一天
        let current = monthStart.clone();
        while (current.isSameOrBefore(monthEndFixed)) {
          monthlyRSIMap[current.format('YYYYMMDD')] = rsi;
          current.add(1, 'day');
        }
      });
    }

    // 构建季RSI映射 - 为每个季K线数据，填充该季的所有日期
    if (quarterlyRSIData.length > 0) {
      // 按日期排序
      const sortedQuarterlyData = [...quarterlyRSIData].sort((a, b) => a.日期.localeCompare(b.日期));
      
      sortedQuarterlyData.forEach((item, index) => {
        const quarterEnd = moment(item.日期, 'YYYYMMDD');
        const quarterStart = quarterEnd.clone().startOf('quarter');
        const quarterEndFixed = quarterEnd.clone().endOf('quarter');
        const rsi = item.__RSI6__;
        
        // 填充整季的每一天
        let current = quarterStart.clone();
        while (current.isSameOrBefore(quarterEndFixed)) {
          quarterlyRSIMap[current.format('YYYYMMDD')] = rsi;
          current.add(1, 'day');
        }
      });
    }

    // 过滤RSI数据
    const filteredData = filterKLineByRSI({
      dailyData: dailyRSIData,
      weeklyData: weeklyRSIData,
      monthlyData: monthlyRSIData,
      quarterlyData: quarterlyRSIData,
      rsiThreshold: 28,
    })?.map(item => {
      const date = item.日期;
      
      // 查找周RSI
      let weeklyRSI = weeklyRSIMap[date];
      if (weeklyRSI === undefined) {
        // 如果没找到，尝试查找最近的周RSI
        const dateMoment = moment(date, 'YYYYMMDD');
        for (let i = 1; i <= 7; i++) {
          const prevDate = dateMoment.clone().subtract(i, 'day').format('YYYYMMDD');
          const nextDate = dateMoment.clone().add(i, 'day').format('YYYYMMDD');
          if (weeklyRSIMap[prevDate] !== undefined) {
            weeklyRSI = weeklyRSIMap[prevDate];
            break;
          }
          if (weeklyRSIMap[nextDate] !== undefined) {
            weeklyRSI = weeklyRSIMap[nextDate];
            break;
          }
        }
      }
      
      // 查找月RSI
      let monthlyRSI = monthlyRSIMap[date];
      if (monthlyRSI === undefined) {
        // 如果没找到，尝试查找最近的月RSI
        const dateMoment = moment(date, 'YYYYMMDD');
        for (let i = 1; i <= 31; i++) {
          const prevDate = dateMoment.clone().subtract(i, 'day').format('YYYYMMDD');
          const nextDate = dateMoment.clone().add(i, 'day').format('YYYYMMDD');
          if (monthlyRSIMap[prevDate] !== undefined) {
            monthlyRSI = monthlyRSIMap[prevDate];
            break;
          }
          if (monthlyRSIMap[nextDate] !== undefined) {
            monthlyRSI = monthlyRSIMap[nextDate];
            break;
          }
        }
      }
      
      // 查找季RSI
      let quarterlyRSI = quarterlyRSIMap[date];
      if (quarterlyRSI === undefined) {
        // 如果没找到，尝试查找最近的季RSI
        const dateMoment = moment(date, 'YYYYMMDD');
        for (let i = 1; i <= 92; i++) {
          const prevDate = dateMoment.clone().subtract(i, 'day').format('YYYYMMDD');
          const nextDate = dateMoment.clone().add(i, 'day').format('YYYYMMDD');
          if (quarterlyRSIMap[prevDate] !== undefined) {
            quarterlyRSI = quarterlyRSIMap[prevDate];
            break;
          }
          if (quarterlyRSIMap[nextDate] !== undefined) {
            quarterlyRSI = quarterlyRSIMap[nextDate];
            break;
          }
        }
      }
      
      return {
        日期: date,
        收盘: item.收盘,
        换手率: item.换手率,
        daily__RSI6__: item.__RSI6__,
        weekly__RSI6__: weeklyRSI ?? null,
        monthly__RSI6__: monthlyRSI ?? null,
        quarterly__RSI6__: quarterlyRSI ?? null,
      };
    }) || [];

    // 构建图表标注
    const rsiAnnotations = filteredData.map(item => ({
      type: 'text' as const,
      data: [new Date(item.日期), item.收盘],
      style: {
        text: '●',
        fontSize: 6,
        dx: -3,
        stroke: '#ff4d4f',
        fill: '#ff4d4f',
      },
    }));

    return {
      filteredByRSI: filteredData,
      annotations: rsiAnnotations,
      chartData: data,
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
      <Title level={5}>RSI 过滤日期标记</Title>
      <div style={chartContainerStyle}>
        <Line {...chartConfig} />
      </div>
    </div>
  );
};

export default memo(RsiFilterMark);
