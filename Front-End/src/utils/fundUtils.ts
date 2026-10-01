import moment from 'moment';
import apiClient from './axios';
import { calculateRSI, calculateFundRecommendationLevel, computeMonthlyQuarterlyPercentileBuyPoints, computeSinglePeriodPercentileTrades, MONTHLY_RSI_PCT_BUY_PERCENTILE, MONTHLY_RSI_PCT_SELL_PERCENTILE } from './stockUtils';
import type { KLineData } from './stockUtils';

type FundDetailItem = Record<string, string | number>;

/**
 * 拉取基金累计收益率数据并生成月/季 K 线及 RSI6
 * 供「定量」与「百分位」两种推荐买点策略复用，避免重复请求
 */
const fetchFundMonthlyQuarterlyRSI = async (fundCode: string) => {
  const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
    params: {
      symbol: fundCode,
      indicator: '累计收益率走势',
      period: '成立来',
    },
  });

  const detailData = (response?.data ?? []) as FundDetailItem[];
  if (detailData.length === 0) return null;

  const dateKey = '日期';
  // 基金接口字段为「累计收益率」，统一映射为 KLineData 的「收盘」字段，
  // 与 FundRsiFilterMark 保持一致，供 calculateRSI / 百分位策略中的卖出价计算使用
  const closeKey = '收盘';
  const mappedData: FundDetailItem[] = detailData
    .map((item) => ({
      ...item,
      [closeKey]: Number(item['累计收益率']),
    }))
    .filter((item) => !Number.isNaN(item[closeKey] as number));

  // 月度数据处理：按月分组，取每个月的最后一天数据
  const monthlyMap = new Map<string, FundDetailItem>();
  mappedData.forEach((item) => {
    const date = String(item[dateKey]);
    const monthKey = moment(date).format('YYYY-MM');
    const currentItem = monthlyMap.get(monthKey);
    if (!currentItem || moment(date).isAfter(moment(String(currentItem[dateKey])))) {
      monthlyMap.set(monthKey, item);
    }
  });

  const monthlyData = Array.from(monthlyMap.values()).sort(
    (a, b) => moment(String(a[dateKey])).valueOf() - moment(String(b[dateKey])).valueOf(),
  );

  // 季度数据处理：按季度分组，取每个季度的最后一天数据
  const quarterlyMap = new Map<string, FundDetailItem>();
  monthlyData.forEach((item) => {
    const date = String(item[dateKey]);
    const itemMoment = moment(date);
    const quarterKey = `${itemMoment.year()}-Q${itemMoment.quarter()}`;
    const currentItem = quarterlyMap.get(quarterKey);
    if (!currentItem || itemMoment.isAfter(moment(String(currentItem[dateKey])))) {
      quarterlyMap.set(quarterKey, item);
    }
  });

  const quarterlyData = Array.from(quarterlyMap.values()).sort(
    (a, b) => moment(String(a[dateKey])).valueOf() - moment(String(b[dateKey])).valueOf(),
  );

  // 计算每月数据的RSI6
  const monthlyRSI6Data = calculateRSI({
    data: monthlyData as unknown as KLineData[],
    closeKey,
    period: 6,
  });
  // 计算每季度数据的RSI6
  const quarterlyRSI6Data = calculateRSI({
    data: quarterlyData as unknown as KLineData[],
    closeKey,
    period: 6,
  });

  return { monthlyRSI6Data, quarterlyRSI6Data, dateKey };
};

/**
 * 计算单只基金的推荐买点日期（定量策略）
 * 规则：基于「累计收益率走势」生成月/季 K 线，分别计算 RSI6，
 * 取推荐等级为 5/3/1 的日期；返回逗号分隔的日期字符串（按时间正序），无买点返回 ''
 */
export const fetchFundRecommendationPoints = async (fundCode: string): Promise<string> => {
  try {
    const data = await fetchFundMonthlyQuarterlyRSI(fundCode);
    if (!data) return '';
    const { monthlyRSI6Data, quarterlyRSI6Data, dateKey } = data;

    const quarterlyRSIMap = new Map<string, number>();
    quarterlyRSI6Data.forEach((rsiItem) => {
      const item = rsiItem as unknown as FundDetailItem & { __RSI6__: number };
      const itemMoment = moment(String(item[dateKey]));
      quarterlyRSIMap.set(`${itemMoment.year()}-Q${itemMoment.quarter()}`, item.__RSI6__);
    });

    const recommendationDates = monthlyRSI6Data
      .map((rsiItem) => {
        const item = rsiItem as unknown as FundDetailItem & { __RSI6__: number };
        const date = String(item[dateKey]);
        const itemMoment = moment(date);
        const quarterlyRSI6 = quarterlyRSIMap.get(`${itemMoment.year()}-Q${itemMoment.quarter()}`);
        return {
          日期: date,
          __recommendationLevel__: calculateFundRecommendationLevel(
            undefined,
            undefined,
            item.__RSI6__,
            quarterlyRSI6,
          ),
        };
      })
      .filter(
        (point) =>
          point.__recommendationLevel__ !== null &&
          [5, 3, 1].includes(point.__recommendationLevel__),
      )
      .map((point) => point.日期);

    return recommendationDates.map((date) => moment(date).format('YYYY-MM-DD')).join(',');
  } catch (error) {
    console.log('Error fetching fund detail:', error);
    return '';
  }
};

/**
 * 同时计算单只基金的「定量」「百分位」「月RSI6百分位策略」三种推荐买点日期
 * - 定量：固定 RSI6 阈值（月/季 RSI6 ≤ 阈值）
 * - 百分位：月/季 RSI6 同时跌破历史分位（★5=3% / ★3=5% / ★1=10%）
 * - 月RSI6百分位策略：月RSI6 单周期，跌破 3% 历史分位建仓（取每笔配对的第一次买入日期）
 * 返回逗号分隔的日期字符串
 */
export const fetchFundRecommendationPointsBoth = async (fundCode: string): Promise<{
  quantitative: string;
  percentile: string;
  monthlyPercentile: string;
}> => {
  try {
    const data = await fetchFundMonthlyQuarterlyRSI(fundCode);
    if (!data) return { quantitative: '', percentile: '', monthlyPercentile: '' };
    const { monthlyRSI6Data, quarterlyRSI6Data, dateKey } = data;

    // ---- 定量策略 ----
    const quarterlyRSIMap = new Map<string, number>();
    quarterlyRSI6Data.forEach((rsiItem) => {
      const item = rsiItem as unknown as FundDetailItem & { __RSI6__: number };
      const itemMoment = moment(String(item[dateKey]));
      quarterlyRSIMap.set(`${itemMoment.year()}-Q${itemMoment.quarter()}`, item.__RSI6__);
    });

    const quantitativeDates = monthlyRSI6Data
      .map((rsiItem) => {
        const item = rsiItem as unknown as FundDetailItem & { __RSI6__: number };
        const date = String(item[dateKey]);
        const itemMoment = moment(date);
        const quarterlyRSI6 = quarterlyRSIMap.get(`${itemMoment.year()}-Q${itemMoment.quarter()}`);
        return {
          日期: date,
          __recommendationLevel__: calculateFundRecommendationLevel(
            undefined,
            undefined,
            item.__RSI6__,
            quarterlyRSI6,
          ),
        };
      })
      .filter(
        (point) =>
          point.__recommendationLevel__ !== null &&
          [5, 3, 1].includes(point.__recommendationLevel__),
      )
      .map((point) => moment(point.日期).format('YYYY-MM-DD'));

    // ---- 百分位策略 ----
    const percentileBuyPoints = computeMonthlyQuarterlyPercentileBuyPoints({
      monthlyRSI6Data,
      quarterlyRSI6Data,
      closeValueType: 'cumulativeReturn',
    });
    const percentileDates = percentileBuyPoints.map((point) =>
      moment(point.日期).format('YYYY-MM-DD'),
    );

    // ---- 月RSI6 百分位策略（月单周期，买入分位 3% / 卖出 90%）----
    // 基金口径为累计收益率，closeValueType 与月&季共振策略保持一致
    const monthlyPercentileDates = computeSinglePeriodPercentileTrades({
      rsiData: monthlyRSI6Data,
      buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE,
      sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE,
      closeValueType: 'cumulativeReturn',
    }).map((trade) => moment(trade.buyDate).format('YYYY-MM-DD'));

    return {
      quantitative: quantitativeDates.join(','),
      percentile: percentileDates.join(','),
      monthlyPercentile: monthlyPercentileDates.join(','),
    };
  } catch (error) {
    console.log('Error fetching fund recommendation points:', error);
    return { quantitative: '', percentile: '', monthlyPercentile: '' };
  }
};
