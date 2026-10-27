import {
  analyzeMonthlyQuarterlyPercentile,
  analyzeSinglePeriodPercentile,
  calculatePeriodRSI,
  computeRSIRecommendations,
} from '@/utils/stockUtils';
import type {
  CloseValueType,
  KLineData,
  MonthlyQuarterlyPercentileBuyPoint,
  PercentileThresholdPair,
  SinglePeriodPercentileTrade,
} from '@/utils/stockUtils';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';
import { appConfig } from '@/config/appConfig';

const { weekly: WEEKLY_RSI_CONFIG, monthly: MONTHLY_RSI_CONFIG } = appConfig.rsi.singlePeriod;

/**
 * RsiFilterMark 详情页重计算内核
 *
 * 只做纯数据计算并返回可结构化克隆的结果，供独立 Worker 调用；
 * 图表配置（含函数/回调）仍在主线程构造。
 */

/** 详情计算类型：个股 / 指数 / 基金 / 大宗商品 */
export type RsiDetailType = 'stock' | 'index' | 'fund' | 'commodity';

/** 详情计算任务（可结构化克隆） */
export interface RsiDetailTask {
  type: RsiDetailType;
  /** 基金场景下 收盘 即累计收益率（由 FundRsiFilterMark 映射） */
  rawData: KLineData[];
}

/** 周期 RSI 字段名（与 stockUtils 中 computeRSIRecommendations 返回字段一致） */
export type RsiFieldKey =
  | '__daily__RSI6__'
  | '__weekly__RSI6__'
  | '__monthly__RSI6__'
  | '__quarterly__RSI6__';

/** 带各周期 RSI6 与推荐级别的日 K 行 */
export type RsiChartRow = KLineData & {
  __recommendationLevel__: number | null;
} & Record<RsiFieldKey, number | null>;

/** 推荐买点行（推荐级别必不为 null） */
export type RsiBuyPointRow = RsiChartRow & { __recommendationLevel__: number };

/** 详情计算统一结果（全部为可结构化克隆的纯数据） */
export interface RsiDetailResult {
  /** 主图左轴数据（label 由主线程按标的类型补） */
  mainChartData: { date: string; value: number }[];
  /** 推荐买点（指数/基金已按月折叠为每月最晚一条） */
  buyPointList: RsiBuyPointRow[];
  /** 日/周/月/季 RSI6 K 线 */
  periodRSI: {
    dailyRSI: KLineData[];
    weeklyRSI: KLineData[];
    monthlyRSI: KLineData[];
    quarterlyRSI: KLineData[];
  };
  /** 周 RSI6 百分位策略最新一期窗口阈值快照（仅用于图表参考线） */
  weeklyThreshold: PercentileThresholdPair | null;
  /** 周 RSI6 百分位策略买卖配对（as-of 判定） */
  weeklyTrades: SinglePeriodPercentileTrade[];
  /** 月 RSI6 百分位策略最新一期窗口阈值快照（仅用于图表参考线） */
  monthlyThreshold: PercentileThresholdPair | null;
  /** 月 RSI6 百分位策略买卖配对（as-of 判定） */
  monthlyTrades: SinglePeriodPercentileTrade[];
  /** 月&季 RSI6 共振买点 */
  mqBuyPoints: MonthlyQuarterlyPercentileBuyPoint[];
  /** 月&季 各级别买入阈值（最新月窗口快照，仅用于图表参考线） */
  mqThresholds: Record<number, { monthly: number; quarterly: number }> | null;
  /** 月&季 卖出阈值（最新月窗口快照） */
  mqSellThresholds: { monthly: number; quarterly: number } | null;
}

/** 主线程 -> Worker 请求 */
export interface RsiDetailWorkerRequest {
  id: number;
  task: RsiDetailTask;
}

/** Worker -> 主线程响应 */
export interface RsiDetailWorkerResponse {
  id: number;
  ok: boolean;
  result?: RsiDetailResult;
  error?: string;
}

/**
 * 执行详情页 RSI6 全量计算（与改造前 RsiFilterMark 大 useMemo 的计算口径逐行一致）
 * @param task 标的类型 + 日 K 序列
 */
export const runRsiDetailTask = (task: RsiDetailTask): RsiDetailResult => {
  const { type, rawData } = task;

  // 1) 日/周/月/季 RSI6
  const periodRSI = calculatePeriodRSI(rawData);

  // 2) 日 K 映射各周期 RSI6 + 推荐级别
  const chartData = computeRSIRecommendations(periodRSI, type) as unknown as RsiChartRow[];

  // 3) 推荐买点；指数/基金按月折叠为每月最晚一条
  let buyPointList = chartData.filter(
    (row): row is RsiBuyPointRow => row.__recommendationLevel__ != null,
  );
  if (type === 'index' || type === 'fund') {
    buyPointList = convertToMonthlyData(buyPointList) as RsiBuyPointRow[];
  }

  // 收盘值语义：基金为累计收益率（%，可为负），其余为价格/指数
  const closeValueType: CloseValueType = type === 'fund' ? 'cumulativeReturn' : 'price';

  // 4) 周/月 RSI6 单周期百分位策略（阈值 + 配对一次产出）
  const weeklyAnalysis = analyzeSinglePeriodPercentile({
    rsiData: periodRSI.weeklyRSI,
    buyPercentile: WEEKLY_RSI_CONFIG.buyPercentile,
    sellPercentile: WEEKLY_RSI_CONFIG.sellPercentile,
    closeValueType,
  });
  const monthlyAnalysis = analyzeSinglePeriodPercentile({
    rsiData: periodRSI.monthlyRSI,
    buyPercentile: MONTHLY_RSI_CONFIG.buyPercentile,
    sellPercentile: MONTHLY_RSI_CONFIG.sellPercentile,
    closeValueType,
  });

  // 5) 月&季 RSI6 共振策略（阈值 + 卖点 + 买点）
  const mqAnalysis = analyzeMonthlyQuarterlyPercentile({
    monthlyRSI6Data: periodRSI.monthlyRSI,
    quarterlyRSI6Data: periodRSI.quarterlyRSI,
    priceSeries: rawData,
    closeValueType,
  });

  return {
    mainChartData: chartData.map((row) => ({ date: row.日期, value: row.收盘 })),
    buyPointList,
    periodRSI,
    weeklyThreshold: weeklyAnalysis.threshold,
    weeklyTrades: weeklyAnalysis.trades,
    monthlyThreshold: monthlyAnalysis.threshold,
    monthlyTrades: monthlyAnalysis.trades,
    mqBuyPoints: mqAnalysis?.buyPoints ?? [],
    mqThresholds: mqAnalysis?.thresholds ?? null,
    mqSellThresholds: mqAnalysis?.sellThresholds ?? null,
  };
};
