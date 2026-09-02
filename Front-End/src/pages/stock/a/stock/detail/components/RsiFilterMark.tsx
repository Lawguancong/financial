import React, { useMemo, memo } from 'react';
import { Line } from '@ant-design/plots';
import { Table, Typography } from 'antd';
import moment from 'moment';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations } from '@/utils/stockUtils';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  收盘: number;
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







const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data }) => {
  // 使用 useMemo 缓存所有计算结果
  const { filteredByRSI, annotations, chartData } = useMemo(() => {
    if (data?.length === 0) {
      return { filteredByRSI: [], annotations: [], chartData: [] };
    }

    // const rsi6 = calculatePeriodRSI(data);
    // 构建周期RSI映射
    // const rsiMaps = {
    //   daily: buildRSIMap(rsi6.daily, 'daily'),
    //   weekly: buildRSIMap(rsi6.weekly, 'weekly'),
    //   monthly: buildRSIMap(rsi6.monthly, 'monthly'),
    //   quarterly: buildRSIMap(rsi6.quarterly, 'quarterly'),
    // };

    const chartData = computeRSIRecommendations(calculatePeriodRSI(data))

    // 为图表数据添加RSI6字段
    // const chartDataWithRSI = data?.map(item => {
    //   const date = item.日期;
    //   const rsiValues = getRSIValues11(date, rsiMaps);
    //   // const rsiValues = getRSIValues(rsi6.daily, rsi6.weekly, rsi6.monthly, rsi6.quarterly);
    //   return {
    //     ...item,
    //     daily__RSI6__: rsiValues.daily ?? null,
    //     weekly__RSI6__: rsiValues.weekly ?? null,
    //     monthly__RSI6__: rsiValues.monthly ?? null,
    //     quarterly__RSI6__: rsiValues.quarterly ?? null,
    //   };
    // });


    const finalFilteredData = chartData.filter(item => item.__recommendationLevel__ != null);

    return {
      filteredByRSI: finalFilteredData,
      annotations: createRecommendationAnnotations(finalFilteredData),
      chartData,
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
        { field: 'daily__RSI6__', name: '日RSI6' },
        { field: 'weekly__RSI6__', name: '周RSI6' },
        { field: 'monthly__RSI6__', name: '月RSI6' },
        { field: 'quarterly__RSI6__', name: '季RSI6' },
      ],
    },
    annotations,
    lineStyle: { lineWidth: 2 },
  }), [chartData, annotations]);

  if (data?.length === 0) {
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
      <Title level={5}>RSI6 技术指标</Title>
      <div style={chartContainerStyle}>
        <Line {...chartConfig} />
      </div>
    </div>
  );
};

export default memo(RsiFilterMark);
