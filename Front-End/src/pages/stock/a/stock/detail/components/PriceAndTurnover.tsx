import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { DualAxes } from '@ant-design/plots';
import { Radio, Spin } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio';
import { calculateMaxDrawdown } from '@/utils/stockUtils';
import apiClient from '@/utils/axios';
import { useSearchParams } from 'react-router-dom';

// 复权选项配置
const ADJUST_OPTIONS = [
  { value: 'qfq', label: '前复权' },
  { value: '', label: '不复权' },
  { value: 'hfq', label: '后复权' },
] as const;

// 图表配置常量
const CHART_Y_LEFT = { title: '收盘价', style: { titleFill: '#1890ff' } };
const CHART_Y_RIGHT = { title: '回撤率(%) & 年化收益率(%)', style: { titleFill: '#ff4d4f' } };

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const toolbarStyle: React.CSSProperties = {
  display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12,
};

// ====== 自定义 Hooks ======

/** 获取股票历史行情数据 */
const useStockData = (symbol: string, adjust: string) => {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    const fetchData = async () => {
      try {
        const prefix = symbol.startsWith('9')
          ? 'bj'
          : symbol.startsWith('6')
          ? 'sh'
          : symbol.startsWith('0')
          ? 'sz'
          : '';
        const params: Record<string, string> = {
          symbol: prefix ? `${prefix}${symbol}` : symbol,
          adjust,
        };
        const response = await apiClient.get('/api/public/stock_zh_a_hist_tx', { params });
        setData(response?.data?.map((item: Record<string, unknown>) => ({
          日期: item.date,
          收盘: Number(item.close),
        })) || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol, adjust]);

  return { data, loading };
};

/** 计算图表配置 */
const useChartConfig = (data: Record<string, unknown>[]) => useMemo(() => {
  if (data.length === 0) return null;

  const enrichedData = calculateMaxDrawdown({ data, leftKey: '收盘', dateKey: '日期' });
  console.log('111 data', data)
  console.log('111 enrichedData', enrichedData)
  const leftData = enrichedData.map(item => ({
    date: item.日期,
    key: '收盘',
    label: '收盘价',
    value: item.收盘,
  }));

  const rightData = enrichedData.flatMap(item => [
    { date: item.日期, key: '__最大回撤率__', label: '最大回撤率(%)', value: item.__最大回撤率__ },
    ...(item.__年化收益率__ != null
      ? [{ date: item.日期, key: '__年化收益率__', label: '年化收益率(%)', value: item.__年化收益率__ }]
      : []),
  ]);

  return {
    data: [leftData, rightData],
    xField: (d: { date: string }) => new Date(d.date),
    children: [
      {
        data: leftData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: { stroke: '#1890ff', lineWidth: 2 },
        axis: { y: CHART_Y_LEFT },
      },
      {
        data: rightData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        axis: { y: { position: 'right', ...CHART_Y_RIGHT } },
      },
    ],
  };
}, [data]);


// ====== 子组件 ======

/** 复权方式切换按钮 */
const AdjustRadio: React.FC<{ value: string; onChange: (e: RadioChangeEvent) => void }> =
  React.memo(({ value, onChange }) => (
    <div style={toolbarStyle}>
      <Radio.Group value={value} onChange={onChange}>
        {ADJUST_OPTIONS.map(opt => (
          <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
        ))}
      </Radio.Group>
    </div>
  ));

/** 价格与回撤率双轴图表 */
const PriceDualAxes: React.FC<{ config: Record<string, unknown> | null }> =
  React.memo(({ config }) => {
    if (!config) return <div>暂无数据</div>;
    return <DualAxes {...config} />;
  });

// ====== 主组件 ======

const PriceAndTurnover: React.FC = () => {
  const [adjust, setAdjust] = useState<string>('hfq');
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const handleAdjustChange = useCallback((e: RadioChangeEvent) => setAdjust(e.target.value), []);

  const { data, loading } = useStockData(symbol, adjust);
  const chartConfig = useChartConfig(data);

  return (
    <div style={containerStyle}>
      <Spin spinning={loading}>
        <AdjustRadio value={adjust} onChange={handleAdjustChange} />
        <PriceDualAxes config={chartConfig} />
      </Spin>
    </div>
  );
};

export default memo(PriceAndTurnover);
