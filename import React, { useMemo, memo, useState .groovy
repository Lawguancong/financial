import React, { useMemo, memo, useState } from 'react';
import { Line, DualAxes } from '@ant-design/plots';
import { Card, Space, Table, Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import moment from 'moment';
import type { KLineData } from '@/utils/stockUtils';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, calculatePercentile, calculateAnnualizedReturn } from '@/utils/stockUtils';
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

// 百分位策略交易记录（周RSI6 低于 3% 分位买入、高于 95% 分位卖出）
interface PercentileTrade {
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
  sellDate: string | null;
  sellRsi: number | null;
  sellPrice: number | null;
  /** 卖出收益率(%)，持仓中为 null */
  returnPct: number | null;
  /** 持有天数（自然日，含非交易日）；持仓中按买入日到最后一根周K计算 */
  holdingDays: number;
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

// 主图“指数 · 买点标注”右轴只展示月/季 RSI6（日/周 RSI6 不在主图展示）
const mainChartRsiPeriods = rsiPeriods.filter(
  ({ periodKey }) => periodKey === 'monthly' || periodKey === 'quarterly',
);

// 主图折线（指数/收盘价）颜色：折线、左轴标题、图例、tooltip 统一使用
const mainColor = '#ff0033';

// 周 RSI6 系列色（百分位策略表格中信号列使用）
const weeklyRsiColor = rsiPeriods.find(({ periodKey }) => periodKey === 'weekly')!.color;

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

/**
 * 周 RSI6 百分位策略：周RSI6 < buyThreshold（3% 分位）时买入，
 * 周RSI6 > sellThreshold（95% 分位）且卖出价高于买入价（收益率 > 0）时卖出，
 * 任一不满足则继续持有，等待下一次同时满足；一买一卖顺序配对，同一时间只持有一笔。
 * 末尾未卖出的买入以“持仓中”保留。
 */
const buildPercentileTrades = (
  weeklyRsiList: Array<{ 日期: string; 收盘: number; __RSI6__: number | null }>,
  buyThreshold: number,
  sellThreshold: number,
): PercentileTrade[] => {
  const trades: PercentileTrade[] = [];
  let openTrade: PercentileTrade | null = null;

  for (const item of weeklyRsiList) {
    const rsi = item.__RSI6__;
    if (typeof rsi !== 'number') {
      continue;
    }
    if (!openTrade && rsi < buyThreshold) {
      openTrade = {
        buyDate: item.日期,
        buyRsi: Number(rsi.toFixed(2)),
        buyPrice: item.收盘,
        sellDate: null,
        sellRsi: null,
        sellPrice: null,
        returnPct: null,
        holdingDays: 0,
      };
    } else if (openTrade && rsi > sellThreshold && item.收盘 > openTrade.buyPrice) {
      const trade = openTrade;
      trade.sellDate = item.日期;
      trade.sellRsi = Number(rsi.toFixed(2));
      trade.sellPrice = item.收盘;
      trade.returnPct = Number(
        (((item.收盘 - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2),
      );
      // 自然日口径：卖出日 - 买入日，包含周末/节假日等非交易日
      trade.holdingDays = moment(item.日期).diff(moment(trade.buyDate), 'day');
      trades.push(trade);
      openTrade = null;
    }
    // RSI 虽超买但卖出价不高于买入价（收益率 <= 0）时不卖，继续持有等下一次信号
  }

  if (openTrade) {
    // 持仓中：持有天数算到序列最后一根周K
    const lastDate = weeklyRsiList[weeklyRsiList.length - 1]?.日期;
    openTrade.holdingDays = lastDate ? moment(lastDate).diff(moment(openTrade.buyDate), 'day') : 0;
    trades.push(openTrade);
  }
  return trades;
};

/**
 * 百分位策略买卖点标注（G2 v5 text annotation）：
 * 买入点用周RSI系列色「买」，卖出点用红色「卖」，均带白色描边保证在折线上可辨；
 * 通过 connector 引导线 + startMarker 圆点把文字标签指向具体的信号点位（买在下、卖在上）；
 * 持仓中的交易只有买入点。日期/价格取信号周K，即当周最后交易日的日收盘点，落在主图折线上。
 */
const buildPercentileAnnotations = (trades: PercentileTrade[]) =>
  trades.flatMap((trade) => {
    const markers: Array<Record<string, unknown>> = [
      {
        type: 'text' as const,
        data: [new Date(trade.buyDate), trade.buyPrice],
        style: {
          text: '买',
          fontSize: 13,
          dx: -7,
          dy: 24,
          fill: weeklyRsiColor,
          stroke: '#ffffff',
          lineWidth: 2,
          // 引导线：标签 → 信号点位，圆点（startMarker）强化指向
          connector: true,
          startMarker: true,
          startMarkerFill: '#2C3542',
          startMarkerFillOpacity: 0.65,
        },
      },
    ];
    if (trade.sellDate && trade.sellPrice != null) {
      markers.push({
        type: 'text' as const,
        data: [new Date(trade.sellDate), trade.sellPrice],
        style: {
          text: '卖',
          fontSize: 13,
          dx: -7,
          dy: -22,
          fill: '#cf1322',
          stroke: '#ffffff',
          lineWidth: 2,
          // 引导线：标签 → 信号点位，圆点（startMarker）强化指向
          connector: true,
          startMarker: true,
          startMarkerFill: '#2C3542',
          startMarkerFillOpacity: 0.65,
        },
      });
    }
    return markers;
  });

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data, type }) => {
  // 主图系列名称：指数场景显示“指数”，股票场景保留“收盘价”
  const mainName = type === 'index' ? '指数' : '收盘价';

  const {
    buyPointList,
    mainChartConfig,
    rsiLineConfigs,
    rsiStats,
    percentileTrades,
    percentileThresholds,
    percentileChartConfig,
  } = useMemo(() => {
    const emptyResult = {
      buyPointList: [] as BuyPointRow[],
      mainChartConfig: {} as Record<string, unknown>,
      rsiLineConfigs: {} as Record<RsiPeriodKey, Record<string, unknown>>,
      rsiStats: [] as RsiStat[],
      percentileTrades: [] as PercentileTrade[],
      percentileThresholds: null as null | { p3: number; p95: number },
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

    // 8) 百分位策略（周 RSI6）：低于历史 3% 分位买入、高于 95% 分位卖出，配对计算收益率
    // 阈值口径与上方分位卡片一致：剔除前 rsiWarmup 个预热点后的全历史分位
    const weeklyValidBars = periodRSIMap.weeklyRSI.slice(rsiWarmup);
    const weeklyRsiValues = weeklyValidBars
      .map((item) => item.__RSI6__)
      .filter((value): value is number => typeof value === 'number');
    const percentileThresholds = weeklyRsiValues.length
      ? {
          p3: calculatePercentile(weeklyRsiValues, 3),
          p95: calculatePercentile(weeklyRsiValues, 95),
        }
      : null;
    const percentileTrades = percentileThresholds
      ? buildPercentileTrades(weeklyValidBars, percentileThresholds.p3, percentileThresholds.p95)
      : [];

    // 9) 百分位策略主图：复用定量主图（指数/收盘价 + 月/季 RSI6、统一 tooltip），
    // 仅将标注替换为百分位策略的买/卖点
    const percentileChartConfig = {
      ...mainChartConfig,
      annotations: buildPercentileAnnotations(percentileTrades),
    };

    return {
      buyPointList,
      mainChartConfig,
      rsiLineConfigs,
      rsiStats,
      percentileTrades,
      percentileThresholds,
      percentileChartConfig,
    };
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

  // 百分位策略交易表格列
  const percentileTradeColumns = useMemo(
    () => [
      {
        title: '买入日期',
        dataIndex: 'buyDate',
        key: 'buyDate',
        width: 110,
        render: (value: string) => moment(value).format('YYYY-MM-DD'),
      },
      {
        title: '买入周RSI6',
        dataIndex: 'buyRsi',
        key: 'buyRsi',
        align: 'right' as const,
        width: 100,
        render: (value: number) => (
          <span style={{ color: weeklyRsiColor, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {value?.toFixed(2)}
          </span>
        ),
      },
      {
        title: `买入${mainName}`,
        dataIndex: 'buyPrice',
        key: 'buyPrice',
        align: 'right' as const,
        width: 110,
        render: (value: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value?.toFixed(2)}</span>,
      },
      {
        title: '卖出日期',
        dataIndex: 'sellDate',
        key: 'sellDate',
        width: 110,
        render: (value: string | null) => (value ? moment(value).format('YYYY-MM-DD') : '--'),
      },
      {
        title: '持有日期（天/非交易日）',
        dataIndex: 'holdingDays',
        key: 'holdingDays',
        align: 'right' as const,
        width: 160,
        render: (value: number, record: PercentileTrade) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
            {record.sellDate == null && (
              <span style={{ color: '#bfbfbf', fontSize: 12 }}>（至今）</span>
            )}
          </span>
        ),
      },
      {
        title: '卖出周RSI6',
        dataIndex: 'sellRsi',
        key: 'sellRsi',
        align: 'right' as const,
        width: 100,
        render: (value: number | null) =>
          value != null ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span> : '--',
      },
      {
        title: `卖出${mainName}`,
        dataIndex: 'sellPrice',
        key: 'sellPrice',
        align: 'right' as const,
        width: 110,
        render: (value: number | null) =>
          value != null ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span> : '--',
      },
      {
        title: '收益率(%)',
        dataIndex: 'returnPct',
        key: 'returnPct',
        align: 'right' as const,
        width: 110,
        render: (value: number | null) => {
          if (value == null) {
            return '--';
          }
          // A 股配色习惯：盈利红、亏损绿
          const color = value > 0 ? '#cf1322' : value < 0 ? '#389e0d' : '#595959';
          return (
            <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {value > 0 ? '+' : ''}
              {value.toFixed(2)}
            </span>
          );
        },
      },
      {
        title: '年化收益率(%)',
        key: 'annualizedReturnPct',
        align: 'right' as const,
        width: 130,
        // 由区间收益率与持有天数（自然日）按复利口径换算，见公共方法 calculateAnnualizedReturn
        render: (_: unknown, record: PercentileTrade) => {
          const annualized = calculateAnnualizedReturn(record.returnPct, record.holdingDays);
          if (annualized == null) {
            return '--';
          }
          const color = annualized > 0 ? '#cf1322' : annualized < 0 ? '#389e0d' : '#595959';
          return (
            <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {annualized > 0 ? '+' : ''}
              {annualized.toFixed(2)}
            </span>
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'sellDate',
        key: 'status',
        align: 'center' as const,
        width: 90,
        render: (value: string | null) =>
          value ? <Tag color="default">已卖出</Tag> : <Tag color="green">持仓中</Tag>,
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

      <CollapsibleCard title="RSI指标-推荐买点（定量）" bodyPaddingZero>
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

      <CollapsibleCard title="RSI指标-推荐买点（百分位）" bodyPaddingZero>
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
            ＜ {percentileThresholds?.p3.toFixed(2)}
          </span>
          （历史3%分位）时买入；周RSI6{' '}
          <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
            ＞ {percentileThresholds?.p95.toFixed(2)}
          </span>
          （历史95%分位）且卖出价高于买入价（收益率＞0）时卖出，一买一卖配对计算收益率与年化收益率。仅在空仓期间首次跌破阈值时建仓，
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
            {mainName} · 买点标注（百分位）
          </span>
        }
        cardStyle={{
          background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
        }}
      >
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
          <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>买</span>
          ：周RSI6 ＜ {percentileThresholds?.p3.toFixed(2)}（3%分位）建仓；
          <span style={{ color: '#cf1322', fontWeight: 600 }}>卖</span>
          ：周RSI6 ＞ {percentileThresholds?.p95.toFixed(2)}（95%分位）且收益率＞0 时卖出
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
