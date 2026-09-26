import React, { useMemo, memo, useState } from 'react';
import { Line, DualAxes } from '@ant-design/plots';
import { Card, Space, Table, Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import moment from 'moment';
import type { KLineData } from '@/utils/stockUtils';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, calculatePercentile, calculateAnnualizedReturn, stockRsiRecommendationRules, indexRsiRecommendationRules, rsiPeriodLabelMap } from '@/utils/stockUtils';
import type { RsiRecommendationRules } from '@/utils/stockUtils';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';

interface RsiFilterMarkProps {
  data: KLineData[]; // data数据格式参考KLineData
  /** 标的类型：股票 / 指数，决定推荐级别的计算口径 */
  type: 'stock' | 'index';
}

/** 可折叠 Card（默认展开） */
interface CollapsibleCardProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  /** 与 Card styles.body 一致，表格卡片需要去掉内边距 */
  bodyPaddingZero?: boolean;
  cardStyle?: React.CSSProperties;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  defaultOpen = true,
  bodyPaddingZero = false,
  cardStyle,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      size="small"
      variant="outlined"
      style={{ borderRadius: 8, ...cardStyle }}
      styles={bodyPaddingZero ? { body: { padding: 0 } } : undefined}
      title={
        <div
          onClick={() => setOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <RightOutlined
            style={{
              fontSize: 12,
              color: '#8c8c8c',
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
          {title}
        </div>
      }
    >
      {open ? children : null}
    </Card>
  );
};

// 周期 RSI 字段名（与 stockUtils 中返回的字段保持一致）
type RsiFieldKey =
  | '__daily__RSI6__'
  | '__weekly__RSI6__'
  | '__monthly__RSI6__'
  | '__quarterly__RSI6__';

type RsiPeriodKey = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface RsiPeriodMeta {
  /** 周期键 */
  periodKey: RsiPeriodKey;
  /** 表格列字段名 */
  fieldKey: RsiFieldKey;
  /** 中文标签 */
  label: string;
  /** 折线颜色 */
  color: string;
}

// 单行数据：日期 + 收盘价 + 各周期 RSI6 + 推荐级别（null 表示非买点）
type ChartRow = KLineData & {
  __recommendationLevel__: number | null;
} & Record<RsiFieldKey, number | null>;

// 过滤后的买点数据行（推荐级别必不为 null）
type BuyPointRow = ChartRow & { __recommendationLevel__: number };

// 百分位买卖阈值（买入、卖出均看周RSI6）
interface PercentileThresholds {
  /** 周RSI6 买入阈值：跌破该值建仓（对应 WEEKLY_RSI_BUY_PERCENTILE 分位） */
  weeklyBuyThreshold: number;
  /** 周RSI6 卖出阈值：突破该值且盈利时卖出（对应 WEEKLY_RSI_SELL_PERCENTILE 分位） */
  weeklySellThreshold: number;
}

// 持仓中的买入记录（用于与卖出信号配对）
interface PercentileHolding {
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
  buyTime: number;
}

type PercentileTradeStatus = '已平仓' | '持仓中';

// 百分位买卖配对交易记录
interface PercentileTrade {
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
  sellDate: string | null;
  sellRsi: number | null;
  sellPrice: number | null;
  holdingDays: number | null;
  returnRate: number | null;
  annualizedReturn: number | null;
  status: PercentileTradeStatus;
}

// 样式常量
const chartContainerStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
  border: '1px solid #e8e8e8',
  borderRadius: 8,
  padding: '12px 16px',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
};
const chartLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
  color: '#262626',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

// RSI 折线图共享配置（静态部分）
const rsiLineBaseConfig = {
  yField: '__RSI6__',
  height: 240,
  autoFit: true,
  smooth: true,
  animation: { appear: { duration: 600 } },
  lineStyle: { lineWidth: 2 },
  xAxis: {
    type: 'time' as const,
    tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
    label: { style: { fill: '#595959', fontSize: 11 } },
  },
  yAxis: {
    min: 0,
    max: 100,
    grid: { line: { style: { stroke: '#e8e8e8', lineDash: [3, 3] } } },
    label: { style: { fill: '#595959', fontSize: 11 } },
  },
  legend: false as const,
  tooltip: {
    showCrosshairs: true,
    shared: true,
    domStyles: {
      'g2-tooltip': { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)' },
    },
    title: (d: { 日期: string }) => moment(d.日期).format('YYYY-MM-DD'),
    items: [{ field: '__RSI6__', name: 'RSI6' }],
  },
};

// 各周期 RSI 元信息：标签、字段名、颜色
const rsiPeriods: RsiPeriodMeta[] = [
  { periodKey: 'daily', fieldKey: '__daily__RSI6__', label: '日RSI6', color: '#80a02f8b' },
  { periodKey: 'weekly', fieldKey: '__weekly__RSI6__', label: '周RSI6', color: '#52c41a' },
  { periodKey: 'monthly', fieldKey: '__monthly__RSI6__', label: '月RSI6', color: '#1890ff' },
  { periodKey: 'quarterly', fieldKey: '__quarterly__RSI6__', label: '季RSI6', color: '#7014faff' },
];

const rsiWarmup = 6; // calculateRSI 前 6 个点为预热值（固定 50），计算分位时剔除

// ===== 百分位买卖策略参数（可配置）=====
/** 周RSI6 买入分位：周RSI6 跌破该历史分位时建仓 */
const WEEKLY_RSI_BUY_PERCENTILE = 1;
/** 周RSI6 卖出分位：周RSI6 突破该历史分位且收益率＞0 时卖出 */
const WEEKLY_RSI_SELL_PERCENTILE = 90;

// 周/月 RSI6 主题色（与 rsiPeriods 中对应周期颜色一致，用于百分位阈值展示）
const weeklyRsiColor = rsiPeriods.find(({ periodKey }) => periodKey === 'weekly')!.color;

// 主图“指数 · 买点标注”右轴只展示月/季 RSI6（日/周 RSI6 不在主图展示）
const mainChartRsiPeriods = rsiPeriods.filter(
  ({ periodKey }) => periodKey === 'monthly' || periodKey === 'quarterly',
);

// 主图折线（指数/收盘价）颜色：折线、左轴标题、图例、tooltip 统一使用
const mainColor = '#ff0033';

type RsiStatus = 'overbought' | 'oversold' | 'normal';

// 超买 / 超卖 / 中性 状态标签配色（卡片主色统一使用各周期折线色）
const rsiStatusMeta: Record<RsiStatus, { text: string; tagColor: string }> = {
  overbought: { text: '超买', tagColor: 'red' },
  oversold: { text: '超卖', tagColor: 'green' },
  normal: { text: '中性', tagColor: 'default' },
};

// 将 #RRGGBB / #RRGGBBAA 十六进制颜色转为指定透明度的 rgba
const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 单周期 RSI 分位统计
interface RsiStat {
  label: string;
  /** 与该周期折线一致的主题色 */
  color: string;
  current: number | null;
  p10: number | null;
  p90: number | null;
  position: number | null;
  status: RsiStatus;
}

// 将日期字符串转为 Date 对象（用于 xField）
const rowToDate = (row: { 日期: string }) => new Date(row.日期);

// 推荐级别星标渲染
const renderRecommendationStars = (level: number) => (
  <span style={{ color: '#ffd700', letterSpacing: 1 }}>{'★'.repeat(level)}</span>
);

// 收益率 / 年化收益率渲染：正红负绿，空值显示 --
const renderPercent = (value: number | null) =>
  value == null ? (
    '--'
  ) : (
    <span
      style={{
        color: value >= 0 ? '#cf1322' : '#3f8600',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value >= 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );

// 规则说明容器样式（与「推荐买点（百分位）」保持一致）
const ruleNoteStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  lineHeight: 1.8,
  color: '#8c8c8c',
  background: '#fafafa',
  borderBottom: '1px solid #f0f0f0',
};

// 星级标签样式
const ruleLevelStyle: React.CSSProperties = {
  color: '#d48806',
  fontWeight: 600,
};

/**
 * 「推荐买点（定量）」规则说明
 * 打分口径直接映射自 stockRsiRecommendationRules / indexRsiRecommendationRules，
 * 与 calculateStockRecommendationLevel / calculateIndexRecommendationLevel 共用同一份规则表，
 * 避免文案与实际计算逻辑不一致。
 */
const QuantRuleNote: React.FC<{ type: 'stock' | 'index' }> = ({ type }) => {
  const rules: RsiRecommendationRules =
    type === 'stock' ? stockRsiRecommendationRules : indexRsiRecommendationRules;
  // 星级从高到低展示
  const levels = Object.keys(rules)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div style={ruleNoteStyle}>
      规则：{type === 'stock' ? '按日/周/月/季' : '按月度/季度'} RSI6 综合打分，星级越高代表超卖共振越强
      {type === 'index' ? '；指数按月取每月最晚的一条信号展示' : ''}。
      {levels.map((level) => {
        const groups = rules[level];
        // 每组内条件用「且」连接，多组之间用「，或」连接
        const groupsText = groups
          .map((group) =>
            group
              .map(({ period, threshold }) => `${rsiPeriodLabelMap[period]} ≤ ${threshold}`)
              .join(' 且 '),
          )
          .join('，或 ');
        return (
          <div key={level}>
            <span style={ruleLevelStyle}>★{level}</span>：{groupsText}
          </div>
        );
      })}
      <div style={{ color: '#595959' }}>不满足以上任一条件则不构成买点，表格仅展示命中的买点记录。</div>
    </div>
  );
};

// 表格基础列
const baseTableColumns = [
  {
    title: '推荐级别',
    dataIndex: '__recommendationLevel__',
    key: '__recommendationLevel__',
    align: 'center' as const,
    width: 100,
    render: renderRecommendationStars,
  },
  {
    title: '日期',
    dataIndex: '日期',
    key: '日期',
    width: 120,
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: '收盘价',
    dataIndex: '收盘',
    key: '收盘',
    align: 'right' as const,
    width: 100,
    render: (value: number) => value?.toFixed(2),
  },
];

// 各周期 RSI 表格列
const rsiTableColumns = rsiPeriods.map(({ fieldKey, label, color }) => ({
  title: label,
  dataIndex: fieldKey,
  key: fieldKey,
  align: 'right' as const,
  width: 100,
  render: (value: number) => (
    <span style={{ color: value != null ? color : '#bfbfbf', fontWeight: 500 }}>
      {value?.toFixed(2)}
    </span>
  ),
}));

/**
 * 构建单周期 RSI 折线图配置
 */
const buildRsiLineConfig = (periodMeta: RsiPeriodMeta, data: KLineData[]) => ({
  ...rsiLineBaseConfig,
  data,
  xField: rowToDate,
  yAxis: {
    ...rsiLineBaseConfig.yAxis,
    title: { text: `${periodMeta.label.replace('RSI', 'K RSI')}` },
  },
  style: { stroke: periodMeta.color },
});

/**
 * 周期元信息 -> 周期 RSI 数据键（periodRSIMap 中字段命名规则：${periodKey}RSI）
 */
const rsiDataKeyOf = (periodKey: RsiPeriodKey) => `${periodKey}RSI` as const;

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data, type }) => {
  // 主图系列名称：指数场景显示“指数”，股票场景保留“收盘价”
  const mainName = type === 'index' ? '指数' : '收盘价';

  const {
    buyPointList,
    mainChartConfig,
    rsiLineConfigs,
    rsiStats,
    percentileThresholds,
    percentileTrades,
    percentileChartConfig,
  } = useMemo(() => {
    const emptyResult = {
      buyPointList: [] as BuyPointRow[],
      mainChartConfig: {} as Record<string, unknown>,
      rsiLineConfigs: {} as Record<RsiPeriodKey, Record<string, unknown>>,
      rsiStats: [] as RsiStat[],
      percentileThresholds: null as PercentileThresholds | null,
      percentileTrades: [] as PercentileTrade[],
      percentileChartConfig: {} as Record<string, unknown>,
    };

    if (!data?.length) {
      return emptyResult;
    }

    // 1) 计算日/周/月/季 K 线的 RSI6 值
    const periodRSIMap = calculatePeriodRSI(data);

    // 2) 合并为带推荐级别的图表数据（按标的类型 stock/index 选择推荐级别口径）
    const chartData = computeRSIRecommendations(periodRSIMap, type) as ChartRow[];

    // 3) 过滤出推荐买点
    let buyPointList = chartData.filter(
      (row): row is BuyPointRow => row.__recommendationLevel__ != null,
    );

    if (type === 'index') {
      // 过滤初 每月最晚（最新）的一条记录，用于指数推荐级别
      // 以“月”为单位，避免太多推荐买点
      buyPointList = convertToMonthlyData(buyPointList);
    }

    // 4) 生成买点标注
    const annotations = createRecommendationAnnotations(buyPointList);

    // 5) 构造主图 DualAxes：左轴指数/收盘价折线 + 买点标注，右轴各周期 RSI6
    // 左轴数据（指数/收盘价）
    const mainData = chartData.map((item) => ({
      date: item.日期,
      label: mainName,
      value: item.收盘,
    }));
    // 右轴数据（仅月/季 RSI6）：取月K/季K 的实际数据点（月末/季末），
    // 不按日重复填充，避免月内数值恒定造成“平台式直线”，配合 smooth 呈现光滑曲线
    const rsiLongData = mainChartRsiPeriods.flatMap((periodMeta) =>
      periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)]
        .map((item) => ({
          date: item.日期,
          label: periodMeta.label,
          value: item.__RSI6__,
        }))
        .filter((row) => row.value != null),
    );

    // 统一颜色映射：所有系列 label → 颜色（保证折线、图例、tooltip 颜色一致）
    const colorDomain = [mainName, ...mainChartRsiPeriods.map(({ label }) => label)];
    const colorRange = [mainColor, ...mainChartRsiPeriods.map(({ color }) => color)];

    // tooltip 查表：日 RSI 按日精确匹配；周/月/季 RSI 只有周期末数据点，
    // shared tooltip 按相同日期匹配会漏掉，故按年周/年月/年季补齐对应周期值。
    // 周匹配口径与 stockUtils.getPeriodRSIValues 一致（year + week）。
    const dailyTooltipMap = new Map(
      periodRSIMap.dailyRSI.map((item) => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]),
    );
    const weeklyTooltipMap = new Map(
      periodRSIMap.weeklyRSI.map((item) => {
        const date = moment(item.日期);
        return [`${date.year()}-${date.week()}`, item.__RSI6__] as const;
      }),
    );
    const monthlyTooltipMap = new Map(
      periodRSIMap.monthlyRSI.map((item) => [moment(item.日期).format('YYYY-MM'), item.__RSI6__]),
    );
    const quarterlyTooltipMap = new Map(
      periodRSIMap.quarterlyRSI.map((item) => {
        const date = moment(item.日期);
        return [`${date.year()}-Q${date.quarter()}`, item.__RSI6__] as const;
      }),
    );
    const formatTooltipValue = (value: number | null | undefined) =>
      typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(2) : '--';

    const dailyPeriodMeta = rsiPeriods.find(({ periodKey }) => periodKey === 'daily')!;
    const weeklyPeriodMeta = rsiPeriods.find(({ periodKey }) => periodKey === 'weekly')!;
    const monthlyPeriodMeta = mainChartRsiPeriods.find(({ periodKey }) => periodKey === 'monthly')!;
    const quarterlyPeriodMeta = mainChartRsiPeriods.find(({ periodKey }) => periodKey === 'quarterly')!;

    const mainChartConfig = {
      xField: (d: { date: string }) => new Date(d.date),
      height: 420,
      autoFit: true,
      animation: { appear: { duration: 800 } },
      tooltip: { showCrosshairs: true, shared: true },
      children: [
        {
          data: mainData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 2 },
          scale: { color: { domain: colorDomain, range: colorRange } },
          axis: {
            y: {
              title: mainName,
              style: { titleFill: mainColor },
            },
          },
          // tooltip 单一控制点：日频 hover 时补齐日/周/月/季 RSI6
          // （日/周 RSI6 仅在 tooltip 展示，不在主图绘制折线）
          // G2 v5: items 为数组，每个元素是 (datum) => { name, color, value }
          tooltip: {
            title: (d: { date: string }) => moment(d.date).format('YYYY-MM-DD'),
            items: [
              (d: { date: string; value: number }) => ({
                name: mainName,
                color: mainColor,
                value: formatTooltipValue(d.value),
              }),
              (d: { date: string }) => ({
                name: dailyPeriodMeta.label,
                color: dailyPeriodMeta.color,
                value: formatTooltipValue(dailyTooltipMap.get(moment(d.date).format('YYYY-MM-DD'))),
              }),
              (d: { date: string }) => {
                const date = moment(d.date);
                return {
                  name: weeklyPeriodMeta.label,
                  color: weeklyPeriodMeta.color,
                  value: formatTooltipValue(weeklyTooltipMap.get(`${date.year()}-${date.week()}`)),
                };
              },
              (d: { date: string }) => ({
                name: monthlyPeriodMeta.label,
                color: monthlyPeriodMeta.color,
                value: formatTooltipValue(monthlyTooltipMap.get(moment(d.date).format('YYYY-MM'))),
              }),
              (d: { date: string }) => {
                const date = moment(d.date);
                return {
                  name: quarterlyPeriodMeta.label,
                  color: quarterlyPeriodMeta.color,
                  value: formatTooltipValue(
                    quarterlyTooltipMap.get(`${date.year()}-Q${date.quarter()}`),
                  ),
                };
              },
            ],
          },
        },
        {
          data: rsiLongData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 1.5 },
          scale: { color: { domain: colorDomain, range: colorRange } },
          axis: {
            y: {
              position: 'right' as const,
              title: 'RSI6',
              style: { titleFill: '#6c6868ff' },
            },
          },
          // 右轴 RSI 已在左轴 tooltip 中统一展示，关闭自身条目避免月末日期重复
          tooltip: false,
        },
      ],
      annotations,
    };

    // 6) 构造各周期 RSI 折线图配置
    const rsiLineConfigs = rsiPeriods.reduce((configs, periodMeta) => {
      const rsiData = periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)];
      configs[periodMeta.periodKey] = buildRsiLineConfig(periodMeta, rsiData);
      return configs;
    }, {} as Record<RsiPeriodKey, Record<string, unknown>>);

    // 7) 各周期 RSI6 当前值、历史 10%/90% 分位、超买超卖状态
    const rsiStats: RsiStat[] = rsiPeriods.map(({ label, color, periodKey }) => {
      // 剔除前 rsiWarmup 个预热点（固定值 50），避免干扰分位
      const values = periodRSIMap[rsiDataKeyOf(periodKey)]
        .slice(rsiWarmup)
        .map((item) => item.__RSI6__)
        .filter((value): value is number => typeof value === 'number');

      if (!values.length) {
        return { label, color, current: null, p10: null, p90: null, position: null, status: 'normal' };
      }

      const current = Number(values[values.length - 1].toFixed(2));
      const p10 = Number(calculatePercentile(values, 10).toFixed(2));
      const p90 = Number(calculatePercentile(values, 90).toFixed(2));
      // 当前值在历史序列中的分位位置（0~100）
      const position = Number(((values.filter((v) => v <= current).length / values.length) * 100).toFixed(1));
      const status: RsiStatus = current >= p90 ? 'overbought' : current <= p10 ? 'oversold' : 'normal';

      return { label, color, current, p10, p90, position, status };
    });

    // 8) 百分位买卖配对：买入、卖出均看周RSI6（跌破买入分位建仓，突破卖出分位且盈利卖出）
    const weeklyRsiValues = periodRSIMap.weeklyRSI
      .slice(rsiWarmup)
      .map((item) => item.__RSI6__)
      .filter((value): value is number => typeof value === 'number');

    const percentileThresholds: PercentileThresholds | null = weeklyRsiValues.length
      ? {
          weeklyBuyThreshold: Number(
            calculatePercentile(weeklyRsiValues, WEEKLY_RSI_BUY_PERCENTILE).toFixed(2),
          ),
          weeklySellThreshold: Number(
            calculatePercentile(weeklyRsiValues, WEEKLY_RSI_SELL_PERCENTILE).toFixed(2),
          ),
        }
      : null;

    // 逐周扫描：空仓时周RSI6 跌破 weeklyBuyThreshold 建仓；持仓时周RSI6 突破 weeklySellThreshold 且盈利则卖出
    const percentileTrades: PercentileTrade[] = [];
    if (percentileThresholds) {
      let holding: PercentileHolding | null = null;

      for (const item of periodRSIMap.weeklyRSI.slice(rsiWarmup)) {
        const weeklyRsi = item.__RSI6__;
        if (typeof weeklyRsi !== 'number') continue;

        if (!holding) {
          // 空仓期间首次跌破周RSI6 买入分位时建仓；持仓期间再次更低不重复买入
          if (weeklyRsi < percentileThresholds.weeklyBuyThreshold) {
            holding = {
              buyDate: item.日期,
              buyRsi: weeklyRsi,
              buyPrice: item.收盘,
              buyTime: new Date(item.日期).getTime(),
            };
          }
          continue;
        }

        const returnRate = ((item.收盘 - holding.buyPrice) / holding.buyPrice) * 100;
        // 仅当周RSI6 突破卖出分位且收益率为正时卖出；超买但未盈利则继续持有等待下一次信号
        if (weeklyRsi > percentileThresholds.weeklySellThreshold && returnRate > 0) {
          const holdingDays = Math.max(
            1,
            Math.round((new Date(item.日期).getTime() - holding.buyTime) / (24 * 60 * 60 * 1000)),
          );
          const tradeReturnRate = Number(returnRate.toFixed(2));
          percentileTrades.push({
            buyDate: holding.buyDate,
            buyRsi: holding.buyRsi,
            buyPrice: Number(holding.buyPrice.toFixed(2)),
            sellDate: item.日期,
            sellRsi: weeklyRsi,
            sellPrice: Number(item.收盘.toFixed(2)),
            holdingDays,
            returnRate: tradeReturnRate,
            annualizedReturn: calculateAnnualizedReturn(tradeReturnRate, holdingDays),
            status: '已平仓',
          });
          holding = null;
        }
      }

      // 末尾未卖出：记为持仓中
      if (holding) {
        percentileTrades.push({
          buyDate: holding.buyDate,
          buyRsi: holding.buyRsi,
          buyPrice: Number(holding.buyPrice.toFixed(2)),
          sellDate: null,
          sellRsi: null,
          sellPrice: null,
          holdingDays: null,
          returnRate: null,
          annualizedReturn: null,
          status: '持仓中',
        });
      }
    }

    // 9) 百分位买卖标注图：左轴收盘价/指数折线 + 右轴周RSI6阈值参考线，叠加买点/卖点标注
    // 与主图一致：周RSI6 不单独绘制折线，仅通过左轴 tooltip 展示数值

    // 买点（绿●）/ 卖点（红●）圆点标注，Y 坐标取当次成交价（风格与推荐买点标注一致）
    const percentileAnnotations = percentileTrades.flatMap((trade) => {
      const annos = [
        {
          type: 'text' as const,
          data: [new Date(trade.buyDate), trade.buyPrice],
          style: {
            text: '●',
            fontSize: 14,
            textAlign: 'center',
            textBaseline: 'middle',
            fill: '#00a800',
            stroke: '#ffffff',
            lineWidth: 1.5,
            shadowColor: 'rgba(0, 168, 0, 0.6)',
            shadowBlur: 6,
          },
        },
      ];
      if (trade.sellDate && trade.sellPrice != null) {
        annos.push({
          type: 'text' as const,
          data: [new Date(trade.sellDate), trade.sellPrice],
          style: {
            text: '●',
            fontSize: 14,
            textAlign: 'center',
            textBaseline: 'middle',
            fill: 'rgba(3, 96, 255, 1)',
            // 白色粗描边 + 外发光：让卖点在红色价格线上也能清晰区分
            stroke: '#ffffff',
            lineWidth: 2.5,
            shadowColor: 'rgba(3, 96, 255, 0.7)',
            shadowBlur: 8,
          },
        });
      }
      return annos;
    });

    // 周RSI6 买入/卖出分位水平参考线（均落在周RSI6 右轴上）
    // 买入线（2%）绿虚线；卖出线（90%）红虚线；lineY mark 承载右轴（周RSI6，0~100）渲染
    const thresholdLineYMarks = percentileThresholds
      ? [
          {
            type: 'lineY' as const,
            data: [percentileThresholds.weeklyBuyThreshold],
            scale: { y: { id: 'weeklyRsiY', domain: [0, 100] } },
            axis: {
              y: {
                position: 'right' as const,
                title: `${weeklyPeriodMeta.label}（${WEEKLY_RSI_BUY_PERCENTILE}% / ${WEEKLY_RSI_SELL_PERCENTILE}% 分位）`,
                style: { titleFill: weeklyPeriodMeta.color },
              },
            },
            tooltip: false,
            style: {
              stroke: '#52c41a',
              lineDash: [4, 4],
              lineWidth: 1,
              opacity: 0.7,
            },
          },
          {
            type: 'lineY' as const,
            data: [percentileThresholds.weeklySellThreshold],
            scale: { y: { id: 'weeklyRsiY' } },
            axis: false,
            tooltip: false,
            style: {
              stroke: '#f5222d',
              lineDash: [4, 4],
              lineWidth: 1,
              opacity: 0.7,
            },
          },
        ]
      : [];

    // 颜色域仅含主折线（指数/收盘价），图例自动只展示该系列；
    // 周RSI6 不出现在图例，仅在 tooltip 中展示
    const percentileColorDomain = [mainName];
    const percentileColorRange = [mainColor];

    const percentileChartConfig = {
      xField: (d: { date: string }) => new Date(d.date),
      height: 420,
      autoFit: true,
      animation: { appear: { duration: 800 } },
      tooltip: { showCrosshairs: true, shared: true },
      children: [
        {
          data: mainData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 2 },
          scale: { color: { domain: percentileColorDomain, range: percentileColorRange } },
          axis: {
            y: {
              title: mainName,
              style: { titleFill: mainColor },
            },
          },
          tooltip: {
            title: (d: { date: string }) => moment(d.date).format('YYYY-MM-DD'),
            items: [
              (d: { date: string; value: number }) => ({
                name: mainName,
                color: mainColor,
                value: formatTooltipValue(d.value),
              }),
              (d: { date: string }) => {
                const date = moment(d.date);
                return {
                  name: weeklyPeriodMeta.label,
                  color: weeklyPeriodMeta.color,
                  value: formatTooltipValue(weeklyTooltipMap.get(`${date.year()}-${date.week()}`)),
                };
              },
            ],
          },
        },
        ...thresholdLineYMarks,
      ],
      annotations: percentileAnnotations,
    };

    return { buyPointList, mainChartConfig, rsiLineConfigs, rsiStats, percentileThresholds, percentileTrades, percentileChartConfig };
  }, [data, type, mainName]);

  // 买点表格列：收盘列标题随标的类型切换（指数 / 收盘价）
  const buyPointsColumns = useMemo(
    () => [
      baseTableColumns[0],
      baseTableColumns[1],
      { ...baseTableColumns[2], title: mainName },
      ...rsiTableColumns,
    ],
    [mainName],
  );

  // 百分位买卖配对交易表格列
  const percentileTradeColumns = useMemo(
    () => [
      {
        title: '买入日期',
        dataIndex: 'buyDate',
        key: 'buyDate',
        width: 110,
        render: (text: string) => moment(text).format('YYYY-MM-DD'),
      },
      {
        title: '买入周RSI6',
        dataIndex: 'buyRsi',
        key: 'buyRsi',
        align: 'right' as const,
        width: 110,
        render: (value: number) => (
          <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
        ),
      },
      {
        title: mainName,
        dataIndex: 'buyPrice',
        key: 'buyPrice',
        align: 'right' as const,
        width: 100,
        render: (value: number) => value?.toFixed(2),
      },
      {
        title: '卖出日期',
        dataIndex: 'sellDate',
        key: 'sellDate',
        width: 110,
        render: (text: string | null) => (text ? moment(text).format('YYYY-MM-DD') : '--'),
      },
      {
        title: '卖出周RSI6',
        dataIndex: 'sellRsi',
        key: 'sellRsi',
        align: 'right' as const,
        width: 110,
        render: (value: number | null) =>
          value != null ? (
            <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
          ) : (
            '--'
          ),
      },
      {
        title: '卖出价',
        dataIndex: 'sellPrice',
        key: 'sellPrice',
        align: 'right' as const,
        width: 100,
        render: (value: number | null) => (value != null ? value.toFixed(2) : '--'),
      },
      {
        title: '持有天数',
        dataIndex: 'holdingDays',
        key: 'holdingDays',
        align: 'right' as const,
        width: 90,
        render: (value: number | null) => (value != null ? value : '--'),
      },
      {
        title: '收益率',
        dataIndex: 'returnRate',
        key: 'returnRate',
        align: 'right' as const,
        width: 100,
        render: renderPercent,
      },
      {
        title: '年化收益率',
        dataIndex: 'annualizedReturn',
        key: 'annualizedReturn',
        align: 'right' as const,
        width: 110,
        render: renderPercent,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        align: 'center' as const,
        width: 90,
        render: (status: PercentileTradeStatus) => (
          <Tag
            color={status === '持仓中' ? 'processing' : 'default'}
            style={{ marginInlineEnd: 0 }}
          >
            {status}
          </Tag>
        ),
      },
    ],
    [mainName],
  );

  if (!data?.length) {
    return <div>暂无数据</div>;
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <CollapsibleCard title="各周期 RSI6 · 历史分位参考">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rsiStats.map((stat) => {
            const meta = rsiStatusMeta[stat.status];
            return (
              <div
                key={stat.label}
                style={{
                  flex: '1 1 150px',
                  minWidth: 150,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: withAlpha(stat.color, 0.06),
                  border: `1px solid ${withAlpha(stat.color, 0.25)}`,
                  borderLeft: `3px solid ${stat.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: stat.color,
                        boxShadow: `0 0 6px ${withAlpha(stat.color, 0.5)}`,
                      }}
                    />
                    {stat.label.replace('RSI', 'K · RSI')}
                  </span>
                  <Tag color={meta.tagColor} style={{ marginInlineEnd: 0 }}>
                    {meta.text}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: stat.color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stat.current ?? '--'}
                  </span>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                    当前{stat.position != null ? ` · 位置 ${stat.position}%` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                  <span>
                    10%分位 <b style={{ color: '#595959', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{stat.p10 ?? '--'}</b>
                  </span>
                  <span style={{ marginLeft: 12 }}>
                    90%分位 <b style={{ color: '#595959', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{stat.p90 ?? '--'}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="RSI指标-推荐买点-（适合高波）（RSI6 定量）" bodyPaddingZero>
        <QuantRuleNote type={type} />
        <Table
          dataSource={buyPointList}
          columns={buyPointsColumns}
          rowKey="日期"
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 720 }}
        />
      </CollapsibleCard>

      <CollapsibleCard title={`RSI指标-推荐买点-（适合低波）（周RSI6 ${WEEKLY_RSI_BUY_PERCENTILE}% / ${WEEKLY_RSI_SELL_PERCENTILE}% 分位）`} bodyPaddingZero>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            lineHeight: 1.8,
            color: '#8c8c8c',
            background: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          规则：周RSI6{' '}
          <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
            ＜ {percentileThresholds?.weeklyBuyThreshold.toFixed(2)}
          </span>
          （历史{WEEKLY_RSI_BUY_PERCENTILE}%分位）时买入；周RSI6{' '}
          <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
            ＞ {percentileThresholds?.weeklySellThreshold.toFixed(2)}
          </span>
          （历史{WEEKLY_RSI_SELL_PERCENTILE}%分位）且卖出价高于买入价（收益率＞0）时卖出，一买一卖配对计算收益率与年化收益率。仅在空仓期间首次跌破阈值时建仓，
          <span style={{ color: '#595959' }}>
            持仓期间再次出现更低的 RSI 不重复买入；超买但未盈利（收益率≤0）时不卖出，继续持有等待下一次信号
          </span>
          ；末尾未卖出记为“持仓中”。
        </div>
        <Table
          dataSource={percentileTrades}
          columns={percentileTradeColumns}
          rowKey="buyDate"
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 1150 }}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={
          <span style={{ fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 14,
                background: mainColor,
                marginRight: 8,
                borderRadius: 2,
                verticalAlign: 'middle',
              }}
            />
            {mainName} · 买点标注（定量）
          </span>
        }
        cardStyle={{
          background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959' }}>
          <span>
            <span style={{ color: '#00a800', fontWeight: 700 }}>●</span> 买点（星级越高颜色越深）
          </span>
        </div>
        <DualAxes {...mainChartConfig} />
      </CollapsibleCard>

      <CollapsibleCard
        title={
          <span style={{ fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 14,
                background: weeklyRsiColor,
                marginRight: 8,
                borderRadius: 2,
                verticalAlign: 'middle',
              }}
            />
            {mainName} · 买点标注（周RSI6 {WEEKLY_RSI_BUY_PERCENTILE}% / {WEEKLY_RSI_SELL_PERCENTILE}% 分位）
          </span>
        }
        cardStyle={{
          background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959' }}>
          <span>
            <span style={{ color: '#00a800', fontWeight: 700 }}>●</span> 买入
          </span>
          <span>
            <span style={{ color: 'rgba(3, 96, 255, 1)', fontWeight: 700 }}>●</span> 卖出
          </span>
        </div>
        <DualAxes {...percentileChartConfig} />
      </CollapsibleCard>

      <CollapsibleCard
        title={
          <span style={{ fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 14,
                background: '#1890ff',
                marginRight: 8,
                borderRadius: 2,
                verticalAlign: 'middle',
              }}
            />
            RSI6 技术指标
          </span>
        }
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {rsiPeriods.map(({ periodKey, label, color }) => (
            <div key={periodKey} style={chartContainerStyle}>
              <div style={chartLabelStyle}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }}
                />
                {label.replace('RSI', 'K · RSI')}
              </div>
              <Line {...rsiLineConfigs[periodKey]} />
            </div>
          ))}
        </Space>
      </CollapsibleCard>
    </Space>
  );
};

export default memo(RsiFilterMark);
