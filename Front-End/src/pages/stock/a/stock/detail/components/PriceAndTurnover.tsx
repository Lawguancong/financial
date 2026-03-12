import React, { useMemo, memo } from 'react';
import { Line, Column } from '@ant-design/plots';
import moment from 'moment';

interface StockDetailData {
  日期: string;
  收盘: number;
  换手率: number;
}

interface PriceAndTurnoverProps {
  data: StockDetailData[];
}

// 静态样式配置
const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const chartStyle: React.CSSProperties = { height: 400 };

// 图表共享配置 - 静态部分
const baseChartConfig = {
  xField: '日期',
  axis: { x: false },
  height: 300,
};

const PriceAndTurnover: React.FC<PriceAndTurnoverProps> = ({ data }) => {
  // 缓存图表配置
  const lineConfig = useMemo(() => ({
    ...baseChartConfig,
    data,
    yField: '收盘',
    smooth: true,
    yAxis: {
      title: { text: '收盘价' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYYMMDD'),
      items: [{ field: '收盘', name: '收盘价' }],
    },
    lineStyle: { lineWidth: 2 },
  }), [data]);

  const columnConfig = useMemo(() => ({
    ...baseChartConfig,
    data,
    yField: '换手率',
    yAxis: {
      title: { text: '换手率 (%)' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYYMMDD'),
      items: [{ field: '换手率', name: '换手率(%)' }],
    },
    columnStyle: { fill: '#1890ff' },
  }), [data]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={chartStyle}>
        <h4>收盘价趋势</h4>
        <Line {...lineConfig} />
      </div>
      <div style={chartStyle}>
        <h4>换手率趋势</h4>
        <Column {...columnConfig} />
      </div>
    </div>
  );
};

export default memo(PriceAndTurnover);
