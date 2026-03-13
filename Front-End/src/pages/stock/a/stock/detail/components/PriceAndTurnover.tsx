import React, { useMemo, memo } from 'react';
import { Line, Column, DualAxes } from '@ant-design/plots';
import moment from 'moment';
import { calculateMaxDrawdown } from '@/utils/stockUtils';

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

const PriceAndTurnover: React.FC<PriceAndTurnoverProps> = ({ data }) => {
  // 使用 useMemo 计算包含最大回撤率和年化收益率的数据
  const enrichedData = useMemo(() => {
    if (data.length === 0) return [];
    return calculateMaxDrawdown({
      data,
      leftKey: '收盘',
      dateKey: '日期',
      percentKey: '换手率',
    });
  }, [data]);

  // 格式化数据为 DualAxes 需要的格式
  const chartData = useMemo(() => {
    if (enrichedData.length === 0) return { leftData: [], rightData: [] };
    
    const leftData = enrichedData.map(item => ({
      date: item.日期,
      key: '收盘',
      label: '收盘价',
      value: item.收盘,
    }));
    
    const rightData = enrichedData.flatMap(item => [
      {
        date: item.日期,
        key: '__最大回撤率__',
        label: '最大回撤率(%)',
        value: item.__最大回撤率__,
      },
      {
        date: item.日期,
        key: '__年化收益率__',
        label: '年化收益率(%)',
        value: item.__年化收益率__,
      },
    ]);
    
    return { leftData, rightData };
  }, [enrichedData]);

  // 缓存收盘价趋势图配置 - 使用 DualAxes 显示多个指标
  const priceChartConfig = useMemo(() => ({
    data: [chartData.leftData, chartData.rightData],
    xField: (d: { date: string }) => new Date(d.date),
    children: [
      {
        data: chartData.leftData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: {
          stroke: '#1890ff',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: '收盘价',
            style: { titleFill: '#1890ff' },
          },
        },
      },
      {
        data: chartData.rightData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        axis: {
          y: {
            position: 'right',
            title: '回撤率/收益率(%)',
            style: { titleFill: '#ff4d4f' },
          },
        },
      },
    ],
    // tooltip: {
    //   title: (d: any) => moment(d.date).format('YYYYMMDD'),
    //   items: [
    //     { field: 'value', name: '收盘价' },
    //     { field: 'value', name: '最大回撤率(%)' },
    //     { field: 'value', name: '年化收益率(%)' },
    //   ],
    // },
    legend: {
      position: 'top',
    },
  }), [chartData]);

  // 缓存换手率趋势图配置
  const columnConfig = useMemo(() => ({
    data: enrichedData,
    xField: '日期',
    yField: '换手率',
    height: 300,
    axis: { x: false },
    yAxis: {
      title: { text: '换手率 (%)' },
    },
    // tooltip: {
    //   title: (d: any) => moment(d.日期).format('YYYYMMDD'),
    //   items: [
    //     { field: '换手率', name: '换手率(%)' },
    //     { field: '__最大回撤率__', name: '最大回撤率(%)' },
    //     { field: '__年化收益率__', name: '年化收益率(%)' },
    //   ],
    // },
    columnStyle: { fill: '#1890ff' },
  }), [enrichedData]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={containerStyle}>
      {/* <div style={chartStyle}> */}
        <h4>收盘价趋势</h4>
        <DualAxes {...priceChartConfig} />
      {/* </div> */}
      {/* <div style={chartStyle}>
        <h4>换手率趋势</h4>
        <Column {...columnConfig} />
      </div> */}
    </div>
  );
};

export default memo(PriceAndTurnover);
