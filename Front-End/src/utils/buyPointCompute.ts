import moment from 'moment';
import {
  calculateFundRecommendationLevel,
  calculatePeriodRSI,
  calculateRSI,
  computeMonthlyQuarterlyPercentileBuyPoints,
  computeRSIRecommendations,
  computeSinglePeriodPercentileTrades,
  MONTHLY_RSI_PCT_BUY_PERCENTILE,
  MONTHLY_RSI_PCT_SELL_PERCENTILE,
  WEEKLY_RSI_BUY_PERCENTILE,
  WEEKLY_RSI_SELL_PERCENTILE,
} from '@/utils/stockUtils';
import type { KLineData, MonthlyQuarterlyPercentileBuyPoint } from '@/utils/stockUtils';
import { convertToMonthlyData } from '@/pages/fund/cn/open/detail/constants';

/** 买点计算类型：个股 / 指数 / 大宗商品（含外盘期货）/ 基金 */
export type BuyPointType = 'stock' | 'index' | 'commodity' | 'fund';

/** 个股 / 指数 / 大宗商品：日 K「日期 + 收盘」序列 */
export interface BuyPointKLineItem {
  日期: string;
  收盘: number;
}

/** 基金：累计收益率序列 */
export interface BuyPointFundItem {
  日期: string;
  累计收益率: number;
}

/** 买点计算任务（可结构化克隆，用于在 Worker 与主线程间传递） */
export type BuyPointTask =
  | { type: 'stock' | 'index' | 'commodity'; rawData: BuyPointKLineItem[] }
  | { type: 'fund'; rawData: BuyPointFundItem[] };

/** 买点计算统一结果：基金无周策略时 weeklyPercentile 为空串 */
export interface BuyPointResult {
  /** 定量买点日期，逗号分隔 */
  quantitative: string;
  /** 月&季 RSI6 百分位共振买点日期，逗号分隔 */
  percentile: string;
  /** 月 RSI6 单周期百分位策略买入日期，逗号分隔 */
  monthlyPercentile: string;
  /** 周 RSI6 单周期百分位策略买入日期，逗号分隔（基金为空串） */
  weeklyPercentile: string;
  /** 月&季 RSI6 百分位共振买点明细（含推荐级别与 ★5 配对的卖出信息），供「买入&卖出报告」导出使用 */
  mqBuyPoints: MonthlyQuarterlyPercentileBuyPoint[];
}

/** 主线程 -> Worker 的计算请求 */
export interface BuyPointWorkerRequest {
  id: number;
  task: BuyPointTask;
}

/** Worker -> 主线程的计算响应 */
export interface BuyPointWorkerResponse {
  id: number;
  ok: boolean;
  result?: BuyPointResult;
  error?: string;
}

const EMPTY_RESULT: BuyPointResult = {
  quantitative: '',
  percentile: '',
  monthlyPercentile: '',
  weeklyPercentile: '',
  mqBuyPoints: [],
};

/** 统一日期格式化为 YYYY-MM-DD */
const formatDate = (date: string): string => moment(date).format('YYYY-MM-DD');

/**
 * 用日线收盘价计算「被套」口径的最大回撤：
 * 以★5买入点的收盘价为基准，取买入之后（已配对的至卖出日，未卖出则至最新交易日）
 * 低于买入价的最大跌幅，并返回该回撤点的日期与收盘价
 *
 * @returns 区间内没有任何收盘价低于买入价时返回 null（即全程未被套）
 */
const computeHoldingDrawdown = (
  dailyData: BuyPointKLineItem[],
  buyDate: string,
  buyClose: number,
  sellDate?: string,
): { maxDrawdown: number; troughDate: string; troughClose: number } | null => {
  if (!(buyClose > 0)) return null;

  // 统一为 YYYY-MM-DD 后再比较，避免原始日期格式差异（如 YYYYMMDD）导致区间判断错位
  const buyDateNorm = formatDate(buyDate);
  const sellDateNorm = sellDate ? formatDate(sellDate) : '';
  const windowData = dailyData.filter(item => {
    const dateNorm = formatDate(item.日期);
    return dateNorm >= buyDateNorm && (!sellDateNorm || dateNorm <= sellDateNorm);
  });

  // 比买入价更低的收盘价中的最低点，即为最大回撤点
  let troughClose = buyClose;
  let troughDate = '';
  windowData.forEach(item => {
    if (item.收盘 < troughClose) {
      troughClose = item.收盘;
      troughDate = item.日期;
    }
  });
  if (!troughDate) return null;

  return {
    maxDrawdown: Number((((buyClose - troughClose) / buyClose) * 100).toFixed(2)),
    troughDate: formatDate(troughDate),
    troughClose: Number(troughClose.toFixed(2)),
  };
};

/**
 * 个股 / 指数 / 大宗商品买点：日/周/月/季 RSI6 -> 推荐级别 -> 四类买点日期
 * 与各页面原有计算逐行等价，仅去除了网络请求
 */
const computeKLineBuyPoints = (
  type: 'stock' | 'index' | 'commodity',
  rawData: BuyPointKLineItem[],
): BuyPointResult => {
  // 1) 计算日/周/月/季 K 线的 RSI6 值
  const periodRSIMap = calculatePeriodRSI(rawData);

  // 2) 合并为带推荐级别的数据并过滤推荐买点
  const chartData = computeRSIRecommendations(periodRSIMap, type);
  const buyPointList = chartData.filter(row => row.__recommendationLevel__ != null);

  // 3) 定量买点：按每月最晚（最新）一条记录
  const quantitative = convertToMonthlyData(buyPointList)
    .reverse()
    .map(item => formatDate(String(item['日期'])))
    .join(',');

  // 4) 月&季 RSI6 百分位共振买点（真实价格口径）
  // 保留含推荐级别与★5卖出配对信息的完整明细，供「买入&卖出报告」导出
  const mqBuyPoints = computeMonthlyQuarterlyPercentileBuyPoints({
    monthlyRSI6Data: periodRSIMap.monthlyRSI,
    quarterlyRSI6Data: periodRSIMap.quarterlyRSI,
    closeValueType: 'price',
  });
  const percentile = mqBuyPoints.map(point => formatDate(point.日期)).join(',');

  // 4.1) 为★5买点补充「被套」口径的最大回撤指标（日线收盘，基准为买入价）
  mqBuyPoints.forEach(point => {
    const drawdown = computeHoldingDrawdown(rawData, point.日期, point.收盘, point.sellDate);
    if (!drawdown) return;
    point.maxDrawdown = drawdown.maxDrawdown;
    point.maxDrawdownDate = drawdown.troughDate;
    point.maxDrawdownClose = drawdown.troughClose;
    point.daysToMaxDrawdown = Math.max(
      0,
      moment(drawdown.troughDate).diff(moment(point.日期), 'days'),
    );
    // 年化收益率缺失（持有不足1年）或无回撤时不计算 Calmar
    if (point.annualizedReturn != null && drawdown.maxDrawdown > 0) {
      point.calmarRatio = Number((point.annualizedReturn / drawdown.maxDrawdown).toFixed(2));
    }
  });

  // 5) 月 RSI6 单周期百分位策略：取每笔配对交易的第一次买入日期
  const monthlyPercentile = computeSinglePeriodPercentileTrades({
    rsiData: periodRSIMap.monthlyRSI,
    buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
    sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
    closeValueType: 'price',
  })
    .map(trade => formatDate(trade.buyDate))
    .join(',');

  // 6) 周 RSI6 单周期百分位策略：取每笔配对交易的第一次买入日期
  const weeklyPercentile = computeSinglePeriodPercentileTrades({
    rsiData: periodRSIMap.weeklyRSI,
    buyPercentile: WEEKLY_RSI_BUY_PERCENTILE,
    sellPercentile: WEEKLY_RSI_SELL_PERCENTILE,
    closeValueType: 'price',
  })
    .map(trade => formatDate(trade.buyDate))
    .join(',');

  return { quantitative, percentile, monthlyPercentile, weeklyPercentile, mqBuyPoints };
};

/**
 * 基金买点：累计收益率序列 -> 月/季 RSI6 -> 定量 + 月&季百分位 + 月百分位
 * 与 fetchFundRecommendationPointsBoth 原有计算逐行等价，仅去除了网络请求
 */
const computeFundBuyPoints = (rawData: BuyPointFundItem[]): BuyPointResult => {
  const dateKey = '日期';
  // 累计收益率统一映射为「收盘」，供 RSI / 百分位策略（累计收益率口径）复用
  const closeKey = '收盘';
  const mappedData: KLineData[] = rawData
    .map(item => ({
      日期: String(item[dateKey]),
      收盘: Number(item['累计收益率']),
    }))
    .filter(item => !Number.isNaN(item[closeKey]));

  if (mappedData.length === 0) return { ...EMPTY_RESULT };

  // 月度：按月分组取每月最后一天
  const monthlyMap = new Map<string, KLineData>();
  mappedData.forEach(item => {
    const monthKey = moment(item[dateKey]).format('YYYY-MM');
    const current = monthlyMap.get(monthKey);
    if (!current || moment(item[dateKey]).isAfter(moment(current[dateKey]))) {
      monthlyMap.set(monthKey, item);
    }
  });
  const monthlyData = Array.from(monthlyMap.values()).sort(
    (a, b) => moment(a[dateKey]).valueOf() - moment(b[dateKey]).valueOf(),
  );

  // 季度：按月线再取每季度最后一天
  const quarterlyMap = new Map<string, KLineData>();
  monthlyData.forEach(item => {
    const itemMoment = moment(item[dateKey]);
    const quarterKey = `${itemMoment.year()}-Q${itemMoment.quarter()}`;
    const current = quarterlyMap.get(quarterKey);
    if (!current || itemMoment.isAfter(moment(current[dateKey]))) {
      quarterlyMap.set(quarterKey, item);
    }
  });
  const quarterlyData = Array.from(quarterlyMap.values()).sort(
    (a, b) => moment(a[dateKey]).valueOf() - moment(b[dateKey]).valueOf(),
  );

  const monthlyRSI6Data = calculateRSI({ data: monthlyData, closeKey, period: 6 });
  const quarterlyRSI6Data = calculateRSI({ data: quarterlyData, closeKey, period: 6 });

  // 定量：月度 RSI6 + 所在季度 RSI6 计算推荐级别，取 5/3/1
  const quarterlyRSIMap = new Map<string, number>();
  quarterlyRSI6Data.forEach(item => {
    const itemMoment = moment(String(item[dateKey]));
    quarterlyRSIMap.set(`${itemMoment.year()}-Q${itemMoment.quarter()}`, item.__RSI6__);
  });
  const quantitative = monthlyRSI6Data
    .map(item => {
      const date = String(item[dateKey]);
      const itemMoment = moment(date);
      const level = calculateFundRecommendationLevel(
        undefined,
        undefined,
        item.__RSI6__,
        quarterlyRSIMap.get(`${itemMoment.year()}-Q${itemMoment.quarter()}`),
      );
      return { 日期: date, level };
    })
    .filter(point => point.level !== null && [5, 3, 1].includes(point.level))
    .map(point => formatDate(point.日期))
    .join(',');

  // 月&季 RSI6 百分位共振买点（累计收益率口径），同时保留完整明细
  const mqBuyPoints = computeMonthlyQuarterlyPercentileBuyPoints({
    monthlyRSI6Data,
    quarterlyRSI6Data,
    closeValueType: 'cumulativeReturn',
  });
  const percentile = mqBuyPoints.map(point => formatDate(point.日期)).join(',');

  // 月 RSI6 单周期百分位策略（累计收益率口径）：取每笔配对交易的第一次买入日期
  const monthlyPercentile = computeSinglePeriodPercentileTrades({
    rsiData: monthlyRSI6Data,
    buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
    sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
    closeValueType: 'cumulativeReturn',
  })
    .map(trade => formatDate(trade.buyDate))
    .join(',');

  return { quantitative, percentile, monthlyPercentile, weeklyPercentile: '', mqBuyPoints };
};

/**
 * 执行买点计算任务（纯计算、无网络请求）
 * 由 Worker 入口与主线程降级路径共用
 */
export const runBuyPointTask = (task: BuyPointTask): BuyPointResult => {
  if (task.type === 'fund') return computeFundBuyPoints(task.rawData);
  return computeKLineBuyPoints(task.type, task.rawData);
};
