import apiClient from './axios';
import { computeBuyPoints } from './buyPointWorker';
import type { BuyPointFundItem } from './buyPointCompute';

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
  return detailData.map((item) => ({
    日期: String(item['日期']),
    累计收益率: Number(item['累计收益率']),
  }));
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
    const rawData = await fetchFundReturnSeries(fundCode);
    const { quantitative, percentile, monthlyPercentile } = await computeBuyPoints({
      type: 'fund',
      rawData,
    });
    return { quantitative, percentile, monthlyPercentile };
  } catch (error) {
    console.log('Error fetching fund recommendation points:', error);
    return { quantitative: '', percentile: '', monthlyPercentile: '' };
  }
};
