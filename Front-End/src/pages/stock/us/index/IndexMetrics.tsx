import React, { useMemo, memo } from 'react';
import { DualAxes } from '@ant-design/plots';
import { Card, Empty } from 'antd';
import type { KLineData } from '@/utils/stockUtils';
import {
  calculateMaxDrawdown,
  calculateVolatility,
  calculateAnnualizedVolatility,
} from '@/utils/stockUtils';

interface IndexMetricsProps {
  data: KLineData[]; // 数据格式：{ 日期, 收盘 }
}

const chartName = '指数 · 年化收益率 · 回撤率 · 波动率';
const sampleRate = 10; // 抽样率（先计算指标后抽样，仅影响展示，保证各线日期一致）

// 指数折线颜色（与图表、图例、tooltip 统一，可在此配置）
const indexColor = '#ff0033';

// 百分比指标元信息：字段名、显示名、颜色（可在此配置各指标颜色）
const metricMetas = [
  { key: '年化收益率', label: '年化收益率(%)', color: '#1890ff' },
  { key: '回撤率', label: '回撤率(%)', color: '#faad14' },
  { key: '波动率', label: '波动率(年化 %)', color: '#722ed1' },
] as const;

type MetricKey = (typeof metricMetas)[number]['key'];

// 统一颜色映射：所有系列 label → 颜色（保证折线、图例、tooltip 颜色一致）
const colorDomain = ['指数', ...metricMetas.map(({ label }) => label)];
const colorRange = [indexColor, ...metricMetas.map(({ color }) => color)];

const IndexMetrics: React.FC<IndexMetricsProps> = ({ data }) => {
  const { indexData, metricData } = useMemo(() => {
    if (!data?.length) {
      return { indexData: [], metricData: [] };
    }

    // 1) 计算回撤率、年化收益率；2) 叠加计算20日滚动波动率（年化）
    const enriched = calculateVolatility({
      data: calculateMaxDrawdown({ data: data as unknown as Record<string, unknown>[], leftKey: '收盘', dateKey: '日期' }),
      navKey: '收盘',
      dateKey: '日期',
      period: 20,
    }).map((item) => ({
      ...item,
      年化收益率: item.__年化收益率__ ?? null,
      回撤率: item.__最大回撤率__ ?? null,
      波动率: item.__波动率__ != null ? Number(calculateAnnualizedVolatility(item.__波动率__).toFixed(2)) : null,
    }));

    // 3) 抽样（统一抽样，保证各指标日期一致）
    const sampled = enriched.filter((_, index) => index % sampleRate === 0);

    // 指数折线数据（需带 label，供 colorField 识别图例/tooltip）
    const indexData = sampled.map((item) => ({
      date: item.日期,
      key: 'index',
      label: '指数',
      value: item.收盘,
    }));

    // 百分比指标转长表数据（缺失值过滤）
    const metricData = sampled
      .flatMap((item) =>
        metricMetas.map(({ key, label }) => ({
          date: item.日期,
          key,
          label,
          value: item[key as MetricKey] as number | null,
        })),
      )
      .filter((row) => row.value != null);

    return { indexData, metricData };
  }, [data]);

  const config = useMemo(
    () => ({
      title: { title: chartName },
      xField: (d: { date: string }) => new Date(d.date),
      height: 420,
      autoFit: true,
      children: [
        {
          data: indexData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 2 },
          scale: { color: { domain: colorDomain, range: colorRange } },
          axis: { y: { title: '指数', style: { titleFill: indexColor } } },
        },
        {
          data: metricData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          scale: { color: { domain: colorDomain, range: colorRange } },
          axis: {
            y: {
              position: 'right' as const,
              title: '百分比(%)',
              style: { titleFill: '#6c6868ff' },
            },
          },
        },
      ],
    }),
    [indexData, metricData],
  );

  if (!data?.length) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Card size="small" variant="outlined" title={chartName} style={{ borderRadius: 8, marginBottom: 16 }}>
      <DualAxes {...config} />
    </Card>
  );
};

export default memo(IndexMetrics);
