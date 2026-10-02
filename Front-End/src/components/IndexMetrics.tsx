import React, { useMemo, memo } from 'react';
import { DualAxes } from '@ant-design/plots';
import { Card, Empty } from 'antd';
import moment from 'moment';
import type { KLineData, CloseValueType } from '@/utils/stockUtils';
import {
  calculateMaxDrawdown,
  calculateVolatility,
  calculateAnnualizedVolatility,
} from '@/utils/stockUtils';

interface IndexMetricsProps {
  data: KLineData[]; // 数据格式：{ 日期, 收盘 }
  /** 收盘值语义：基金等累计收益率场景需传 cumulativeReturn，避免起点为0时年化收益率被算成 Infinity；默认 price */
  closeValueType?: CloseValueType;
}

const chartName = '指数 · 年化收益率 · 回撤率 · 波动率';
const dailySampleRate = 10; // 日频数据抽样率（先计算指标后抽样，仅影响展示，保证各线日期一致）

// 日频判定阈值：相邻日期间隔中位数 ≤ 10 天视为交易日日频数据
const dailyGapThresholdDays = 10;
// 日频 / 非日频（月频等稀疏数据）的波动率滚动窗口（按观测点数计）
const dailyVolWindow = 20; // 约 1 个交易月
const sparseVolWindow = 12; // 约 1 年（12 个观测点）

/**
 * 根据相邻日期的间隔中位数推断数据频率
 * @returns gapDays 间隔中位天数；periodsPerYear 每年观测点数（用于波动率年化系数）
 */
const detectFrequency = (data: KLineData[]) => {
  if (data.length < 2) {
    return { gapDays: 1, periodsPerYear: 252 };
  }
  const gaps = data
    .slice(1)
    .map((item, index) => moment(item.日期).diff(moment(data[index].日期), 'days'))
    .filter((days) => days > 0)
    .sort((a, b) => a - b);
  if (!gaps.length) {
    return { gapDays: 1, periodsPerYear: 252 };
  }
  const gapDays = gaps[Math.floor(gaps.length / 2)];
  return { gapDays, periodsPerYear: Math.max(1, Math.round(365 / gapDays)) };
};

// 指数折线颜色（与图表、图例、tooltip 统一，可在此配置）
const indexColor = '#ff0033';

// 百分比指标元信息：字段名、显示名、颜色（可在此配置各指标颜色）
interface MetricMeta {
  key: string;
  label: string;
  color: string;
}

// 基础指标（始终展示）
const baseMetricMetas: MetricMeta[] = [
  { key: '年化收益率', label: '年化收益率(%)', color: '#1890ff' },
  { key: '回撤率', label: '回撤率(%)', color: '#faad14' },
  { key: '波动率', label: '波动率(年化 %)', color: '#722ed1' },
];

// 滚动市盈率指标：仅当传入 data 含有效「滚动市盈率」字段时动态加入
const peMetricMeta: MetricMeta = { key: '滚动市盈率', label: '滚动市盈率', color: '#13c2c2' };

// 判断数据中是否存在有效的「滚动市盈率」字段（任一行有有限数值即展示）
const hasPeField = (data: KLineData[]) =>
  data.some((item) =>
    Number.isFinite(Number((item as unknown as Record<string, unknown>)['滚动市盈率'])),
  );

const IndexMetrics: React.FC<IndexMetricsProps> = ({ data, closeValueType = 'price' }) => {
  const { indexData, metricData, colorDomain, colorRange } = useMemo(() => {
    if (!data?.length) {
      return { indexData: [], metricData: [], colorDomain: ['指数'], colorRange: [indexColor] };
    }

    // 按数据字段动态组装指标：有「滚动市盈率」则追加，没有则不展示
    const metricMetas = hasPeField(data) ? [...baseMetricMetas, peMetricMeta] : baseMetricMetas;
    // 统一颜色映射：所有系列 label → 颜色（保证折线、图例、tooltip 颜色一致）
    const colorDomain = ['指数', ...metricMetas.map(({ label }) => label)];
    const colorRange = [indexColor, ...metricMetas.map(({ color }) => color)];

    // 识别数据频率：交易日日频 vs 月频等稀疏数据
    const { gapDays, periodsPerYear } = detectFrequency(data);
    const isDaily = gapDays <= dailyGapThresholdDays;
    // 波动率滚动窗口：日频 20 个交易日；稀疏数据 12 个观测点（约 1 年）
    const volWindow = isDaily ? dailyVolWindow : sparseVolWindow;

    // 1) 计算回撤率、年化收益率；2) 叠加滚动波动率（窗口随频率，年化系数按每年观测点数）
    const enriched = calculateVolatility({
      data: calculateMaxDrawdown({ data: data as unknown as Record<string, unknown>[], leftKey: '收盘', dateKey: '日期', closeValueType }),
      navKey: '收盘',
      dateKey: '日期',
      period: volWindow,
    }).map((item) => ({
      ...item,
      年化收益率: item.__年化收益率__ ?? null,
      回撤率: item.__最大回撤率__ ?? null,
      波动率: item.__波动率__ != null
        ? Number(calculateAnnualizedVolatility(item.__波动率__, periodsPerYear).toFixed(2))
        : null,
    }));

    // 3) 日频数据 10 抽 1 稀释；月频等稀疏数据保留全部观测点（统一处理保证各指标日期一致）
    const sampled = isDaily
      ? enriched.filter((_, index) => index % dailySampleRate === 0)
      : enriched;

    // 指数折线数据（需带 label，供 colorField 识别图例/tooltip）
    const indexData = sampled.map((item) => ({
      date: item.日期,
      key: 'index',
      label: '指数',
      value: item.收盘,
    }));

    // 百分比指标转长表数据（缺失/非有限值过滤）
    const metricData = sampled
      .flatMap((item) =>
        metricMetas.map(({ key, label }) => ({
          date: item.日期,
          key,
          label,
          value: (item as Record<string, unknown>)[key] as number | null,
        })),
      )
      .filter((row) => typeof row.value === 'number' && Number.isFinite(row.value));

    return { indexData, metricData, colorDomain, colorRange };
  }, [data, closeValueType]);

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
    [indexData, metricData, colorDomain, colorRange],
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
