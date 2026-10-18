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
  data: KLineData[]; // 至少包含「日期」「收盘」字段的 K 线数据
  /**
   * 收盘值语义：
   * - price：普通价格指数（默认）
   * - cumulativeReturn：基金累计收益率（起点为 0，需特殊处理年化收益率分母，避免 Infinity）
   */
  closeValueType?: CloseValueType;
}

const dailySampleRate = 10; // 日频数据抽样步长（先算指标再抽样，仅影响展示密度，保证各系列日期对齐）

// 日频判定阈值：相邻日期间隔中位数 ≤ 10 天即视为交易日日频数据
const dailyGapThresholdDays = 10;
// 波动率滚动窗口（按观测点数计）：日频 / 稀疏数据分别配置
const dailyVolWindow = 20; // 日频约 1 个交易月
const sparseVolWindow = 12; // 稀疏数据约 1 年（12 个观测点）

/**
 * 根据相邻日期的间隔中位数推断数据频率
 * @returns gapDays 间隔中位天数
 * @returns periodsPerYear 每年观测点数，用于波动率年化系数推导
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

// 主图折线颜色 —— 折线、图例、tooltip 统一从 scale.color 读取，避免 stroke 硬编码
const indexColor = '#ff0033';

// 百分比指标元信息（右轴系列）：字段名 / 显示名 / 颜色，均可在此集中配置
interface MetricMeta {
  key: string;
  label: string;
  color: string;
}

// 始终展示的三个基础指标
const baseMetricMetas: MetricMeta[] = [
  { key: '年化收益率', label: '年化收益率(%)', color: '#1890ff' },
  { key: '回撤率', label: '回撤率(%)', color: '#faad14' },
  { key: '波动率', label: '波动率(年化 %)', color: '#722ed1' },
];

// 可选指标：滚动市盈率（仅当 data 中存在有效数值时动态加入图表）
const peMetricMeta: MetricMeta = { key: '滚动市盈率', label: '滚动市盈率', color: '#13c2c2' };

// 数据中是否存在有效的「滚动市盈率」字段（任一行有有限数值即视为存在）
const hasPeField = (data: KLineData[]) =>
  data.some((item) =>
    Number.isFinite(Number((item as unknown as Record<string, unknown>)['滚动市盈率'])),
  );

const IndexMetrics: React.FC<IndexMetricsProps> = ({ data, closeValueType = 'price' }) => {
  // 图表标题：累计收益率口径显示"累计收益率"，其余口径显示"指数"
  const chartName = closeValueType === 'cumulativeReturn'
    ? '累计收益率 · 年化收益率 · 回撤率 · 波动率'
    : '指数 · 年化收益率 · 回撤率 · 波动率';

  const { indexData, metricData, colorDomain, colorRange } = useMemo(() => {
    if (!data?.length) {
      return { indexData: [], metricData: [], colorDomain: ['指数'], colorRange: [indexColor] };
    }

    // 动态组装指标列表：数据含「滚动市盈率」字段则追加，否则不展示
    const metricMetas = hasPeField(data) ? [...baseMetricMetas, peMetricMeta] : baseMetricMetas;
    // 统一颜色映射表：所有系列 label → 颜色（折线、图例、tooltip 全部走 scale.color，来源一致）
    const colorDomain = ['指数', ...metricMetas.map(({ label }) => label)];
    const colorRange = [indexColor, ...metricMetas.map(({ color }) => color)];

    // 识别数据频率：交易日日频 vs 月频等稀疏数据
    const { gapDays, periodsPerYear } = detectFrequency(data);
    const isDaily = gapDays <= dailyGapThresholdDays;
    const volWindow = isDaily ? dailyVolWindow : sparseVolWindow;

    // 链式计算：先算回撤率 / 年化收益率，再叠加上滚动波动率并年化
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

    // 日频 10 抽 1 降低渲染量；稀疏数据全保留（统一处理以保证各指标日期一致）
    const sampled = isDaily
      ? enriched.filter((_, index) => index % dailySampleRate === 0)
      : enriched;

    // 左轴主图系列（需带 label 字段，供 colorField 识别图例与 tooltip）
    const indexData = sampled.map((item) => ({
      date: item.日期,
      key: 'index',
      // TODO: 待 dual-axes tooltip 对齐后按口径切换 label
      label: '指数',
      value: item.收盘,
    }));

    // 右轴百分比系列（长表格式，缺失 / 非有限值已过滤）
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
    [indexData, metricData, colorDomain, colorRange, chartName],
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
