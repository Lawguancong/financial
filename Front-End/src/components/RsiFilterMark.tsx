import React, { useEffect, useMemo, memo, useState } from 'react';
import { Line, DualAxes } from '@ant-design/plots';
import { Button, Card, DatePicker, Space, Spin, Table, Tag, Tooltip } from 'antd';
import { RightOutlined, InfoCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import moment from 'moment';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { KLineData, RsiRecommendationRules, MonthlyQuarterlyPercentileBuyPoint, SinglePeriodPercentileTrade } from '@/utils/stockUtils';
import { createRecommendationAnnotations, roundPercentile, getSellTrancheCount, getSellTrancheColumnTitle, getSellTrancheIntervalDays, stockRsiRecommendationRules, indexRsiRecommendationRules, fundRsiRecommendationRules, rsiPeriodLabelMap } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';
import { createRsiDetailWorker } from '@/utils/rsiDetailWorker';
import type { RsiBuyPointRow, RsiDetailResult, RsiFieldKey } from '@/utils/rsiDetailCompute';

// RSI 策略参数统一取自 @/config/appConfig（此处仅做本地别名，保持下方 JSX/计算引用简洁）
const {
  warmup: rsiWarmup,
  asOfWindowMonths: RSI_ASOF_WINDOW_MONTHS,
  minSampleCount: MQ_MIN_SAMPLE_MONTHS,
  sellMinReturnPct: MQ_SELL_MIN_RETURN_PCT,
  monthlyQuarterly: {
    levelRules: MQ_LEVEL_RULES,
    monthlySellPercentile: MONTHLY_RSI_SELL_PERCENTILE,
    quarterlySellPercentile: QUARTERLY_RSI_SELL_PERCENTILE,
    sellMinHoldingDays: MQ_SELL_MIN_HOLDING_DAYS,
  },
  singlePeriod: { weekly: WEEKLY_RSI_CONFIG, monthly: MONTHLY_RSI_CONFIG },
} = appConfig.rsi;
const SINGLE_PERIOD_SELL_MIN_RETURN_PCT = appConfig.rsi.sellMinReturnPct;
/** 年化口径分界（天）：持有满该天数按年化收益率判定，不足按区间收益率 */
const RSI_ANNUALIZE_MIN_HOLDING_DAYS = appConfig.rsi.annualizeMinHoldingDays;
const SINGLE_PERIOD_MIN_SAMPLE_COUNT = appConfig.rsi.minSampleCount;
const WEEKLY_RSI_BUY_PERCENTILE = WEEKLY_RSI_CONFIG.buyPercentile;
const WEEKLY_RSI_SELL_PERCENTILE = WEEKLY_RSI_CONFIG.sellPercentile;
const MONTHLY_RSI_PCT_BUY_PERCENTILE = MONTHLY_RSI_CONFIG.buyPercentile;
const MONTHLY_RSI_PCT_SELL_PERCENTILE = MONTHLY_RSI_CONFIG.sellPercentile;
/** as-of 窗口折算年数（仅用于文案展示，实际口径仍按月数配置） */
const RSI_ASOF_WINDOW_YEARS = RSI_ASOF_WINDOW_MONTHS / 12;

interface RsiFilterMarkProps {
  data: KLineData[]; // data数据格式参考KLineData
  /** 标的类型：股票 / 指数 / 基金 / 大宗商品，决定推荐级别的计算口径 */
  type: 'stock' | 'index' | 'fund' | 'commodity';
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

// 周期 RSI 字段名与推荐买点类型由 Worker 计算内核统一提供
// （RsiBuyPointRow / RsiChartRow 定义见 @/utils/rsiDetailCompute）

// 百分位买卖阈值（周、月 RSI6 策略各自独立的买入/卖出阈值）
interface PercentileThresholds {
  /** 周RSI6 买入阈值：跌破该值建仓（对应 WEEKLY_RSI_BUY_PERCENTILE 分位） */
  weeklyBuyThreshold: number;
  /** 周RSI6 卖出阈值：突破该值且收益率达门槛时卖出（对应 WEEKLY_RSI_SELL_PERCENTILE 分位） */
  weeklySellThreshold: number;
  /** 月RSI6 买入阈值：触及（≤）该值建仓/加仓（对应 MONTHLY_RSI_PCT_BUY_PERCENTILE 分位） */
  monthlyBuyThreshold: number;
  /** 月RSI6 卖出阈值：触及（≥）该值且收益率达门槛时卖出（对应 MONTHLY_RSI_PCT_SELL_PERCENTILE 分位） */
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

/** 主图折线（指数/收盘价）颜色：折线、左轴标题、图例、tooltip 统一使用 */
const mainColor = '#ff0033';

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

/** 详情 Worker 返回的日/周/月/季 RSI6 K 线 */
type PeriodRSIMap = RsiDetailResult['periodRSI'];
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

/** 历史分位参考的 RSI6 数据点（含日期时间戳，便于按窗口筛选） */
interface RsiPoint {
  date: string;
  value: number;
  /** 日期时间戳（毫秒），用于「近 N 年」窗口过滤 */
  time: number;
}

/**
 * 取某周期剔除预热后的有效 RSI6 数据点（日期 + 数值）
 * 用于历史分位计算、当前值分位位置统计等
 * @param map 同 getRsiArray
 * @param periodKey 周期键
 * @param warmup 预热点数，默认 rsiWarmup
 */
const getRsiPoints = (
  map: PeriodRSIMap,
  periodKey: RsiPeriodKey,
  warmup: number = rsiWarmup,
): RsiPoint[] =>
  getRsiArray(map, periodKey, warmup).reduce<RsiPoint[]>((points, item) => {
    if (typeof item.__RSI6__ === 'number') {
      points.push({
        date: item.日期,
        value: item.__RSI6__,
        time: moment(item.日期).valueOf(),
      });
    }
    return points;
  }, []);

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

/** 历史分位参考窗口键：全历史 / 近10年 / 近5年 / 近3年 */
type RsiWindowKey = 'full' | '10y' | '5y' | '3y';

/**
 * 历史分位参考窗口定义：全历史 + 近10/5/3年。
 * 「近 N 年」以样本最后一个数据点回推（而非当前自然日），保证与 as-of 分位口径一致；数据跨度不足 N 年时该窗口不展示。
 */
const RSI_WINDOW_DEFS: { key: RsiWindowKey; label: string; years: number | null }[] =
  appConfig.chart.rsiPercentileWindows;

/** 历史分位参考展示的分位列（升序），由 appConfig 统一配置 */
const RSI_PERCENTILE_REFS: number[] = appConfig.chart.rsiPercentileRefs;

/** 分位参考表格的列模板：窗口 + N 个分位 + 位置（一屏内自适应，不横向滚动） */
const RSI_PERCENTILE_GRID_TEMPLATE = `44px repeat(${RSI_PERCENTILE_REFS.length}, 1fr) 1fr`;

/** 分位列口径说明（hover 浮层）：RSI6 采用 Wilder 平滑；最近秩法直接取样本，不做插值 */
const RSI_PERCENTILE_TIP =
  'RSI6 口径：标准 Wilder 平滑（Wilder RSI，首期简单平均播种、之后按 1/6 权重递推）；分位阈值：窗口内样本升序排列后取第 ceil(分位% × 样本数) 个样本的 RSI6 值（最近秩法，不插值）。';

/** 位置列口径说明：按离散样本计数得到的经验分位，与分位列的名义刻度可能有差异 */
const RSI_POSITION_TIP =
  '位置：当前 RSI6 在窗口内的经验分位 = 「≤ 当前值的样本数 ÷ 样本总数」。分位列按最近秩取整、不插值，样本较少时两者刻度会不同，如 116 个样本时 2% 取到第 3 个样本，其经验分位为 3/116 ≈ 2.6%。';

/**
 * 周期卡片网格列数：
 * - 4 个周期 → 2 列（上下 2 行、每行 2 个）
 * - 3 个 → 3 列（一行铺满）
 * - 2 个 → 2 列；1 个 → 1 列
 */
const resolveRsiCardColumns = (count: number) => (count >= 4 ? 2 : Math.max(1, count));

/** 单个窗口的分位与位置 */
interface RsiWindowStat {
  key: RsiWindowKey;
  label: string;
  /** 各分位值，顺序与 appConfig.chart.rsiPercentileRefs 一致；无样本时为 null */
  percentiles: (number | null)[];
  /** 当前值在该窗口中的历史分位位置（0~100） */
  position: number | null;
  /** 窗口内有效样本数 */
  sampleCount: number;
}

// 单周期 RSI 分位统计
interface RsiStat {
  label: string;
  /** 与该周期折线一致的主题色 */
  color: string;
  current: number | null;
  /** 全历史 + 近10/5/3年各窗口统计（数据不足的窗口不出现） */
  windows: RsiWindowStat[];
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
const QuantRuleNote: React.FC<{ type: 'stock' | 'index' | 'fund' | 'commodity' }> = ({ type }) => {
  const rules: RsiRecommendationRules =
    type === 'stock' || type === 'commodity'
      ? stockRsiRecommendationRules
      : type === 'fund'
        ? fundRsiRecommendationRules
        : indexRsiRecommendationRules;
  // 星级从高到低展示
  const levels = Object.keys(rules)
    .map(Number)
    .sort((a, b) => b - a);

  const periodText =
    type === 'stock' || type === 'commodity' ? '日/周/月/季' : '月度/季度';
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

  // 月&季 RSI6 ★5 分批卖出：批次 = 1 时不展示分批列
  const sellTrancheCount = getSellTrancheCount();
  const sellTrancheIntervalDays = getSellTrancheIntervalDays();

  // 可见周期：未指定时展示全部四周期；指定后仅展示传入的周期
  const visibleRsiPeriods = visiblePeriods
    ? rsiPeriods.filter(({ periodKey }) => visiblePeriods.includes(periodKey))
    : rsiPeriods;
  const visiblePeriodKeySet = new Set(visibleRsiPeriods.map(({ periodKey }) => periodKey));
  const showWeekly = visiblePeriodKeySet.has('weekly');
  const showDaily = visiblePeriodKeySet.has('daily');

  /** 样本区间（受控，null = 未选择，使用全部数据）；支持只选开始或只选结束，选择后先裁剪数据再送 Worker 计算 */
  const [sampleRange, setSampleRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const hasSampleRange = Boolean(sampleRange?.[0] || sampleRange?.[1]);

  /** 数据自身日期边界：开始不得早于最早日期，结束不得晚于最晚日期 */
  const dataDateBounds = useMemo(() => {
    if (!data?.length) return null;
    let min = Infinity;
    let max = -Infinity;
    data.forEach((item) => {
      const t = moment(item.日期).valueOf();
      if (!Number.isFinite(t)) return;
      if (t < min) min = t;
      if (t > max) max = t;
    });
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }, [data]);

  /**
   * 区间内的样本数据（含首尾两日），后续 RSI / 分位 / 买卖点均基于该数据重算。
   * 支持单边区间：只选开始 → 该日期及之后全部数据；只选结束 → 该日期及之前全部数据。
   */
  const filteredData = useMemo(() => {
    const start = sampleRange?.[0];
    const end = sampleRange?.[1];
    if (!data?.length || (!start && !end)) return data;
    const startMs = start ? start.startOf('day').valueOf() : -Infinity;
    const endMs = end ? end.endOf('day').valueOf() : Infinity;
    return data.filter((item) => {
      const t = moment(item.日期).valueOf();
      return t >= startMs && t <= endMs;
    });
  }, [data, sampleRange]);

  /** 区间内样本摘要：样本点数与首尾日期，用于高亮条上直观展示当前样本规模 */
  const sampleRangeStats = useMemo(() => {
    if (!filteredData?.length) return null;
    const first = filteredData[0]?.日期;
    const last = filteredData[filteredData.length - 1]?.日期;
    const format = (value?: string) => (value && moment(value).isValid() ? moment(value).format('YYYY-MM-DD') : '--');
    return { count: filteredData.length, first: format(first), last: format(last) };
  }, [filteredData]);

  /** 只清除开始日期，保留结束日期（变为「结束日期及之前」的单边区间） */
  const clearSampleStart = () => {
    setSampleRange((prev) => (prev?.[1] ? [null, prev[1]] : null));
  };

  /** 只清除结束日期，保留开始日期（变为「开始日期及之后」的单边区间） */
  const clearSampleEnd = () => {
    setSampleRange((prev) => (prev?.[0] ? [prev[0], null] : null));
  };

  console.log('样本区间数据 filteredData', filteredData);

  // 数据内容签名：父组件重建等值数组时不重复计算；
  // 签名变化时立即判定为未就绪（loading），避免旧图表短暂闪现
  const dataSignature = useMemo(
    () =>
      `${type}|${filteredData?.length ?? 0}|${filteredData?.[0]?.日期 ?? ''}|${filteredData?.[filteredData.length - 1]?.日期 ?? ''}|${filteredData?.[0]?.收盘 ?? ''}`,
    [filteredData, type],
  );

  // 计算结果与数据签名绑定：签名不一致视为未就绪；
  // Worker 失败时仍记录签名（result=null），避免永久 loading
  const [detail, setDetail] = useState<{ signature: string; result: RsiDetailResult | null } | null>(null);

  useEffect(() => {
    if (!filteredData?.length) {
      return;
    }
    // 每个 RsiFilterMark 实例独占 1 个 Worker；数据变化时终止旧 Worker，最新数据优先
    const client = createRsiDetailWorker();
    let cancelled = false;
    client
      .compute({ type, rawData: filteredData })
      .then((result) => {
        if (!cancelled) setDetail({ signature: dataSignature, result });
      })
      .catch(() => {
        if (!cancelled) setDetail({ signature: dataSignature, result: null });
      });
    return () => {
      cancelled = true;
      client.terminate();
    };
  }, [dataSignature, filteredData, type]);

  const matchedResult = detail && detail.signature === dataSignature ? detail.result : null;
  const isLoading = Boolean(filteredData?.length) && (!detail || detail.signature !== dataSignature);

  const {
    buyPointList,
    mainChartConfig,
    rsiLineConfigs,
    rsiStats,
    percentileTrades,
    percentileChartConfig,
    monthlyPercentileTrades,
    monthlyPercentileChartConfig,
    monthlyQuarterlyBuyList,
    monthlyQuarterlyChartConfig,
  } = useMemo(() => {
    const emptyResult = {
      buyPointList: [] as RsiBuyPointRow[],
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

    if (!matchedResult) {
      return emptyResult;
    }

    // Worker 已完成 RSI6 / 推荐级别 / 百分位配对等重计算，这里只消费纯数据并构造图表配置
    const {
      mainChartData,
      buyPointList,
      periodRSI: periodRSIMap,
      weeklyThreshold,
      weeklyTrades,
      monthlyThreshold,
      monthlyTrades,
      mqBuyPoints: monthlyQuarterlyBuyList,
      mqThresholds: monthlyQuarterlyThresholds,
      mqSellThresholds: monthlyQuarterlySellThresholds,
    } = matchedResult;

    // 生成买点标注
    const annotations = createRecommendationAnnotations(buyPointList);

    // 左轴数据（指数/收盘价）
    const mainData = mainChartData.map((item) => ({
      date: item.date,
      label: mainName,
      value: item.value,
    }));
    // 右轴数据（仅月/季 RSI6）：取月 K / 季 RSI6 的实际数据点（每月一个点），
    // 不按日重复填充，避免月内数值恒定造成“平台式直线”；
    // 季RSI6 为「季初→当月」截断口径的按月序列，与月RSI6 一样使用 smooth 光滑曲线
    const rsiLongData = mainChartRsiPeriods.flatMap((periodMeta) =>
      toRsiLineData(periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)] as RsiKLineData[], periodMeta.label),
    );

    // 统一颜色映射：所有系列 label → 颜色（保证折线、图例、tooltip 颜色一致）
    const colorDomain = [mainName, ...mainChartRsiPeriods.map(({ label }) => label)];
    const colorRange = [mainColor, ...mainChartRsiPeriods.map(({ color }) => color)];

    // tooltip 查表：日 RSI 按日精确匹配；周 RSI 按年周补齐；月/季 RSI 按月补齐。
    // 周匹配口径与 aggregateKLineByPeriod 的周分组键一致（ISO weekYear + week）：
    // 必须用 weekYear 而非日历 year，否则跨年周（如 2014-12-29~2015-01-02）的周末点
    // 与 hover 日期分属两个键，tooltip 会查不到周 RSI6
    const dailyTooltipMap = buildTooltipMap(
      periodRSIMap.dailyRSI as RsiKLineData[],
      (d) => moment(d).format('YYYY-MM-DD'),
    );
    const weeklyTooltipMap = buildTooltipMap(
      periodRSIMap.weeklyRSI as RsiKLineData[],
      (d) => {
        const date = moment(d);
        return `${date.weekYear()}-${date.week()}`;
      },
    );
    const monthlyTooltipMap = buildTooltipMap(
      periodRSIMap.monthlyRSI as RsiKLineData[],
      (d) => moment(d).format('YYYY-MM'),
    );
    // 季RSI6 tooltip 按「年月」对齐：hover 到某天时取该月「季初→当月」截断口径的季 RSI6，
    // 与季RSI6 折线、月&季策略表格同口径（均按年月匹配，天然不含未来函数）
    const quarterlyTooltipMap = buildTooltipMap(
      periodRSIMap.quarterlyRSI as RsiKLineData[],
      (d) => moment(d).format('YYYY-MM'),
    );
    const getQuarterlyRsi = (dateStr: string): number | null | undefined =>
      quarterlyTooltipMap.get(moment(dateStr).format('YYYY-MM'));
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
                      value: formatTooltipValue(weeklyTooltipMap.get(`${date.weekYear()}-${date.week()}`)),
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
            // 按系列映射折线形状：月/季 RSI6 均为按月产出的连续序列，统一使用光滑曲线（'smooth'）
            shape: {
              domain: mainChartRsiPeriods.map(({ label }) => label),
              range: mainChartRsiPeriods.map(() => 'smooth'),
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

    // 7) 各周期 RSI6 当前值、全历史 / 近10年 / 近5年 / 近3年 的各分位（appConfig.chart.rsiPercentileRefs）与位置（仅可见周期）
    // 窗口以样本最后一个数据点回推；数据跨度不足 N 年的窗口不展示（无有效样本时同样跳过）
    const rsiStats: RsiStat[] = visibleRsiPeriods.map(({ label, color, periodKey }) => {
      // 剔除前 rsiWarmup 个预热点（固定值 50），避免干扰分位
      const points = getRsiPoints(periodRSIMap, periodKey);

      if (!points.length) {
        return { label, color, current: null, windows: [] };
      }

      const current = Number(points[points.length - 1].value.toFixed(2));
      const historyStartMs = points[0].time;
      // 窗口锚点取样本最后一个数据点，而非当前自然日：选择样本区间后「近10年」与 as-of 分位口径一致
      const anchorMs = points[points.length - 1].time;

      const windows = RSI_WINDOW_DEFS.reduce<RsiWindowStat[]>((list, def) => {
        let values: number[];
        if (def.years == null) {
          values = points.map((point) => point.value);
        } else {
          const cutoffMs = moment(anchorMs).subtract(def.years, 'years').valueOf();
          // 数据跨度不足 N 年：该窗口不展示
          if (historyStartMs > cutoffMs) return list;
          values = points.filter((point) => point.time >= cutoffMs).map((point) => point.value);
        }
        if (!values.length) return list;

        const percentiles = RSI_PERCENTILE_REFS.map((percentile) =>
          roundPercentile(values, percentile),
        );
        // 当前值在该窗口序列中的分位位置（0~100）
        const position = Number(
          ((values.filter((value) => value <= current).length / values.length) * 100).toFixed(1),
        );

        list.push({ key: def.key, label: def.label, percentiles, position, sampleCount: values.length });
        return list;
      }, []);

      return { label, color, current, windows };
    });

    // 8) 周/月 RSI6 百分位策略：Worker 已产出买卖阈值与交易配对
    const percentileTrades: SinglePeriodPercentileTrade[] = weeklyTrades;
    const monthlyPercentileTrades: SinglePeriodPercentileTrade[] = monthlyTrades;

    const percentileThresholds: PercentileThresholds | null =
      weeklyThreshold || monthlyThreshold
        ? {
          weeklyBuyThreshold: weeklyThreshold?.buy ?? Number.NaN,
          weeklySellThreshold: weeklyThreshold?.sell ?? Number.NaN,
          monthlyBuyThreshold: monthlyThreshold?.buy ?? Number.NaN,
          monthlySellThreshold: monthlyThreshold?.sell ?? Number.NaN,
        }
        : null;

    // 9) 月+季 RSI6 共振买点/买入阈值/卖出阈值已由 Worker 产出（monthlyQuarterlyBuyList 等）

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
                  value: formatTooltipValue(weeklyTooltipMap.get(`${date.weekYear()}-${date.week()}`)),
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
    // 注意：阈值为 as-of 滚动口径，本线仅表示「最新月」的 ★1 阈值，历史各月阈值不同
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
            // 按系列映射折线形状：月/季 RSI6 均为按月产出的连续序列，统一使用光滑曲线（'smooth'）
            shape: {
              domain: [monthlyPeriodMeta.label, quarterlyPeriodMeta.label],
              range: ['smooth', 'smooth'],
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
  }, [matchedResult, mainName, visibleRsiPeriods, showDaily, showWeekly]);

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
        title: '平均收益率',
        dataIndex: 'returnRate',
        key: 'returnRate',
        align: 'right' as const,
        width: 100,
        render: renderPercent,
      },
      // 分批卖出各批收益率（批次 = 1 时不生成列）：未执行批次展示 --
      ...Array.from({ length: sellTrancheCount > 1 ? sellTrancheCount : 0 }, (_, index) => ({
        title: getSellTrancheColumnTitle(index + 1),
        key: `sellTranche-${index}`,
        align: 'right' as const,
        width: 120,
        render: (_: unknown, row: MonthlyQuarterlyPercentileBuyPoint) => {
          const tranche = row.sellTranches?.[index];
          return renderPercent(tranche?.executed ? (tranche.returnRate ?? null) : null);
        },
      })),
      {
        title: '年化收益率',
        dataIndex: 'annualizedReturn',
        key: 'annualizedReturn',
        align: 'right' as const,
        width: 110,
        render: renderPercent,
      },
    ],
    [mainName, sellTrancheCount],
  );

  /** 样本区间控件：空数据状态下也保留，便于用户重新选择区间 */
  const sampleRangeControl = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        background: hasSampleRange
          ? `linear-gradient(90deg, ${withAlpha('#722ed1', 0.09)} 0%, ${withAlpha('#1890ff', 0.05)} 100%)`
          : 'linear-gradient(90deg, #fafbfc 0%, #f2f5f9 100%)',
        border: `1px solid ${hasSampleRange ? withAlpha('#722ed1', 0.3) : '#e6eaf1'}`,
        boxShadow: hasSampleRange ? `0 2px 10px ${withAlpha('#722ed1', 0.08)}` : 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              fontSize: 14,
              color: hasSampleRange ? '#fff' : '#8c8c8c',
              background: hasSampleRange
                ? 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)'
                : '#eceff4',
              boxShadow: hasSampleRange ? `0 2px 6px ${withAlpha('#722ed1', 0.25)}` : 'none',
            }}
          >
            <CalendarOutlined />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#262626' }}>
              样本区间
              <Tag
                color={hasSampleRange ? 'purple' : undefined}
                style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px' }}
              >
                {hasSampleRange ? '已启用' : '全部数据'}
              </Tag>
            </span>
            <span style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
              {sampleRangeStats
                ? `${sampleRangeStats.count.toLocaleString()} 个样本点 · ${sampleRangeStats.first} ~ ${sampleRangeStats.last}`
                : '暂无可用样本'}
            </span>
          </div>
        </div>
        <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DatePicker.RangePicker
            allowClear
            allowEmpty={[true, true]}
            size="small"
            value={sampleRange}
            placeholder={['开始日期', '结束日期']}
            style={{ width: 280 }}
            onChange={(dates) => setSampleRange(dates ?? null)}
            disabledDate={(current) => {
              if (!current || !dataDateBounds) return false;
              return (
                current.isBefore(dayjs(dataDateBounds.min), 'day') ||
                current.isAfter(dayjs(dataDateBounds.max), 'day')
              );
            }}
          />
          <Button
            type="link"
            size="small"
            disabled={!sampleRange?.[0]}
            onClick={clearSampleStart}
            style={{ padding: 0, fontSize: 12 }}
          >
            清除开始
          </Button>
          <Button
            type="link"
            size="small"
            disabled={!sampleRange?.[1]}
            onClick={clearSampleEnd}
            style={{ padding: 0, fontSize: 12 }}
          >
            清除结束
          </Button>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          paddingTop: 8,
          borderTop: `1px dashed ${withAlpha('#722ed1', 0.18)}`,
          fontSize: 12,
          lineHeight: 1.7,
          color: '#5c6b82',
        }}
      >
        <InfoCircleOutlined style={{ color: '#722ed1', marginTop: 3 }} />
        <span>
          选择区间后执行<span style={{ color: '#262626', fontWeight: 600 }}>「先筛选样本，再重新计算」</span>：先按区间裁剪数据，
          <span style={{ color: '#1890ff', fontWeight: 600 }}>再基于筛选结果重算 RSI6、历史分位与买卖点</span>
          （不使用区间外数据，避免未来信息干扰）；可用于对比标的在不同年份的策略表现。支持三种区间：
          <span style={{ color: '#722ed1', fontWeight: 600 }}>同时选择开始与结束</span>（按所选闭区间裁剪）、
          <span style={{ color: '#722ed1', fontWeight: 600 }}>只选开始</span>（该日期及之后）或
          <span style={{ color: '#722ed1', fontWeight: 600 }}>只选结束</span>（该日期及之前）的单边区间。
        </span>
      </div>
    </div>
  );

  if (!filteredData?.length) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {sampleRangeControl}
        <div>{hasSampleRange ? '所选样本区间内暂无数据，请调整日期范围' : '暂无数据'}</div>
      </Space>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '48px 0',
          borderRadius: 8,
          background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
          border: '1px solid #e8e8e8',
        }}
      >
        <Spin size="large" />
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>RSI6 多周期指标与买卖点计算中，请稍候…</span>
      </div>
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {sampleRangeControl}
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${resolveRsiCardColumns(rsiStats.length)}, minmax(0, 1fr))`,
              gap: 8,
            }}
          >
            {rsiStats.map((stat) => {
              return (
                <div
                  key={stat.label}
                  style={{
                    minWidth: 0,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: withAlpha(stat.color, 0.06),
                    border: `1px solid ${withAlpha(stat.color, 0.25)}`,
                    borderLeft: `3px solid ${stat.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  </div>
                  {/* 各窗口分位参考：全历史 / 近10年 / 近5年 / 近3年（数据跨度不足的窗口不展示） */}
                  <div
                    style={{
                      marginTop: 8,
                      display: 'grid',
                      gridTemplateColumns: RSI_PERCENTILE_GRID_TEMPLATE,
                      columnGap: 4,
                      fontSize: 11,
                      color: '#8c8c8c',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.6,
                    }}
                  >
                    <span>窗口</span>
                    {RSI_PERCENTILE_REFS.map((percentile) => (
                      <Tooltip key={percentile} title={RSI_PERCENTILE_TIP}>
                        <span
                          style={{
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            cursor: 'help',
                            textDecoration: 'underline dotted rgba(0, 0, 0, 0.25)',
                          }}
                        >
                          {percentile}%
                        </span>
                      </Tooltip>
                    ))}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      位置
                      <Tooltip title={RSI_POSITION_TIP}>
                        <InfoCircleOutlined style={{ fontSize: 10, color: '#bfbfbf', cursor: 'help' }} />
                      </Tooltip>
                    </span>
                  </div>
                  {stat.windows.map((win, index) => (
                    <div
                      key={win.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: RSI_PERCENTILE_GRID_TEMPLATE,
                        columnGap: 4,
                        fontSize: 12,
                        padding: '3px 0',
                        borderTop: `1px ${index === 0 ? 'solid' : 'dashed'} ${withAlpha(stat.color, index === 0 ? 0.25 : 0.12)}`,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span style={{ color: index === 0 ? '#595959' : '#8c8c8c', fontWeight: index === 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {win.label}
                      </span>
                      {win.percentiles.map((value, colIndex) => (
                        <span
                          key={RSI_PERCENTILE_REFS[colIndex]}
                          style={{ textAlign: 'right', color: '#595959', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {value != null ? value.toFixed(2) : '--'}
                        </span>
                      ))}
                      <span style={{ textAlign: 'right', color: '#595959', whiteSpace: 'nowrap' }}>
                        {win.position != null ? `${win.position}%` : '--'}
                      </span>
                    </div>
                  ))}
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
            规则：月RSI6 与 季RSI6 同时触及（≤）对应「截至当月、近 {RSI_ASOF_WINDOW_MONTHS} 个月（约 {RSI_ASOF_WINDOW_YEARS} 年，可配置）」的滚动分位时记为买点，按分位严度分级（星级越高共振越强）。
            {MQ_LEVEL_RULES.map(({ level, monthlyPercentile, quarterlyPercentile }) => (
              <div key={level}>
                <span style={{ color: '#ffd700', fontWeight: 700 }}>{'★'.repeat(level)}</span>：月RSI6{' '}
                <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>≤ {monthlyPercentile}% 分位</span>
                且 季RSI6{' '}
                <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>≤ {quarterlyPercentile}% 分位</span>
                <span style={{ color: '#8c8c8c' }}>（均按近 {RSI_ASOF_WINDOW_YEARS} 年滚动分位）</span>
              </div>
            ))}
            <div style={{ color: '#595959' }}>
              按月扫描，季度值取当月「季初→当月」截断口径的季 RSI6（1 月只用 1 月数据、2 月用 1～2 月数据，不使用未来的季末数据回填，与图中季RSI6 折线一致）；同一月份满足多个级别时取最高星级展示。
            </div>
            <div style={{ color: '#595959' }}>
              as-of 口径：判定某月时，分位阈值只用该月及之前、近{' '}
              <span style={{ fontWeight: 600 }}>{RSI_ASOF_WINDOW_MONTHS} 个月</span>（约 {RSI_ASOF_WINDOW_YEARS} 年，可配置）的月/季 RSI6 样本滚动计算（含当月），
              不使用该月之后的数据；历史不足 {RSI_ASOF_WINDOW_YEARS} 年但满 {MQ_MIN_SAMPLE_MONTHS} 个月时使用全部历史；月、季两个窗口均满{' '}
              <span style={{ fontWeight: 600 }}>{MQ_MIN_SAMPLE_MONTHS} 个</span>有效样本（受季序列滞后影响，约 6.5 年历史）后才开始产生买卖信号；
              上文只展示分位秩，历史各月按各自的滚动阈值判定；图中月/季水平虚线仅表示最新月的 ★1 阈值。
            </div>
            <div style={{ marginTop: 4 }}>
              卖出规则：月RSI6{' '}
              <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
                ≥ {MONTHLY_RSI_SELL_PERCENTILE}% 分位
              </span>
              且 季RSI6{' '}
              <span style={{ color: quarterlyRsiColor, fontWeight: 600 }}>
                ≥ {QUARTERLY_RSI_SELL_PERCENTILE}% 分位
              </span>
              （均按截至当月、近 {RSI_ASOF_WINDOW_YEARS} 年的滚动分位）、且持有满{' '}
              <span style={{ fontWeight: 600 }}>{MQ_SELL_MIN_HOLDING_DAYS} 天</span>（约 1 年，可配置）、
              且收益率达门槛（该天数之后按年化收益率{' '}
              <span style={{ fontWeight: 600 }}>≥ {MQ_SELL_MIN_RETURN_PCT}%</span>）时视为可卖出点；
              <span style={{ color: '#595959' }}>
                持有未满 {MQ_SELL_MIN_HOLDING_DAYS} 天或收益率未达门槛均不卖出、继续持有，
                等待下一次同时满足「RSI 超买 + 持有满期 + 收益率门槛」的信号（阈值可配置）。
              </span>
              <span style={{ color: '#595959' }}>
                触发卖出信号后{sellTrancheCount > 1
                  ? `分 ${sellTrancheCount} 批卖出，每批间隔 ${sellTrancheIntervalDays} 天（第 1 批为信号当日，目标日非交易日顺延至下一交易日收盘）；各批收益率分别按「本批卖出价 vs 买入价」计算，取算术平均作为「平均收益率」`
                  : '一次性卖出（当前批次配置为 1）'}
                ；持有天数与年化收益率仍按首笔卖出信号日计算。
              </span>
              <span style={{ color: '#595959' }}>
                ★5买点与卖点按时间顺序配对（★5买→卖→★5买→卖…）；★1/★3买点及未配对的★5买点卖出列留空。
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
            scroll={{ x: 1260 + (sellTrancheCount > 1 ? sellTrancheCount * 120 : 0) }}
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
              ≤ {MONTHLY_RSI_PCT_BUY_PERCENTILE}% 分位
            </span>
            （截至当月、近 {RSI_ASOF_WINDOW_YEARS} 年滚动）第一次买入建仓；
            <span style={{ color: '#595959' }}>持仓期间每月月RSI6 触及（≤）该分位即重复买入（加仓），表格中逐笔列出全部买入</span>
            ；月RSI6{' '}
            <span style={{ color: monthlyRsiColor, fontWeight: 600 }}>
              ≥ {MONTHLY_RSI_PCT_SELL_PERCENTILE}% 分位
            </span>
            （截至当月、近 {RSI_ASOF_WINDOW_YEARS} 年滚动）且相对
            <span style={{ color: '#595959' }}>第一次买入价</span>的收益率达门槛（持有满 {RSI_ANNUALIZE_MIN_HOLDING_DAYS} 天按年化收益率{' '}
            <span style={{ fontWeight: 600 }}>≥ {SINGLE_PERIOD_SELL_MIN_RETURN_PCT}%</span>、不足按区间收益率{' '}
            <span style={{ fontWeight: 600 }}>≥ {SINGLE_PERIOD_SELL_MIN_RETURN_PCT}%</span>）时卖出，
            <span style={{ color: '#595959' }}>持有天数、收益率与年化收益率仅按「卖出 − 第一次买入」配对计算，加仓行不展示收益；卖出必有对应的在先买入</span>
            ；超买但收益率未达门槛时不卖出，继续持有等待下一次满足「RSI 超买 + 收益率门槛」的信号（阈值可配置）；末尾未卖出记为“持仓中”。
            <div style={{ color: '#595959' }}>
              as-of 口径：每一期只用当期及之前、近{' '}
              <span style={{ fontWeight: 600 }}>{RSI_ASOF_WINDOW_MONTHS} 个月</span>（约 {RSI_ASOF_WINDOW_YEARS} 年，可配置）的月RSI6 样本滚动计算分位阈值；
              历史不足 {RSI_ASOF_WINDOW_YEARS} 年但满 <span style={{ fontWeight: 600 }}>{SINGLE_PERIOD_MIN_SAMPLE_COUNT} 个</span>有效样本时使用全部历史，满该样本数后才开始产生信号；
              图中水平虚线仅表示最新一期的阈值。
            </div>
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
                ≤ {WEEKLY_RSI_BUY_PERCENTILE}% 分位
              </span>
              （截至当周、近 {RSI_ASOF_WINDOW_YEARS} 年滚动）第一次买入建仓；
              <span style={{ color: '#595959' }}>持仓期间每一周周RSI6 触及（≤）该分位即重复买入（加仓），表格中逐笔列出全部买入</span>
              ；周RSI6{' '}
              <span style={{ color: weeklyRsiColor, fontWeight: 600 }}>
                ≥ {WEEKLY_RSI_SELL_PERCENTILE}% 分位
              </span>
              （截至当周、近 {RSI_ASOF_WINDOW_YEARS} 年滚动）且相对
              <span style={{ color: '#595959' }}>第一次买入价</span>的收益率达门槛（持有满 {RSI_ANNUALIZE_MIN_HOLDING_DAYS} 天按年化收益率{' '}
              <span style={{ fontWeight: 600 }}>≥ {SINGLE_PERIOD_SELL_MIN_RETURN_PCT}%</span>、不足按区间收益率{' '}
              <span style={{ fontWeight: 600 }}>≥ {SINGLE_PERIOD_SELL_MIN_RETURN_PCT}%</span>）时卖出，
              <span style={{ color: '#595959' }}>持有天数、收益率与年化收益率仅按「卖出 − 第一次买入」配对计算，加仓行不展示收益；卖出必有对应的在先买入</span>
              ；超买但收益率未达门槛时不卖出，继续持有等待下一次满足「RSI 超买 + 收益率门槛」的信号（阈值可配置）；末尾未卖出记为“持仓中”。
              <div style={{ color: '#595959' }}>
                as-of 口径：每一期只用当期及之前、近{' '}
                <span style={{ fontWeight: 600 }}>{RSI_ASOF_WINDOW_MONTHS} 个月</span>（约 {RSI_ASOF_WINDOW_YEARS} 年，可配置）的周RSI6 样本滚动计算分位阈值；
                历史不足 {RSI_ASOF_WINDOW_YEARS} 年但满 <span style={{ fontWeight: 600 }}>{SINGLE_PERIOD_MIN_SAMPLE_COUNT} 个</span>有效样本时使用全部历史，满该样本数后才开始产生信号；
                图中水平虚线仅表示最新一期的阈值。
              </div>
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
