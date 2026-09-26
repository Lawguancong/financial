import moment from 'moment';
import apiClient from './axios';
import { calculateRSI, calculateFundRecommendationLevel } from './stockUtils';
import type { KLineData } from './stockUtils';

type FundDetailItem = Record<string, string | number>;

/**
 * 计算单只基金的推荐买点日期
 * 规则：基于「累计收益率走势」生成月/季 K 线，分别计算 RSI6，
 * 取推荐等级为 5/3/1 的日期；返回逗号分隔的日期字符串（按时间正序），无买点返回 ''
 */
export const fetchFundRecommendationPoints = async (fundCode: string): Promise<string> => {
  try {
    const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
      params: {
        symbol: fundCode,
        indicator: '累计收益率走势',
        period: '成立来',
      },
    });

    const detailData = (response?.data ?? []) as FundDetailItem[];
    if (detailData.length === 0) return '';

    const dateKey = '日期';
    const closeKey = '累计收益率';

    // 月度数据处理：按月分组，取每个月的最后一天数据
    const monthlyMap = new Map<string, FundDetailItem>();
    detailData.forEach((item) => {
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
          累计收益率: item[closeKey],
          __monthlyRSI6__: item.__RSI6__,
          __quarterlyRSI6__: quarterlyRSI6,
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
