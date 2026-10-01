import React, { useMemo, memo, useState } from 'react';
import { Line, DualAxes } from '@ant-design/plots';
import { Card, Space, Table, Tag } from 'antd';
import { RightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import type { KLineData, RsiRecommendationRules, CloseValueType, MonthlyQuarterlyPercentileBuyPoint, SinglePeriodPercentileTrade } from '@/utils/stockUtils';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, computeSinglePeriodPercentileTrades, computeMonthlyQuarterlyPercentileBuyPoints, roundPercentile, rsiWarmup, MQ_LEVEL_RULES, MONTHLY_RSI_SELL_PERCENTILE, QUARTERLY_RSI_SELL_PERCENTILE, WEEKLY_RSI_BUY_PERCENTILE, WEEKLY_RSI_SELL_PERCENTILE, MONTHLY_RSI_PCT_BUY_PERCENTILE, MONTHLY_RSI_PCT_SELL_PERCENTILE, stockRsiRecommendationRules, indexRsiRecommendationRules, fundRsiRecommendationRules, rsiPeriodLabelMap } from '@/utils/stockUtils';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';

interface RsiFilterMarkProps {
  data: KLineData[]; // data数据格式参考KLineData
  /** 标的类型：股票 / 指数 / 基金，决定推荐级别的计算口径 */
  type: 'stock' | 'index' | 'fund';
  /**
   * 可见的 RSI6 周期，默认展示全部四周期（日/周/月/季）。
   * 基金等场景仅有月/季 RSI6 数据时，可传 ['monthly', 'quarterly'] 隐藏日/周相关内容。
   */
  visiblePeriods?: RsiPeriodKey[];
}

/**
 * 可折叠 Card 组件（默认展开）
 * 折叠状态由组件内部 useState 自管，避免触发父组件重渲染（相比外部 state 更流畅）。
 * 点击标题栏切换展开/折叠，箭头图标 0.2s 旋转动画。
 */
interface CollapsibleCardProps {
  /** 卡片标题（支持 ReactNode，可带色条/副标题等） */
  title: React.ReactNode;
  /** 是否默认展开，默认 true */
  defaultOpen?: boolean;
  /** body 内边距清零（表格卡片用，避免表格外层留白） */
  bodyPaddingZero?: boolean;
  /** 自定义 body 内边距/样式 */
  bodyStyle?: React.CSSProperties;
  /** 自定义卡片容器样式（背景色、左边框等） */
  cardStyle?: React.CSSProperties;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  defaultOpen = true,
  bodyPaddingZero = false,
  bodyStyle,
  cardStyle,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      size="small"
      variant="outlined"
      style={{ borderRadius: 8, ...cardStyle }}
      styles={{ body: bodyPaddingZero ? { padding: 0, ...bodyStyle } : bodyStyle }}
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

// 百分位买卖阈值（周、月 RSI6 策略各自独立的买入/卖出阈值）
interface PercentileThresholds {
  /** 周RSI6 买入阈值：跌破该值建仓（对应 WEEKLY_RSI_BUY_PERCENTILE 分位） */
  weeklyBuyThreshold: number;
  /** 周RSI6 卖出阈值：突破该值且盈利时卖出（对应 WEEKLY_RSI_SELL_PERCENTILE 分位） */
  weeklySellThreshold: number;
  /** 月RSI6 买入阈值：触及（≤）该值建仓/加仓（对应 MONTHLY_RSI_PCT_BUY_PERCENTILE 分位） */
  monthlyBuyThreshold: number;
  /** 月RSI6 卖出阈值：触及（≥）该值且盈利时卖出（对应 MONTHLY_RSI_PCT_SELL_PERCENTILE 分位） */
  monthlySellThreshold: number;
}

// 月+季 RSI6 共振买点、单周期（周/月）百分位买卖配对交易等类型统一从 stockUtils 引入

/** 百分位交易表格的扁平化行：每一笔买入（首次/加仓）各占一行，卖出与收益列在首次买入行跨行合并 */
interface PercentileTradeRow {
  key: string;
  /** first=第一次买入（参与卖出收益配对）；extra=持仓期间的重复买入（仅展示） */
  buyType: 'first' | 'extra';
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
  sellDate: string | null;
  sellRsi: number | null;
  sellPrice: number | null;
  holdingDays: number | null;
  returnRate: number | null;
  annualizedReturn: number | null;
  status: SinglePeriodPercentileTrade['status'] | null;
  /** 卖出/收益/状态列的跨行数：首次买入行=1+加仓次数，加仓行=0（被合并） */
  span: number;
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

/** 分类标题左侧色条（4×16 圆角矩形，颜色随分类） */
const sectionAccentStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 4,
  height: 16,
  borderRadius: 2,
  background: color,
});
/** 分类标题副标题样式（12px 灰色，用于补充说明该分类的策略口径） */
const sectionSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8c8c8c',
  fontWeight: 400,
  marginLeft: 4,
};
/**
 * 分类分组容器样式：左侧 4px 色条 + 同色淡底色 + 同色内描边 + 圆角
 * 让 5 个策略分类在视觉上明显区分，颜色与该分类主色一致。
 */
const sectionGroupStyle = (color: string): React.CSSProperties => ({
  background: withAlpha(color, 0.05),
  borderLeft: `4px solid ${color}`,
  borderRadius: 8,
  padding: '12px 14px',
  boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.12)}`,
});

/** 单周期 RSI6 折线图共享静态配置（高度/坐标轴/tooltip 等） */
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

// 各周期 RSI 元信息：periodKey（周期键）、fieldKey（chartData 中字段名）、label（展示名）、color（主题色）
const rsiPeriods: RsiPeriodMeta[] = [
  { periodKey: 'daily', fieldKey: '__daily__RSI6__', label: '日RSI6', color: '#80a02f8b' },
  { periodKey: 'weekly', fieldKey: '__weekly__RSI6__', label: '周RSI6', color: '#52c41a' },
  { periodKey: 'monthly', fieldKey: '__monthly__RSI6__', label: '月RSI6', color: '#1890ff' },
  { periodKey: 'quarterly', fieldKey: '__quarterly__RSI6__', label: '季RSI6', color: '#7014faff' },
];

// RSI 预热（rsiWarmup）、月&季共振分级（MQ_LEVEL_RULES）、月/季卖出分位
// （MONTHLY_RSI_SELL_PERCENTILE / QUARTERLY_RSI_SELL_PERCENTILE）、周/月单周期买入卖出分位、
// 分位值（roundPercentile）等策略常量与工具统一从 stockUtils 引入，避免多处重复定义。

// 周/月/季 RSI6 主题色（与 rsiPeriods 中对应周期颜色一致，用于百分位阈值文本与图表参考线着色）
const weeklyRsiColor = rsiPeriods.find(({ periodKey }) => periodKey === 'weekly')!.color;
const monthlyRsiColor = rsiPeriods.find(({ periodKey }) => periodKey === 'monthly')!.color;
const quarterlyRsiColor = rsiPeriods.find(({ periodKey }) => periodKey === 'quarterly')!.color;

/** 主图「指数 · 买点标注」右轴只展示月/季 RSI6（日/周 RSI6 不在主图绘制折线，仅 tooltip 展示） */
const mainChartRsiPeriods = rsiPeriods.filter(
  ({ periodKey }) => periodKey === 'monthly' || periodKey === 'quarterly',
);

/**
 * DualAxes 右轴 RSI6 折线形状：
 * 季RSI6 不做光滑处理，使用 'vh'（step-before：两个相邻季末点之间的水平段取「后一个」季末值，
 * 即 1～3 月的横线显示 3 月季末值、4～6 月显示 6 月季末值，呈连跨横线/阶梯线）；
 * 月RSI6 保持 'smooth' 光滑曲线。单周期 Line 走势图不使用此映射，保持原样。
 */
const rsiLineShapeOf = (periodKey: RsiPeriodKey): 'smooth' | 'vh' =>
  periodKey === 'quarterly' ? 'vh' : 'smooth';

/** 主图折线（指数/收盘价）颜色：折线、左轴标题、图例、tooltip 统一使用 */
const mainColor = '#ff0033';

/** RSI 超买超卖状态枚举 */
type RsiStatus = 'overbought' | 'oversold' | 'normal';

/** 超买 / 超卖 / 中性 状态对应的标签文本与 Tag 配色（卡片主色仍使用各周期折线色） */
const rsiStatusMeta: Record<RsiStatus, { text: string; tagColor: string }> = {
  overbought: { text: '超买', tagColor: 'red' },
  oversold: { text: '超卖', tagColor: 'green' },
  normal: { text: '中性', tagColor: 'default' },
};

/**
 * 将 #RRGGBB / #RRGGBBAA 十六进制颜色转为指定透明度的 rgba 字符串
 * @param hex 十六进制颜色（支持 6/8 位）
 * @param alpha 透明度 0~1
 */
const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** calculatePeriodRSI 的返回值类型：{ dailyRSI, weeklyRSI, monthlyRSI, quarterlyRSI } */
type PeriodRSIMap = ReturnType<typeof calculatePeriodRSI>;
/** 带 RSI6 字段的 K 线数据（calculateRSI 在原 K 线上追加 __RSI6__） */
type RsiKLineData = KLineData & { __RSI6__?: number | null };

/**
 * 周期元信息按 periodKey 索引的 Map
 * 用途：避免在 useMemo 内反复 rsiPeriods.find(...)，提升性能与可读性
 */
const periodMetaByKey = Object.fromEntries(
  rsiPeriods.map((p) => [p.periodKey, p]),
) as Record<RsiPeriodKey, RsiPeriodMeta>;

/**
 * 取某周期剔除前 warmup 个预热点后的 K 线数组
 * @param map calculatePeriodRSI 返回的各周期 RSI 数据
 * @param periodKey 周期键 daily/weekly/monthly/quarterly
 * @param warmup 预热点数，默认 rsiWarmup(6)
 * @returns 剔除预热后的 K 线数组（含 __RSI6__ 字段）
 */
const getRsiArray = (
  map: PeriodRSIMap,
  periodKey: RsiPeriodKey,
  warmup: number = rsiWarmup,
): RsiKLineData[] => map[rsiDataKeyOf(periodKey)].slice(warmup) as RsiKLineData[];

/**
 * 取某周期剔除预热后的有效 RSI6 数值数组（仅保留 number 类型值）
 * 用于历史分位计算、当前值分位位置统计等
 * @param map 同 getRsiArray
 * @param periodKey 周期键
 * @param warmup 预热点数，默认 rsiWarmup
 */
const getRsiValues = (
  map: PeriodRSIMap,
  periodKey: RsiPeriodKey,
  warmup: number = rsiWarmup,
): number[] =>
  getRsiArray(map, periodKey, warmup)
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');

/**
 * 构建百分位策略图表标注：第一次买入（绿●）/ 重复买入加仓点（橙▲）/ 卖点（蓝●），
 * Y 坐标取当次成交价。周、月策略标注样式完全一致，故共用。
 */
const buildPercentileAnnotations = (trades: SinglePeriodPercentileTrade[]) =>
  trades.flatMap((trade) => {
    const annos = [
      {
        type: 'text' as const,
        data: [new Date(trade.buyDate), trade.buyPrice],
        style: {
          text: '●',
          fontSize: 14,
          textAlign: 'center' as const,
          textBaseline: 'middle' as const,
          fill: '#00a800',
          stroke: '#ffffff',
          lineWidth: 1.5,
          shadowColor: 'rgba(0, 168, 0, 0.6)',
          shadowBlur: 6,
        },
      },
    ];
    // 持仓期间的重复买入：橙色三角单独标记，尺寸略小以与首次买入区分
    trade.extraBuys.forEach((extra) => {
      annos.push({
        type: 'text' as const,
        data: [new Date(extra.buyDate), extra.buyPrice],
        style: {
          text: '▲',
          fontSize: 12,
          textAlign: 'center' as const,
          textBaseline: 'middle' as const,
          fill: '#fa8c16',
          stroke: '#ffffff',
          lineWidth: 1.5,
          shadowColor: 'rgba(250, 140, 22, 0.65)',
          shadowBlur: 6,
        },
      });
    });
    if (trade.sellDate && trade.sellPrice != null) {
      annos.push({
        type: 'text' as const,
        data: [new Date(trade.sellDate), trade.sellPrice],
        style: {
          text: '●',
          fontSize: 14,
          textAlign: 'center' as const,
          textBaseline: 'middle' as const,
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

/**
 * 将某周期 K 线数组转换为图表折线数据 { date, label, value }，并剔除 RSI6 为空的点
 * 用于主图右轴月/季 RSI6 折线、月&季共振图右轴折线等
 * @param arr 周期 K 线数组
 * @param label 系列名称（决定图例 / 颜色映射）
 */
const toRsiLineData = (arr: RsiKLineData[], label: string) =>
  arr
    .map((item) => ({ date: item.日期, label, value: item.__RSI6__ }))
    .filter((row) => row.value != null);

/**
 * 构建 tooltip 查表 Map：keyFn(日期字符串) -> RSI6 值
 * 用于主图 shared tooltip 按年周/年月/年季补齐周/月/季 RSI6 数值
 * @param arr 周期 K 线数组
 * @param keyFn 日期字符串 -> 查表键的映射函数
 */
const buildTooltipMap = (arr: RsiKLineData[], keyFn: (dateStr: string) => string) =>
  new Map(arr.map((item) => [keyFn(item.日期), item.__RSI6__]));

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

/** 将日期字符串转为 Date 对象（图表 xField 映射用） */
const rowToDate = (row: { 日期: string }) => new Date(row.日期);

/** 推荐级别星标渲染：金色 ★ 重复 level 次 */
const renderRecommendationStars = (level: number) => (
  <span style={{ color: '#ffd700', letterSpacing: 1 }}>{'★'.repeat(level)}</span>
);

/**
 * 收益率 / 年化收益率渲染：正值红色带 +、负值绿色，空值显示 --
 * 统一表格中收益率列的颜色与正负号口径
 */
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

/** 规则说明容器样式（各策略卡片规则说明区统一使用） */
const ruleNoteStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  lineHeight: 1.8,
  color: '#8c8c8c',
  background: '#fafafa',
  borderBottom: '1px solid #f0f0f0',
};

/** 规则说明中的星级标签样式（橙色加粗） */
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
const QuantRuleNote: React.FC<{ type: 'stock' | 'index' | 'fund' }> = ({ type }) => {
  const rules: RsiRecommendationRules =
    type === 'stock'
      ? stockRsiRecommendationRules
      : type === 'fund'
        ? fundRsiRecommendationRules
        : indexRsiRecommendationRules;
  // 星级从高到低展示
  const levels = Object.keys(rules)
    .map(Number)
    .sort((a, b) => b - a);

  const periodText = type === 'stock' ? '日/周/月/季' : '月度/季度';
  const extraNote = type === 'index' ? '；指数按月取每月最晚的一条信号展示' : '';

  return (
    <div style={ruleNoteStyle}>
      规则：按{periodText} RSI6 综合打分，星级越高代表超卖共振越强{extraNote}。
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

// 各周期 RSI 表格列（在组件内根据 visiblePeriods 动态生成，见 rsiTableColumnsMemo）

/**
 * 构建单周期 RSI6 折线图配置
 * 复用 rsiLineBaseConfig，叠加该周期的数据、xField、Y 轴标题与折线颜色
 * @param periodMeta 周期元信息（提供 label 与 color）
 * @param data 该周期的 K 线数据（含 __RSI6__）
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
 * 周期键 -> periodRSIMap 中对应字段名
 * 命名规则：${periodKey}RSI，如 'weekly' -> 'weeklyRSI'
 */
const rsiDataKeyOf = (periodKey: RsiPeriodKey) => `${periodKey}RSI` as const;

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data, type, visiblePeriods }) => {
  // 主图系列名称：指数场景显示"指数"，基金场景显示"累计收益率"，股票场景保留"收盘价"
  const mainName = type === 'index' ? '指数' : type === 'fund' ? '累计收益率' : '收盘价';

  // 可见周期：未指定时展示全部四周期；指定后仅展示传入的周期
  const visibleRsiPeriods = visiblePeriods
    ? rsiPeriods.filter(({ periodKey }) => visiblePeriods.includes(periodKey))
    : rsiPeriods;
  const visiblePeriodKeySet = new Set(visibleRsiPeriods.map(({ periodKey }) => periodKey));
  const showWeekly = visiblePeriodKeySet.has('weekly');
  const showDaily = visiblePeriodKeySet.has('daily');

  const {
    buyPointList,
    mainChartConfig,
    rsiLineConfigs,
    rsiStats,
    percentileThresholds,
    percentileTrades,
    percentileChartConfig,
    monthlyPercentileTrades,
    monthlyPercentileChartConfig,
    monthlyQuarterlyBuyList,
    monthlyQuarterlyThresholds,
    monthlyQuarterlySellThresholds,
    monthlyQuarterlyChartConfig,
  } = useMemo(() => {
    // 收盘值语义：基金为累计收益率（%，可为负），股票/指数为价格/指数
    const closeValueType: CloseValueType = type === 'fund' ? 'cumulativeReturn' : 'price';

    const emptyResult = {
      buyPointList: [] as BuyPointRow[],
      mainChartConfig: {} as Record<string, unknown>,
      rsiLineConfigs: {} as Record<RsiPeriodKey, Record<string, unknown>>,
      rsiStats: [] as RsiStat[],
      percentileThresholds: null as PercentileThresholds | null,
      percentileTrades: [] as SinglePeriodPercentileTrade[],
      percentileChartConfig: {} as Record<string, unknown>,
      monthlyPercentileTrades: [] as SinglePeriodPercentileTrade[],
      monthlyPercentileChartConfig: {} as Record<string, unknown>,
      monthlyQuarterlyBuyList: [] as MonthlyQuarterlyPercentileBuyPoint[],
      monthlyQuarterlyThresholds: null as Record<number, { monthly: number; quarterly: number }> | null,
      monthlyQuarterlySellThresholds: null as { monthly: number; quarterly: number } | null,
      monthlyQuarterlyChartConfig: {} as Record<string, unknown>,
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

    if (type === 'index' || type === 'fund') {
      // 过滤初 每月最晚（最新）的一条记录，用于指数/基金推荐级别
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
    // 不按日重复填充，避免月内数值恒定造成“平台式直线”；
    // 月RSI6 用 smooth 光滑曲线，季RSI6 不光滑（vh 阶梯：1～3 月横线取 3 月季末值，依此类推）
    const rsiLongData = mainChartRsiPeriods.flatMap((periodMeta) =>
      toRsiLineData(periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)] as RsiKLineData[], periodMeta.label),
    );

    // 统一颜色映射：所有系列 label → 颜色（保证折线、图例、tooltip 颜色一致）
    const colorDomain = [mainName, ...mainChartRsiPeriods.map(({ label }) => label)];
    const colorRange = [mainColor, ...mainChartRsiPeriods.map(({ color }) => color)];

    // tooltip 查表：日 RSI 按日精确匹配；周/月/季 RSI 只有周期末数据点，
    // shared tooltip 按相同日期匹配会漏掉，故按年周/年月/年季补齐对应周期值。
    // 周匹配口径与 stockUtils.getPeriodRSIValues 一致（year + week）。
    const dailyTooltipMap = buildTooltipMap(
      periodRSIMap.dailyRSI as RsiKLineData[],
      (d) => moment(d).format('YYYY-MM-DD'),
    );
    const weeklyTooltipMap = buildTooltipMap(
      periodRSIMap.weeklyRSI as RsiKLineData[],
      (d) => {
        const date = moment(d);
        return `${date.year()}-${date.week()}`;
      },
    );
    const monthlyTooltipMap = buildTooltipMap(
      periodRSIMap.monthlyRSI as RsiKLineData[],
      (d) => moment(d).format('YYYY-MM'),
    );
    // 季RSI6 tooltip 按「自然季度」对齐：hover 日期在 1～3 月取当年 3 月最晚的季末RSI6，
    // 4～6 月取 6 月最晚、7～9 月取 9 月最晚、10～12 月取 12 月最晚；
    // 与右轴季RSI6 折线的 vh（step-before）阶梯归属保持一致。
    const quarterlyTooltipMap = new Map<string, RsiKLineData>();
    for (const point of periodRSIMap.quarterlyRSI as RsiKLineData[]) {
      const date = moment(point.日期);
      // moment.month() 为 0-based：0～2 月→Q1，3～5 月→Q2，6～8 月→Q3，9～11 月→Q4
      const key = `${date.year()}-Q${Math.floor(date.month() / 3) + 1}`;
      const existed = quarterlyTooltipMap.get(key);
      // 同一季度理论上只有一个季末点，若存在多条则保留日期最晚的一条
      if (!existed || point.日期 > existed.日期) {
        quarterlyTooltipMap.set(key, point);
      }
    }
    const getQuarterlyRsi = (dateStr: string): number | null | undefined => {
      const date = moment(dateStr);
      const key = `${date.year()}-Q${Math.floor(date.month() / 3) + 1}`;
      return quarterlyTooltipMap.get(key)?.__RSI6__;
    };
    const formatTooltipValue = (value: number | null | undefined) =>
      typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(2) : '--';

    const dailyPeriodMeta = periodMetaByKey.daily;
    const weeklyPeriodMeta = periodMetaByKey.weekly;
    const monthlyPeriodMeta = periodMetaByKey.monthly;
    const quarterlyPeriodMeta = periodMetaByKey.quarterly;

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
          // tooltip 单一控制点：日频 hover 时补齐可见周期的 RSI6
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
              ...(showDaily
                ? [
                  (d: { date: string }) => ({
                    name: dailyPeriodMeta.label,
                    color: dailyPeriodMeta.color,
                    value: formatTooltipValue(dailyTooltipMap.get(moment(d.date).format('YYYY-MM-DD'))),
                  }),
                ]
                : []),
              ...(showWeekly
                ? [
                  (d: { date: string }) => {
                    const date = moment(d.date);
                    return {
                      name: weeklyPeriodMeta.label,
                      color: weeklyPeriodMeta.color,
                      value: formatTooltipValue(weeklyTooltipMap.get(`${date.year()}-${date.week()}`)),
                    };
                  },
                ]
                : []),
              (d: { date: string }) => ({
                name: monthlyPeriodMeta.label,
                color: monthlyPeriodMeta.color,
                value: formatTooltipValue(monthlyTooltipMap.get(moment(d.date).format('YYYY-MM'))),
              }),
              (d: { date: string }) => ({
                name: quarterlyPeriodMeta.label,
                color: quarterlyPeriodMeta.color,
                value: formatTooltipValue(getQuarterlyRsi(d.date)),
              }),
            ],
          },
        },
        {
          data: rsiLongData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'label' as const,
          style: { lineWidth: 1.5 },
          scale: {
            // 独立 scale：RSI 折线整体下移与指数错开（domain 0～200，不挂轴、不裁剪）
            y: { id: 'mainRsiYShift', domain: [0, 200] },
            color: { domain: colorDomain, range: colorRange },
            // 按系列映射折线形状：月RSI6 光滑，季RSI6 阶梯横线（不光滑）
            shape: {
              domain: mainChartRsiPeriods.map(({ label }) => label),
              range: mainChartRsiPeriods.map(({ periodKey }) => rsiLineShapeOf(periodKey)),
            },
          },
          axis: false,
          // 右轴 RSI 已在左轴 tooltip 中统一展示（真实数值，不受位移影响），关闭自身条目避免月末日期重复
          tooltip: false,
        },
      ],
      annotations,
    };

    // 6) 构造各周期 RSI 折线图配置（仅可见周期）
    const rsiLineConfigs = visibleRsiPeriods.reduce((configs, periodMeta) => {
      const rsiData = periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)];
      configs[periodMeta.periodKey] = buildRsiLineConfig(periodMeta, rsiData);
      return configs;
    }, {} as Record<RsiPeriodKey, Record<string, unknown>>);

    // 7) 各周期 RSI6 当前值、历史 10%/90% 分位、超买超卖状态（仅可见周期）
    const rsiStats: RsiStat[] = visibleRsiPeriods.map(({ label, color, periodKey }) => {
      // 剔除前 rsiWarmup 个预热点（固定值 50），避免干扰分位
      const values = getRsiValues(periodRSIMap, periodKey);

      if (!values.length) {
        return { label, color, current: null, p10: null, p90: null, position: null, status: 'normal' };
      }

      const current = Number(values[values.length - 1].toFixed(2));
      const p10 = roundPercentile(values, 10);
      const p90 = roundPercentile(values, 90);
      // 当前值在历史序列中的分位位置（0~100）
      const position = Number(((values.filter((v) => v <= current).length / values.length) * 100).toFixed(1));
      const status: RsiStatus = current >= p90 ? 'overbought' : current <= p10 ? 'oversold' : 'normal';

      return { label, color, current, p10, p90, position, status };
    });

    // 8) 百分位买卖配对：周RSI6 / 月RSI6 各自独立配对
    // 口径一致：触及（≤）买入分位建仓/加仓，触及（≥）卖出分位且相对第一次买入盈利时卖出
    const weeklyRsiValues = getRsiValues(periodRSIMap, 'weekly');
    const monthlyRsiValues = getRsiValues(periodRSIMap, 'monthly');

    const percentileThresholds: PercentileThresholds | null =
      weeklyRsiValues.length || monthlyRsiValues.length
        ? {
          weeklyBuyThreshold: weeklyRsiValues.length
            ? roundPercentile(weeklyRsiValues, WEEKLY_RSI_BUY_PERCENTILE)
            : Number.NaN,
          weeklySellThreshold: weeklyRsiValues.length
            ? roundPercentile(weeklyRsiValues, WEEKLY_RSI_SELL_PERCENTILE)
            : Number.NaN,
          monthlyBuyThreshold: monthlyRsiValues.length
            ? roundPercentile(monthlyRsiValues, MONTHLY_RSI_PCT_BUY_PERCENTILE)
            : Number.NaN,
          monthlySellThreshold: monthlyRsiValues.length
            ? roundPercentile(monthlyRsiValues, MONTHLY_RSI_PCT_SELL_PERCENTILE)
            : Number.NaN,
        }
        : null;

    // 周RSI6 百分位策略：逐周扫描买卖配对（扫描器在内部剔除预热并计算分位阈值）
    const percentileTrades: SinglePeriodPercentileTrade[] =
      weeklyRsiValues.length
        ? computeSinglePeriodPercentileTrades({
          rsiData: periodRSIMap.weeklyRSI,
          buyPercentile: WEEKLY_RSI_BUY_PERCENTILE,
          sellPercentile: WEEKLY_RSI_SELL_PERCENTILE,
          closeValueType,
        })
        : [];

    // 月RSI6 百分位策略：逐月扫描买卖配对（口径与周策略一致，仅周期与分位常量不同）
    const monthlyPercentileTrades: SinglePeriodPercentileTrade[] =
      monthlyRsiValues.length
        ? computeSinglePeriodPercentileTrades({
          rsiData: periodRSIMap.monthlyRSI,
          buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
          sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
          closeValueType,
        })
        : [];

    // 9) 月+季 RSI6 共振买点：月RSI6 与 季RSI6 同时跌破历史分位，按分位严度分级（★5/★3/★1）
    // 按月扫描，季度值取该月时点最近一个已完成季度的 RSI6（季度序列按日期 <= 月日期 取最近）
    const monthlyQuarterlyBuyList: MonthlyQuarterlyPercentileBuyPoint[] = [];
    let monthlyQuarterlyThresholds: Record<number, { monthly: number; quarterly: number }> | null = null;
    // 卖出阈值：月RSI6 > 该值 且 季RSI6 > 该值 时视为可卖出点（与★5买点顺序配对）
    let monthlyQuarterlySellThresholds: { monthly: number; quarterly: number } | null = null;
    {
      // monthlyRsiValues 复用步骤 8 的计算结果，避免重复
      const quarterlyRsiValues = getRsiValues(periodRSIMap, 'quarterly');

      if (monthlyRsiValues.length && quarterlyRsiValues.length) {
        // 按级别计算月/季 RSI6 买入分位阈值（图表参考线与阈值文案展示用）
        const thresholds: Record<number, { monthly: number; quarterly: number }> = {};
        for (const { level, percentile } of MQ_LEVEL_RULES) {
          thresholds[level] = {
            monthly: roundPercentile(monthlyRsiValues, percentile),
            quarterly: roundPercentile(quarterlyRsiValues, percentile),
          };
        }
        monthlyQuarterlyThresholds = thresholds;

        // 卖出分位阈值（月/季可分别配置，默认均为85%，图表参考线展示用）
        monthlyQuarterlySellThresholds = {
          monthly: roundPercentile(monthlyRsiValues, MONTHLY_RSI_SELL_PERCENTILE),
          quarterly: roundPercentile(quarterlyRsiValues, QUARTERLY_RSI_SELL_PERCENTILE),
        };

        // 共振买点扫描与 ★5 买卖配对复用公共实现
        // （内含预热剔除、月/季日期对齐守卫、只与第一个★5配对、持有满1年才算年化）
        monthlyQuarterlyBuyList.push(
          ...computeMonthlyQuarterlyPercentileBuyPoints({
            monthlyRSI6Data: periodRSIMap.monthlyRSI,
            quarterlyRSI6Data: periodRSIMap.quarterlyRSI,
            closeValueType,
          }),
        );
      }
    }

    // 10) 百分位买卖标注图：左轴收盘价/指数折线 + 右轴周RSI6阈值参考线，叠加买点/卖点标注
    // 与主图一致：周RSI6 不单独绘制折线，仅通过左轴 tooltip 展示数值

    // 第一次买点（绿●）/ 重复买入加仓点（橙▲）/ 卖点（蓝●）标注，Y 坐标取当次成交价
    const percentileAnnotations = buildPercentileAnnotations(percentileTrades);
    // 月RSI6 百分位策略标注（样式与周策略一致）
    const monthlyPercentileAnnotations = buildPercentileAnnotations(monthlyPercentileTrades);

    // 周RSI6 买入/卖出分位水平参考线（均落在周RSI6 0~100 口径 scale 上）
    // 买入线（1%）绿虚线；卖出线（90%）红虚线；不展示右轴刻度尺
    const thresholdLineYMarks = percentileThresholds
      ? [
        {
          type: 'lineY' as const,
          data: [percentileThresholds.weeklyBuyThreshold],
          scale: { y: { id: 'weeklyRsiY', domain: [0, 100] } },
          axis: false,
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

    // 颜色域含主折线与周RSI6（折线、图例、tooltip 颜色一致）
    const weeklyChartColorDomain = [mainName, weeklyPeriodMeta.label];
    const weeklyChartColorRange = [mainColor, weeklyPeriodMeta.color];

    // 右轴周RSI6 光滑折线数据（周末真实数据点）
    // 与红色指数线视觉错开：折线使用独立 scale，domain 改为 [0,115]（不挂轴），
    // 同高度画布上整线小幅下移（中值约下移 6～7 个 RSI 点的高度）、幅度轻微压缩，0～100 全值不裁剪；
    // 买卖阈值虚线仍用 weeklyRsiY（0～100）位置不变，tooltip 真实数值也不受影响
    const weeklyRsiLineData = toRsiLineData(
      periodRSIMap.weeklyRSI as RsiKLineData[],
      weeklyPeriodMeta.label,
    );

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
          scale: { color: { domain: weeklyChartColorDomain, range: weeklyChartColorRange } },
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
        {
          data: weeklyRsiLineData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 1.5 },
          scale: {
            // 独立 scale：折线小幅下移与指数错开（domain 0～300），不挂轴、不裁剪
            y: { id: 'weeklyRsiYShift', domain: [0, 300] },
            color: { domain: weeklyChartColorDomain, range: weeklyChartColorRange },
          },
          // 不挂轴（右轴刻度尺已隐藏）；
          // 周RSI6 已在左轴 tooltip 中统一展示（真实数值，不受位移影响），关闭自身条目避免周末重复
          axis: false,
          tooltip: false,
        },
        ...thresholdLineYMarks,
      ],
      annotations: percentileAnnotations,
    };

    // 月RSI6 买入/卖出分位水平参考线（落在月RSI6 monthlyRsiY 0～100 口径 scale 上）
    // 买入线（3%）绿虚线；卖出线（90%）红虚线；不展示右轴刻度尺
    const monthlyThresholdLineYMarks = percentileThresholds
      ? [
        {
          type: 'lineY' as const,
          data: [percentileThresholds.monthlyBuyThreshold],
          scale: { y: { id: 'monthlyRsiY', domain: [0, 100] } },
          axis: false,
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
          data: [percentileThresholds.monthlySellThreshold],
          scale: { y: { id: 'monthlyRsiY' } },
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

    // 月RSI6 百分位策略标注图：结构与周策略图一致，右轴换为月RSI6，tooltip 按年月查月RSI6
    // 右轴补充月RSI6 光滑折线（月末真实数据点，独立 scale 下移 0～200）；
    // 买卖阈值虚线仍在 monthlyRsiY（0～100 真实口径）；右轴刻度尺已隐藏
    const monthlyRsiLineData = toRsiLineData(
      periodRSIMap.monthlyRSI as RsiKLineData[],
      monthlyPeriodMeta.label,
    );
    const monthlyChartColorDomain = [mainName, monthlyPeriodMeta.label];
    const monthlyChartColorRange = [mainColor, monthlyPeriodMeta.color];
    const monthlyPercentileChartConfig = {
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
          scale: { color: { domain: monthlyChartColorDomain, range: monthlyChartColorRange } },
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
                  name: monthlyPeriodMeta.label,
                  color: monthlyPeriodMeta.color,
                  value: formatTooltipValue(monthlyTooltipMap.get(date.format('YYYY-MM'))),
                };
              },
            ],
          },
        },
        {
          data: monthlyRsiLineData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          style: { lineWidth: 1.5 },
          scale: {
            // 独立 scale：折线整体下移与指数错开（domain 0～200，不挂轴、不裁剪）
            y: { id: 'monthlyRsiYShift', domain: [0, 200] },
            color: { domain: monthlyChartColorDomain, range: monthlyChartColorRange },
          },
          // 不挂轴（右轴刻度尺已隐藏）；
          // 月RSI6 已在左轴 tooltip 中统一展示（真实数值，不受位移影响），关闭自身条目避免月末重复
          axis: false,
          tooltip: false,
        },
        ...monthlyThresholdLineYMarks,
      ],
      annotations: monthlyPercentileAnnotations,
    };

    // 11) 月&季 RSI6 共振买点标注图：左轴价格线 + 右轴月/季 RSI6 线 + 买点标注
    // 买点标注按推荐级别着色（★5 深绿、★3 中绿、★1 浅绿），与定量买点风格一致
    const mqAnnotationColorMap: Record<number, { fill: string; shadow: string }> = {
      5: { fill: '#00a800', shadow: 'rgba(0, 168, 0, 0.65)' },
      3: { fill: '#3cbc3c', shadow: 'rgba(60, 188, 60, 0.6)' },
      1: { fill: '#7ed957', shadow: 'rgba(126, 217, 87, 0.55)' },
    };
    const monthlyQuarterlyAnnotations = monthlyQuarterlyBuyList.flatMap((point) => {
      const color = mqAnnotationColorMap[point.level] || mqAnnotationColorMap[1];
      const annos = [
        {
          type: 'text' as const,
          data: [new Date(point.日期), point.收盘],
          style: {
            text: '●',
            fontSize: 14,
            textAlign: 'center',
            textBaseline: 'middle',
            fill: color.fill,
            stroke: '#ffffff',
            lineWidth: 1.5,
            shadowColor: color.shadow,
            shadowBlur: 6,
          },
        },
      ];
      // 卖出点标注（蓝色●）：★5买点配对的卖出点
      if (point.sellDate && point.sellPrice != null) {
        annos.push({
          type: 'text' as const,
          data: [new Date(point.sellDate), point.sellPrice],
          style: {
            text: '●',
            fontSize: 14,
            textAlign: 'center',
            textBaseline: 'middle',
            fill: 'rgba(3, 96, 255, 1)',
            stroke: '#ffffff',
            lineWidth: 2.5,
            shadowColor: 'rgba(3, 96, 255, 0.7)',
            shadowBlur: 8,
          },
        });
      }
      return annos;
    });

    // 右轴月/季 RSI6 折线数据（仅月末/季末点，不按日填充）
    const monthlyQuarterlyRsiData = [
      ...toRsiLineData(periodRSIMap.monthlyRSI as RsiKLineData[], monthlyPeriodMeta.label),
      ...toRsiLineData(periodRSIMap.quarterlyRSI as RsiKLineData[], quarterlyPeriodMeta.label),
    ];

    const mqColorDomain = [mainName, monthlyPeriodMeta.label, quarterlyPeriodMeta.label];
    const mqColorRange = [mainColor, monthlyPeriodMeta.color, quarterlyPeriodMeta.color];

    // 月/季 RSI6 ★1 级（10% 分位）水平参考线（mqRsiY 0～100 真实口径）；不展示右轴刻度尺
    const mqLevel1 = MQ_LEVEL_RULES.find(({ level }) => level === 1)!;
    const mqThresholdLineYMarks = monthlyQuarterlyThresholds
      ? [
        {
          type: 'lineY' as const,
          data: [monthlyQuarterlyThresholds[mqLevel1.level].monthly],
          scale: { y: { id: 'mqRsiY', domain: [0, 100] } },
          axis: false,
          tooltip: false,
          style: {
            stroke: monthlyPeriodMeta.color,
            lineDash: [4, 4],
            lineWidth: 1,
            opacity: 0.7,
          },
        },
        {
          type: 'lineY' as const,
          data: [monthlyQuarterlyThresholds[mqLevel1.level].quarterly],
          scale: { y: { id: 'mqRsiY' } },
          axis: false,
          tooltip: false,
          style: {
            stroke: quarterlyPeriodMeta.color,
            lineDash: [4, 4],
            lineWidth: 1,
            opacity: 0.7,
          },
        },
      ]
      : [];

    const monthlyQuarterlyChartConfig = {
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
          scale: { color: { domain: mqColorDomain, range: mqColorRange } },
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
              (d: { date: string }) => ({
                name: monthlyPeriodMeta.label,
                color: monthlyPeriodMeta.color,
                value: formatTooltipValue(monthlyTooltipMap.get(moment(d.date).format('YYYY-MM'))),
              }),
              (d: { date: string }) => ({
                name: quarterlyPeriodMeta.label,
                color: quarterlyPeriodMeta.color,
                value: formatTooltipValue(getQuarterlyRsi(d.date)),
              }),
            ],
          },
        },
        {
          data: monthlyQuarterlyRsiData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'label' as const,
          style: { lineWidth: 1.5 },
          scale: {
            // 独立 scale：折线整体下移与指数错开（domain 0～200，不挂轴、不裁剪）
            y: { id: 'mqRsiYShift', domain: [0, 200] },
            color: { domain: mqColorDomain, range: mqColorRange },
            // 按系列映射折线形状：月RSI6 光滑，季RSI6 阶梯横线（不光滑）
            shape: {
              domain: [monthlyPeriodMeta.label, quarterlyPeriodMeta.label],
              range: [rsiLineShapeOf('monthly'), rsiLineShapeOf('quarterly')],
            },
          },
          axis: false,
          tooltip: false,
        },
        ...mqThresholdLineYMarks,
      ],
      annotations: monthlyQuarterlyAnnotations,
    };

    return { buyPointList, mainChartConfig, rsiLineConfigs, rsiStats, percentileThresholds, percentileTrades, percentileChartConfig, monthlyPercentileTrades, monthlyPercentileChartConfig, monthlyQuarterlyBuyList, monthlyQuarterlyThresholds, monthlyQuarterlySellThresholds, monthlyQuarterlyChartConfig };
  }, [data, type, mainName, visibleRsiPeriods, showDaily, showWeekly]);

  // 百分位交易表格数据：每笔配对交易扁平化为「首次买入 + N 笔加仓」多行，
  // 卖出/持有天数/收益率/年化/状态只在首次买入行展示并跨行合并，加仓行只显示买入信息。
  // 周/月策略共用同一扁平化口径，keyPrefix 用于保证两张表行 key 不冲突。
  const flattenPercentileTrades = (trades: SinglePeriodPercentileTrade[], keyPrefix: string): PercentileTradeRow[] =>
    trades.flatMap((trade) => {
      const span = trade.extraBuys.length + 1;
      const firstRow: PercentileTradeRow = {
        key: `${keyPrefix}-${trade.buyDate}#first`,
        buyType: 'first',
        buyDate: trade.buyDate,
        buyRsi: trade.buyRsi,
        buyPrice: trade.buyPrice,
        sellDate: trade.sellDate,
        sellRsi: trade.sellRsi,
        sellPrice: trade.sellPrice,
        holdingDays: trade.holdingDays,
        returnRate: trade.returnRate,
        annualizedReturn: trade.annualizedReturn,
        status: trade.status,
        span,
      };
      const extraRows: PercentileTradeRow[] = trade.extraBuys.map((b, i) => ({
        key: `${keyPrefix}-${b.buyDate}#extra-${i}`,
        buyType: 'extra',
        buyDate: b.buyDate,
        buyRsi: b.buyRsi,
        buyPrice: b.buyPrice,
        sellDate: null,
        sellRsi: null,
        sellPrice: null,
        holdingDays: null,
        returnRate: null,
        annualizedReturn: null,
        status: null,
        span: 0,
      }));
      return [firstRow, ...extraRows];
    });

  const percentileTradeRows: PercentileTradeRow[] = useMemo(
    () => flattenPercentileTrades(percentileTrades, 'weekly'),
    [percentileTrades],
  );
  const monthlyPercentileTradeRows: PercentileTradeRow[] = useMemo(
    () => flattenPercentileTrades(monthlyPercentileTrades, 'monthly'),
    [monthlyPercentileTrades],
  );

  // 各周期 RSI 表格列（仅展示可见周期）
  const rsiTableColumns = useMemo(
    () =>
      visibleRsiPeriods.map(({ fieldKey, label, color }) => ({
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
      })),
    [visibleRsiPeriods],
  );

  // 买点表格列：收盘列标题随标的类型切换（指数 / 收盘价）
  const buyPointsColumns = useMemo(
    () => [
      baseTableColumns[0],
      baseTableColumns[1],
      { ...baseTableColumns[2], title: mainName },
      ...rsiTableColumns,
    ],
    [mainName, rsiTableColumns],
  );

  // 百分位买卖配对交易表格列工厂（周/月策略共用）：
  // 每一笔买入各占一行；卖出/持有天数/收益率/年化/状态仅在第一次买入行展示并跨行合并到其加仓行。
  // rsiLabel/rsiColor 决定买入/卖出 RSI 列的标题（周RSI6/月RSI6）与主题色
  const makePercentileTradeColumns = (rsiLabel: string, rsiColor: string) => [
    {
      title: '类型',
      dataIndex: 'buyType',
      key: 'buyType',
      align: 'center' as const,
      width: 100,
      render: (buyType: PercentileTradeRow['buyType']) =>
        buyType === 'first' ? (
          <Tag color="green" style={{ marginInlineEnd: 0 }}>首次买入</Tag>
        ) : (
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>加仓</Tag>
        ),
    },
    {
      title: '买入日期',
      dataIndex: 'buyDate',
      key: 'buyDate',
      width: 110,
      render: (text: string) => moment(text).format('YYYY-MM-DD'),
    },
    {
      title: `买入${rsiLabel}`,
      dataIndex: 'buyRsi',
      key: 'buyRsi',
      align: 'right' as const,
      width: 110,
      render: (value: number) => (
        <span style={{ color: rsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
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
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: (text: string | null) => (text ? moment(text).format('YYYY-MM-DD') : '--'),
    },
    {
      title: `卖出${rsiLabel}`,
      dataIndex: 'sellRsi',
      key: 'sellRsi',
      align: 'right' as const,
      width: 110,
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: (value: number | null) =>
        value != null ? (
          <span style={{ color: rsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
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
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: (value: number | null) => (value != null ? value.toFixed(2) : '--'),
    },
    {
      title: '持有天数',
      dataIndex: 'holdingDays',
      key: 'holdingDays',
      align: 'right' as const,
      width: 90,
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: (value: number | null) => (value != null ? value : '--'),
    },
    {
      title: '收益率',
      dataIndex: 'returnRate',
      key: 'returnRate',
      align: 'right' as const,
      width: 100,
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: renderPercent,
    },
    {
      title: '年化收益率',
      dataIndex: 'annualizedReturn',
      key: 'annualizedReturn',
      align: 'right' as const,
      width: 110,
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: renderPercent,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      width: 90,
      onCell: (row: PercentileTradeRow) => ({ rowSpan: row.span }),
      render: (status: SinglePeriodPercentileTrade['status'] | null) =>
        status ? (
          <Tag
            color={status === '持仓中' ? 'processing' : 'default'}
            style={{ marginInlineEnd: 0 }}
          >
            {status}
          </Tag>
        ) : (
          '--'
        ),
    },
  ];

  const percentileTradeColumns = makePercentileTradeColumns('周RSI6', weeklyRsiColor);
  const monthlyPercentileTradeColumns = makePercentileTradeColumns('月RSI6', monthlyRsiColor);

  // 月+季 RSI6 共振买点表格列
  const monthlyQuarterlyColumns = useMemo(
    () => [
      {
        title: '推荐级别',
        dataIndex: 'level',
        key: 'level',
        align: 'center' as const,
        width: 100,
        render: renderRecommendationStars,
      },
      {
        title: '买入日期',
        dataIndex: '日期',
        key: '日期',
        width: 120,
        render: (text: string) => moment(text).format('YYYY-MM-DD'),
      },
      {
        title: `买入${mainName}`,
        dataIndex: '收盘',
        key: '收盘',
        align: 'right' as const,
        width: 100,
        render: (value: number) => value?.toFixed(2),
      },
      {
        title: '买入月RSI6',
        dataIndex: 'monthlyRsi',
        key: 'monthlyRsi',
        align: 'right' as const,
        width: 100,
        render: (value: number) => (
          <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
        ),
      },
      {
        title: '买入季RSI6',
        dataIndex: 'quarterlyRsi',
        key: 'quarterlyRsi',
        align: 'right' as const,
        width: 100,
        render: (value: number) => (
          <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
        ),
      },
      {
        title: '卖出日期',
        dataIndex: 'sellDate',
        key: 'sellDate',
        width: 120,
        render: (text: string | undefined) => (text ? moment(text).format('YYYY-MM-DD') : '--'),
      },
      {
        title: '卖出月RSI6',
        dataIndex: 'sellMonthlyRsi',
        key: 'sellMonthlyRsi',
        align: 'right' as const,
        width: 110,
        render: (value: number | undefined) =>
          value != null ? (
            <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
          ) : (
            '--'
          ),
      },
      {
        title: '卖出季RSI6',
        dataIndex: 'sellQuarterlyRsi',
        key: 'sellQuarterlyRsi',
        align: 'right' as const,
        width: 110,
        render: (value: number | undefined) =>
          value != null ? (
            <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>{value.toFixed(2)}</span>
          ) : (
            '--'
          ),
      },
      {
        title: `卖出${mainName}`,
        dataIndex: 'sellPrice',
        key: 'sellPrice',
        align: 'right' as const,
        width: 100,
        render: (value: number | undefined) => (value != null ? value.toFixed(2) : '--'),
      },
      {
        title: '持有天数',
        dataIndex: 'holdingDays',
        key: 'holdingDays',
        align: 'right' as const,
        width: 90,
        render: (value: number | undefined) => (value != null ? value : '--'),
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
    ],
    [mainName],
  );

  if (!data?.length) {
    return <div>暂无数据</div>;
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '11px 16px',
          borderRadius: 8,
          background: `linear-gradient(90deg, ${withAlpha('#1890ff', 0.08)} 0%, ${withAlpha('#1890ff', 0.02)} 100%)`,
          border: `1px solid ${withAlpha('#1890ff', 0.2)}`,
          borderLeft: `3px solid #1890ff`,
        }}
      >
        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 15, marginTop: 2 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.8, color: '#46536b' }}>
          <span style={{ color: '#fa541c', fontWeight: 600 }}>长期上涨(标的/指数)才有效</span>：多周期 RSI6 同步进入 <span style={{ color: '#1890ff', fontWeight: 600 }}>历史极端底部</span>时，为
          <span style={{ color: '#1890ff', fontWeight: 600 }}>高胜率分批布局信号</span>
          ；
          <span style={{ color: '#fa541c', fontWeight: 600 }}>非买入即涨</span>
          ，宜<span style={{ color: '#262626', fontWeight: 600 }}>分批建仓</span>、<span style={{ color: '#fa541c', fontWeight: 600 }}>勿一次性重仓</span>。
        </span>
      </div>
      <CollapsibleCard
        title={
          <>
            <span style={sectionAccentStyle('#1890ff')} />
            <span>概览</span>
            <span style={sectionSubStyle}>各周期 RSI6 当前值与历史分位</span>
          </>
        }
        cardStyle={sectionGroupStyle('#1890ff')}
        bodyStyle={{ padding: '12px 14px' }}
      >
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
      </CollapsibleCard>
      <CollapsibleCard
        title={
          <>
            <span style={sectionAccentStyle('#8c8c8c')} />
            <span>技术指标详情</span>
            <span style={sectionSubStyle}>日 / 周 / 月 / 季 RSI6 走势</span>
          </>
        }
        cardStyle={sectionGroupStyle('#8c8c8c')}
        bodyStyle={{ padding: '12px 14px' }}
      >
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
            {visibleRsiPeriods.map(({ periodKey, label, color }) => (
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
      </CollapsibleCard>
      <CollapsibleCard
        title={
          <>
            <span style={sectionAccentStyle('#7014faff')} />
            <span>月&季 RSI6 百分位策略</span>
            <span style={sectionSubStyle}>月/季 RSI6 共振买卖策略（分级）</span>
          </>
        }
        cardStyle={sectionGroupStyle('#7014faff')}
        bodyStyle={{ padding: '12px 14px' }}
      >
        <CollapsibleCard title="RSI指标-推荐买点" bodyPaddingZero>
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
            规则：月RSI6 与 季RSI6 同时触及（≤）对应历史分位时记为买点，按分位严度分级（星级越高共振越强）。
            {MQ_LEVEL_RULES.map(({ level, percentile }) => (
              <div key={level}>
                <span style={{ color: '#ffd700', fontWeight: 700 }}>{'★'.repeat(level)}</span>：月RSI6{' '}
                <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
                  ≤ {monthlyQuarterlyThresholds?.[level].monthly.toFixed(2)}
                </span>
                （历史{percentile}%分位）且 季RSI6{' '}
                <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>
                  ≤ {monthlyQuarterlyThresholds?.[level].quarterly.toFixed(2)}
                </span>
                （历史{percentile}%分位）
              </div>
            ))}
            <div style={{ color: '#595959' }}>
              按月扫描，季度值取当月时点最近一个已完成季度的 RSI6；同一月份满足多个级别时取最高星级展示。
            </div>
            <div style={{ marginTop: 4 }}>
              卖出规则：月RSI6{' '}
              <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
                ≥ {monthlyQuarterlySellThresholds?.monthly.toFixed(2)}
              </span>
              （历史{MONTHLY_RSI_SELL_PERCENTILE}%分位）且 季RSI6{' '}
              <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>
                ≥ {monthlyQuarterlySellThresholds?.quarterly.toFixed(2)}
              </span>
              （历史{QUARTERLY_RSI_SELL_PERCENTILE}%分位）时视为可卖出点。
              <span style={{ color: '#595959' }}>
                ★5买点与卖点按时间顺序配对（★5买→卖→★5买→卖…），配对后计算持有天数、收益率与年化收益率；★1/★3买点及未配对的★5买点卖出列留空。
              </span>
            </div>
          </div>
          <Table
            dataSource={monthlyQuarterlyBuyList}
            columns={monthlyQuarterlyColumns}
            rowKey="日期"
            pagination={false}
            size="middle"
            bordered
            scroll={{ x: 1260 }}
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
              {mainName} · 买点标注
            </span>
          }
          cardStyle={{
            background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959' }}>
            <span>
              <span style={{ color: '#00a800', fontWeight: 700 }}>●</span> 买点（月+季RSI6 共振超卖）
            </span>
            <span>
              <span style={{ color: 'rgba(3, 96, 255, 1)', fontWeight: 700 }}>●</span> 卖出点（月+季RSI6 共振超买）
            </span>
            <span>
              <span style={{ color: monthlyRsiColor, fontWeight: 700 }}>━</span> 月RSI6
            </span>
            <span>
              <span style={{ color: quarterlyRsiColor, fontWeight: 700 }}>━</span> 季RSI6
            </span>
          </div>
          <DualAxes {...monthlyQuarterlyChartConfig} />
        </CollapsibleCard>
      </CollapsibleCard>
      <CollapsibleCard
        title={
          <>
            <span style={sectionAccentStyle('#52c41a')} />
            <span>RSI6 定量策略</span>
            <span style={sectionSubStyle}>日/周/月/季 RSI6 多周期共振打分</span>
          </>
        }
        cardStyle={sectionGroupStyle('#52c41a')}
        bodyStyle={{ padding: '12px 14px' }}
      >
        <CollapsibleCard title="RSI指标-推荐买点" bodyPaddingZero>
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
              {mainName} · 买点标注
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
      </CollapsibleCard>
      <CollapsibleCard
        title={
          <>
            <span style={sectionAccentStyle(monthlyRsiColor)} />
            <span>月 RSI6 百分位策略</span>
            <span style={sectionSubStyle}>月 RSI6 超买超卖买卖配对回测（买入分位 {MONTHLY_RSI_PCT_BUY_PERCENTILE}% 可配置）</span>
          </>
        }
        cardStyle={sectionGroupStyle(monthlyRsiColor)}
        bodyStyle={{ padding: '12px 14px' }}
      >
        <CollapsibleCard title={`RSI指标-推荐买点`} bodyPaddingZero>
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
            规则：空仓时月RSI6{' '}
            <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
              ≤ {percentileThresholds?.monthlyBuyThreshold.toFixed(2)}
            </span>
            （历史{MONTHLY_RSI_PCT_BUY_PERCENTILE}%分位）第一次买入建仓；
            <span style={{ color: '#595959' }}>持仓期间每月月RSI6 触及（≤）该分位即重复买入（加仓），表格中逐笔列出全部买入</span>
            ；月RSI6{' '}
            <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
              ≥ {percentileThresholds?.monthlySellThreshold.toFixed(2)}
            </span>
            （历史{MONTHLY_RSI_PCT_SELL_PERCENTILE}%分位）且卖出价高于
            <span style={{ color: '#595959' }}>第一次买入价</span>（收益率＞0）时卖出，
            <span style={{ color: '#595959' }}>持有天数、收益率与年化收益率仅按「卖出 − 第一次买入」配对计算，加仓行不展示收益；卖出必有对应的在先买入</span>
            ；超买但未盈利（收益率≤0）时不卖出，继续持有等待下一次信号；末尾未卖出记为“持仓中”。
          </div>
          <Table
            dataSource={monthlyPercentileTradeRows}
            columns={monthlyPercentileTradeColumns}
            rowKey="key"
            pagination={false}
            size="middle"
            bordered
            scroll={{ x: 1250 }}
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
                  background: monthlyRsiColor,
                  marginRight: 8,
                  borderRadius: 2,
                  verticalAlign: 'middle',
                }}
              />
              {mainName} · 买点标注
            </span>
          }
          cardStyle={{
            background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959' }}>
            <span>
              <span style={{ color: '#00a800', fontWeight: 700 }}>●</span> 第一次买入
            </span>
            <span>
              <span style={{ color: '#fa8c16', fontWeight: 700 }}>▲</span> 重复买入（加仓，仅标记）
            </span>
            <span>
              <span style={{ color: 'rgba(3, 96, 255, 1)', fontWeight: 700 }}>●</span> 卖出（与第一次买入配对）
            </span>
          </div>
          <DualAxes {...monthlyPercentileChartConfig} />
        </CollapsibleCard>
      </CollapsibleCard>
      {showWeekly && (
        <CollapsibleCard
          title={
            <>
              <span style={sectionAccentStyle('#fa8c16')} />
              <span>周 RSI6 百分位策略</span>
              <span style={sectionSubStyle}>周 RSI6 超买超卖买卖配对回测</span>
            </>
          }
          cardStyle={sectionGroupStyle('#fa8c16')}
          bodyStyle={{ padding: '12px 14px' }}
        >
          <CollapsibleCard title={`RSI指标-推荐买点`} bodyPaddingZero>
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
              规则：空仓时周RSI6{' '}
              <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
                ≤ {percentileThresholds?.weeklyBuyThreshold.toFixed(2)}
              </span>
              （历史{WEEKLY_RSI_BUY_PERCENTILE}%分位）第一次买入建仓；
              <span style={{ color: '#595959' }}>持仓期间每一周周RSI6 触及（≤）该分位即重复买入（加仓），表格中逐笔列出全部买入</span>
              ；周RSI6{' '}
              <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
                ≥ {percentileThresholds?.weeklySellThreshold.toFixed(2)}
              </span>
              （历史{WEEKLY_RSI_SELL_PERCENTILE}%分位）且卖出价高于
              <span style={{ color: '#595959' }}>第一次买入价</span>（收益率＞0）时卖出，
              <span style={{ color: '#595959' }}>持有天数、收益率与年化收益率仅按「卖出 − 第一次买入」配对计算，加仓行不展示收益；卖出必有对应的在先买入</span>
              ；超买但未盈利（收益率≤0）时不卖出，继续持有等待下一次信号；末尾未卖出记为“持仓中”。
            </div>
            <Table
              dataSource={percentileTradeRows}
              columns={percentileTradeColumns}
              rowKey="key"
              pagination={false}
              size="middle"
              bordered
              scroll={{ x: 1250 }}
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
                    background: weeklyRsiColor,
                    marginRight: 8,
                    borderRadius: 2,
                    verticalAlign: 'middle',
                  }}
                />
                {mainName} · 买点标注
              </span>
            }
            cardStyle={{
              background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#595959' }}>
              <span>
                <span style={{ color: '#00a800', fontWeight: 700 }}>●</span> 第一次买入
              </span>
              <span>
                <span style={{ color: '#fa8c16', fontWeight: 700 }}>▲</span> 重复买入（加仓，仅标记）
              </span>
              <span>
                <span style={{ color: 'rgba(3, 96, 255, 1)', fontWeight: 700 }}>●</span> 卖出（与第一次买入配对）
              </span>
            </div>
            <DualAxes {...percentileChartConfig} />
          </CollapsibleCard>
        </CollapsibleCard>
      )}



    </Space>
  );
};

export default memo(RsiFilterMark);
