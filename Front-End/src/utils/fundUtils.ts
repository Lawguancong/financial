import apiClient from './axios';
import { computeBuyPoints } from './buyPointWorker';
import type { BuyPointFundItem, BuyPointResult } from './buyPointCompute';

type FundDetailItem = Record<string, string | number>;

/**
 * 拉取基金累计收益率序列，统一整理为买点 Worker 所需的入参
 */
const fetchFundReturnSeries = async (fundCode: string): Promise<BuyPointFundItem[]> => {
  const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
    params: {
      symbol: fundCode,
      indicator: '累计收益率走势',
      period: '成立来',
    },
  });

  const detailData = (response?.data ?? []) as FundDetailItem[];
  const series = detailData
    .map(item => ({
      日期: String(item['日期']),
      累计收益率: Number(item['累计收益率']),
    }))
    .filter(item => item.日期 && Number.isFinite(item.累计收益率));

  // 接口异常（空数据 / 无有效累计收益率）需抛出，由批量编排统一重试并汇总提示
  if (series.length === 0) throw new Error('接口返回空数据');
  return series;
};

/**
 * 计算单只基金的推荐买点日期（定量策略）
 * 规则：基于「累计收益率走势」生成月/季 K 线，分别计算 RSI6，
 * 取推荐等级为 5/3/1 的日期；返回逗号分隔的日期字符串（无买点返回 ''）
 */
export const fetchFundRecommendationPoints = async (fundCode: string): Promise<string> => {
  try {
    const rawData = await fetchFundReturnSeries(fundCode);
    const { quantitative } = await computeBuyPoints({ type: 'fund', rawData });
    return quantitative;
  } catch (error) {
    console.log('Error fetching fund detail:', error);
    return '';
  }
};

/**
 * 同时计算单只基金的「定量」「百分位」「月RSI6百分位策略」三种推荐买点日期
 * - 定量：固定 RSI6 阈值（月/季 RSI6 ≤ 阈值）
 * - 百分位：月/季 RSI6 同时跌破「截至当月、近 10 年」的 as-of 滚动分位（★5=3% / ★3=5% / ★1=10%，满 60 个月生效；历史不足 10 年时用全部历史）
 * - 月RSI6百分位策略：月RSI6 单周期，跌破「截至当月、近 10 年」的 as-of 滚动 3% 分位建仓（取每笔配对的第一次买入日期，满 60 个月生效）
 * 返回逗号分隔的日期字符串
 */
export const fetchFundRecommendationPointsBoth = async (
  fundCode: string,
): Promise<BuyPointResult> => {
  // 取数/计算异常不在此吞掉，交由批量编排统一重试并汇总提示
  const rawData = await fetchFundReturnSeries(fundCode);
  return computeBuyPoints({ type: 'fund', rawData });
};
