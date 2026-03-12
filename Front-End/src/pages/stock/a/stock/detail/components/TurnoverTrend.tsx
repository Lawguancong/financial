import React, { useMemo, memo } from 'react';
import { Area } from '@ant-design/plots';
import moment from 'moment';

interface StockDetailData {
  日期: string;
  换手率: number;
}

interface TurnoverTrendProps {
  data: StockDetailData[];
}

// 静态样式配置
const containerStyle: React.CSSProperties = { height: 450 };

const TurnoverTrend: React.FC<TurnoverTrendProps> = ({ data }) => {
  // 使用 useMemo 缓存所有计算结果
  const { processedData, lowThreshold, highThreshold, legendItems } = useMemo(() => {
    if (data.length === 0) {
      return { processedData: [], lowThreshold: 0, highThreshold: 0, legendItems: [] };
    }

    const turnoverRates = data.map(d => d.换手率).sort((a, b) => a - b);
    const low = turnoverRates[Math.floor(turnoverRates.length * 0.1)];
    const high = turnoverRates[Math.floor(turnoverRates.length * 0.9)];

    const processed = data.map(item => {
      let turnoverLevel = 'normal';
      if (item.换手率 <= low) {
        turnoverLevel = 'low';
      } else if (item.换手率 >= high) {
        turnoverLevel = 'high';
      }
      return {
        ...item,
        turnoverLevel
      };
    });

    const legends = [
      { value: 'low', name: `低换手 (后10%) ≤ ${low.toFixed(2)}%` },
      { value: 'normal', name: '正常换手' },
      { value: 'high', name: `高换手 (前10%) ≥ ${high.toFixed(2)}%` }
    ];

    return {
      processedData: processed,
      lowThreshold: low,
      highThreshold: high,
      legendItems: legends,
    };
  }, [data]);

  // 缓存图表配置
  const chartConfig = useMemo(() => ({
    data: processedData,
    xField: '日期',
    yField: '换手率',
    colorField: 'turnoverLevel',
    xAxis: {
      type: 'time' as const,
      tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
    },
    yAxis: {
      title: { text: '换手率 (%)' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYYMMDD'),
      items: [
        { field: '换手率', name: '换手率' },
        {
          field: 'turnoverLevel',
          name: '换手率水平',
          formatter: (value: string) => {
            switch (value) {
              case 'low': return `低换手 (≤ ${lowThreshold.toFixed(2)}%)`;
              case 'high': return `高换手 (≥ ${highThreshold.toFixed(2)}%)`;
              default: return `正常换手 (${(lowThreshold + 0.01).toFixed(2)}% - ${(highThreshold - 0.01).toFixed(2)}%)`;
            }
          }
        }
      ],
    },
    legend: {
      position: 'top' as const,
      items: legendItems,
    },
  }), [processedData, lowThreshold, highThreshold, legendItems]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={containerStyle}>
      <Area {...chartConfig} />
    </div>
  );
};

export default memo(TurnoverTrend);
