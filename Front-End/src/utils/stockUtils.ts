import moment from 'moment';
import { isNumber } from 'lodash-es'

export const calculateMaxDrawdown = <T extends Record<string, unknown>>(
  params: {
    data: T[];
    leftKey?: string;
    dateKey?: string;
    percentKey?: string;
    /** 收盘值语义：cumulativeReturn=累计收益率(可为负、起点通常为0)；默认按 leftKey 是否为「累计收益率」推断 */
    closeValueType?: CloseValueType;
  }
): (T & { __最大回撤率__: number; __年化收益率__: number | null })[] => {
  const { data, leftKey = '', dateKey = '', percentKey, closeValueType } = params;
  if (!data || data.length === 0) {
    return [];
  }

  // 是否按「累计收益率」口径计算（显式参数优先，未传时沿用字段名推断，兼容旧调用方）
  const isCumulativeReturn =
    closeValueType === 'cumulativeReturn' || (closeValueType == null && leftKey === '累计收益率');

  let maxClose = 0;
  const firstClose = data[0][leftKey] as number;
  const firstDate = data[0][dateKey] as string;

  const values = percentKey && data
    ?.map(item => item[percentKey] as number)
    ?.filter(value => typeof value === 'number' && !isNaN(value))
    ?.sort((a, b) => a - b);


  // 计算15%和85%百分位
  const percentile15 = values?.[Math.floor(values.length * 0.15)];
  const percentile85 = values?.[Math.floor(values.length * 0.85)];

  return data.map(item => {
    const closePrice = item[leftKey] as number;
    const currentDate = item[dateKey] as string;

    if (closePrice > maxClose) {
      maxClose = closePrice;
    }

    let drawdown: number | null = null;
    if (isCumulativeReturn) {
      drawdown = ((maxClose + 100) - (closePrice + 100)) / (maxClose + 100);
    } else {
      drawdown = (maxClose - closePrice) / maxClose;
    }
    const drawdownPercent = parseFloat((drawdown * 100).toFixed(2));

    const days = moment(currentDate, 'YYYYMMDD').diff(moment(firstDate, 'YYYYMMDD'), 'days');
    let annualizedRate: number | null = null;
    if (days > 365) {
      if (isCumulativeReturn) {
        // 总收益：上市以来，2009年12月～2026年2月，累计收益率：177.36%
        // 前段收益：2009年12月～2023年2月，累计收益率：118.46%
        // 后段收益：最近3年，2023年2月～2026年2月，累计收益率：26.97%
        // 求总收益：总收益率 + 1 = (1 + 前段收益率) * (1 + 后段收益率)
        // 求前段收益（已知总和后段）：前段收益率 = (1 + 总收益率) / (1 + 后段收益率) - 1
        // 求后段收益（已知总和前段）：后段收益率 = (1 + 总收益率) / (1 + 前段收益率) - 1
        annualizedRate = parseFloat((Math.pow((100 + closePrice) / (100 + firstClose), 365 / days) - 1).toFixed(4));
      } else {
        annualizedRate = parseFloat((Math.pow(closePrice / firstClose, 365 / days) - 1).toFixed(4));
      }
    }

    return {
      ...item,
      ['__最大回撤率__']: -drawdownPercent,
      ['__年化收益率__']: annualizedRate !== null ? Number((annualizedRate * 100).toFixed(2)) : null,
      [`__${percentKey}15%百分位__`]: percentile15 !== null ? Number(percentile15?.toFixed(2)) : null,
      [`__${percentKey}85%百分位__`]: percentile85 !== null ? Number(percentile85?.toFixed(2)) : null,
    };
  });
};

export const calculateStartDate = (
  publishDate: string,
  timeRange: string = '10年'
): string => {
  if (!publishDate) {
    return '';
  }

  const currentMoment = moment();
  let startDate = '';

  if (timeRange === '上市以来') {
    startDate = moment(publishDate).format('YYYYMMDD');
  } else {
    // 尝试从timeRange中提取年数
    const yearMatch = timeRange.match(/^(\d+)年$/);
    if (yearMatch) {
      const years = parseInt(yearMatch[1], 10);
      startDate = currentMoment.subtract(years, 'years').format('YYYYMMDD');
    } else {
      startDate = moment(publishDate).format('YYYYMMDD');
    }
  }

  if (startDate && startDate < publishDate) {
    startDate = publishDate;
  }

  return startDate;
};

export const calculatePercentiles = (
  data: { [key: string]: number }[],
  percentKey: string
): { percentile15: number | null; percentile85: number | null } => {
  if (!data || data.length === 0) {
    return { percentile15: null, percentile85: null };
  }

  // 提取指定字段的值并排序
  const values = data
    .map(item => item[percentKey] as number)
    .filter(value => typeof value === 'number' && !isNaN(value))
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return { percentile15: null, percentile85: null };
  }

  // 计算15%和85%百分位
  const percentile15 = values[Math.floor(values.length * 0.15)];
  const percentile85 = values[Math.floor(values.length * 0.85)];

  // 为每条数据添加百分位信息
  return {
    percentile15,
    percentile85,
  };
};

// 计算当前Period 的 RSI指标
export const calculateRSI = (
  params: {
    data: KLineData[];
    closeKey?: string;
    period?: number;
  }
): (KLineData & { __RSI6__: number })[] => {
  const { data, closeKey = '收盘', period = 6 } = params;
  if (!data || data.length < period + 1) {
    return [];
  }

  // 计算每日涨幅和跌幅
  const gains = [];
  const losses = [];

  for (let i = 1; i < data.length; i++) {
    const currentClose = data[i][closeKey] as number;
    const previousClose = data[i - 1][closeKey] as number;
    const change = currentClose - previousClose;
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  // 计算RSI
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      // 前period个数据点，RSI设为50
      result.push({ ...data[i], __RSI6__: 50 });
    } else if (i === period) {
      // 初始6日：使用简单平均
      let totalGain = 0;
      let totalLoss = 0;
      for (let j = 0; j < period; j++) {
        totalGain += gains[j];
        totalLoss += losses[j];
      }
      avgGain = totalGain / period;
      avgLoss = totalLoss / period;

      // 计算RS和RSI
      let rsi = 50;
      if (avgGain > 0 && avgLoss === 0) {
        rsi = 100;
      } else if (avgLoss > 0 && avgGain === 0) {
        rsi = 0;
      } else if (avgLoss !== 0) {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
      rsi = Math.max(0, Math.min(100, rsi));

      result.push({
        ...data[i],
        __RSI6__: parseFloat(rsi.toFixed(2))
      });
    } else {
      // 后续每日：使用EMA平滑递推
      // EMA公式：AvgUpt = (AvgUpt-1 × (period-1) + ΔPt) / period
      const currentGain = gains[i - 1];
      const currentLoss = losses[i - 1];

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      // 计算RS和RSI
      let rsi = 50;
      if (avgGain > 0 && avgLoss === 0) {
        rsi = 100;
      } else if (avgLoss > 0 && avgGain === 0) {
        rsi = 0;
      } else if (avgLoss !== 0) {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
      rsi = Math.max(0, Math.min(100, rsi));

      result.push({
        ...data[i],
        __RSI6__: parseFloat(rsi.toFixed(2))
      });
    }
  }

  return result;
};

export const calculateMACD = (
  params: {
    data: KLineData[];
    closeKey?: string;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
  }
): (KLineData & { __MACD_DIF__: number; __MACD_DEA__: number; __MACD_BAR__: number })[] => {
  const { data, closeKey = '收盘', fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params;

  // 确保返回与输入等长的数组
  if (!data || data.length === 0) {
    return [];
  }

  // 计算EMA
  const calculateEMA = (values: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // 第一个EMA值使用简单平均
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < period; i++) {
      if (i < values.length) {
        const value = values[i];
        if (!isNaN(value)) {
          sum += value;
          validCount++;
        }
      }
    }

    if (validCount === 0) {
      // 没有有效数据，返回与输入等长的0数组
      return values.map(() => 0);
    }

    let currentEMA = sum / validCount;
    ema.push(currentEMA);

    // 后续EMA值使用递推公式
    for (let i = period; i < values.length; i++) {
      const value = values[i];
      if (!isNaN(value)) {
        currentEMA = (value - currentEMA) * multiplier + currentEMA;
      }
      ema.push(currentEMA);
    }

    return ema;
  };

  // 提取收盘价数据
  const closePrices = data.map(item => {
    const value = item[closeKey] as number;
    return isNaN(value) ? 0 : value;
  });

  // 计算快速EMA（12日）和慢速EMA（26日）
  const fastEMA = calculateEMA(closePrices, fastPeriod);
  const slowEMA = calculateEMA(closePrices, slowPeriod);

  // 计算DIF（快线）：快速EMA - 慢速EMA
  const dif: number[] = [];
  const maxLength = Math.min(fastEMA.length, slowEMA.length);
  for (let i = 0; i < maxLength; i++) {
    const difValue = fastEMA[i] - slowEMA[i];
    dif.push(isNaN(difValue) ? 0 : difValue);
  }

  // 计算DEA（慢线）：DIF的9日EMA
  const dea = calculateEMA(dif, signalPeriod);

  // 计算MACD柱：(DIF - DEA) * 2
  const result = data.map((item, index) => {
    let difValue = 0;
    let deaValue = 0;
    let barValue = 0;

    // 计算DIF值
    if (index >= slowPeriod - 1 && index - (slowPeriod - 1) < dif.length) {
      difValue = dif[index - (slowPeriod - 1)];
    }

    // 计算DEA和MACD柱值
    if (index >= slowPeriod + signalPeriod - 2 && index - (slowPeriod + signalPeriod - 2) < dea.length) {
      deaValue = dea[index - (slowPeriod + signalPeriod - 2)];
      barValue = (difValue - deaValue) * 2;
    }

    return {
      ...item,
      __MACD_DIF__: parseFloat(difValue.toFixed(4)),
      __MACD_DEA__: parseFloat(deaValue.toFixed(4)),
      __MACD_BAR__: parseFloat(barValue.toFixed(4))
    };
  });

  return result;
};

// K线数据类型
export interface KLineData {
  日期: string; // 日期:必传
  收盘: number; // 收盘:必传
  股票代码?: string;
  开盘?: number;
  最高?: number;
  最低?: number;
  成交量?: number;
  成交额?: number;
  振幅?: number;
  涨跌幅?: number;
  涨跌额?: number;
  换手率?: number;
}

// 周期类型
export type KLinePeriod = 'weekly' | 'monthly' | 'quarterly';

// 聚合日K数据为指定周期的K线数据；日K -> 周K/月K/季K
export const aggregateKLineByPeriod = (params: {
  dailyData: KLineData[];
  period: KLinePeriod;
}): KLineData[] => {
  const { dailyData, period } = params;

  if (!dailyData || dailyData.length === 0) {
    return [];
  }

  // 按指定周期分组
  const groups: { [key: string]: KLineData[] } = {};

  dailyData.forEach(item => {
    const date = moment(item.日期);
    const year = date.year();
    let key: string;

    switch (period) {
      case 'weekly':
        const week = date.week(); // 周数
        key = `${year}-W${week}`;
        break;
      case 'monthly':
        const month = date.month() + 1; // 月份从1开始
        key = `${year}-M${month}`;
        break;
      case 'quarterly':
        const monthQ = date.month() + 1; // 月份从1开始
        const quarter = Math.floor((monthQ - 1) / 3) + 1; // 季度
        key = `${year}-Q${quarter}`;
        break;
      default:
        key = '';
    }

    if (key) {
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
  });

  // 处理每个周期的K线
  const kLineData: KLineData[] = [];

  Object.values(groups).forEach(group => {
    if (group.length === 0) return;

    // 按日期排序
    group.sort((a, b) => new Date(a.日期).getTime() - new Date(b.日期).getTime());

    // 计算K线数据
    const firstDay = group[0];
    const lastDay = group[group.length - 1];

    const highPrices = group.map(item => item.最高);
    const lowPrices = group.map(item => item.最低);
    const volumes = group.map(item => item.成交量);
    const amounts = group.map(item => item.成交额);

    const kLine: KLineData = {
      日期: lastDay.日期,
      股票代码: firstDay.股票代码,
      开盘: firstDay.开盘,
      收盘: lastDay.收盘,
      最高: Math.max(...highPrices),
      最低: Math.min(...lowPrices),
      成交量: volumes.reduce((sum, vol) => sum + vol, 0),
      成交额: amounts.reduce((sum, amt) => sum + amt, 0)
    };

    kLineData.push(kLine);
  });

  // 按日期排序
  kLineData.sort((a, b) => new Date(a.日期).getTime() - new Date(b.日期).getTime());

  return kLineData;
};

// 计算日K数据的RSI6值
export const calculateDailyRSI6 = (dailyData: KLineData[]) => {
  return calculateRSI({ data: dailyData, closeKey: '收盘', period: 6 });
}

// 计算周K数据的RSI6值
export const calculateWeeklyRSI6 = (dailyData: KLineData[]) => {
  // 聚合日K数据为周K数据
  const weeklyData = aggregateKLineByPeriod({ dailyData, period: 'weekly' });
  return calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
}

// 计算月K数据的RSI6值
export const calculateMonthlyRSI6 = (dailyData: KLineData[]) => {
  // 聚合日K数据为月K数据
  const monthlyData = aggregateKLineByPeriod({ dailyData, period: 'monthly' });
  return calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
}

// 计算季K数据的RSI6值
export const calculateQuarterlyRSI6 = (dailyData: KLineData[]) => {
  // 聚合日K数据为季K数据
  const quarterlyData = aggregateKLineByPeriod({ dailyData, period: 'quarterly' });
  return calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });
}

// 计算周期（日、周、月、季）K线的RSI6值
export const calculatePeriodRSI = (dailyData: KLineData[]) => ({
  dailyRSI: calculateDailyRSI6(dailyData),
  weeklyRSI: calculateWeeklyRSI6(dailyData),
  monthlyRSI: calculateMonthlyRSI6(dailyData),
  quarterlyRSI: calculateQuarterlyRSI6(dailyData),
})

// 辅助函数：构建周期RSI映射
// export const buildRSIMap = (rsiData: any[], period: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
//   const map: Record<string, number> = {};

//   if (rsiData.length === 0) {
//     return map;
//   }

//   // 按日期排序
//   const sortedData = [...rsiData].sort((a, b) => a.日期.localeCompare(b.日期));

//   sortedData.forEach(item => {
//     const date = moment(item.日期, 'YYYYMMDD');
//     const rsi = item.__RSI6__;

//     let start: moment.Moment;
//     let end: moment.Moment;

//     switch (period) {
//       case 'daily':
//         map[item.日期] = rsi;
//         return;
//       case 'weekly':
//         start = date.clone().startOf('isoWeek');
//         end = date.clone().endOf('isoWeek');
//         break;
//       case 'monthly':
//         start = date.clone().startOf('month');
//         end = date.clone().endOf('month');
//         break;
//       case 'quarterly':
//         start = date.clone().startOf('quarter');
//         end = date.clone().endOf('quarter');
//         break;
//     }

//     // 填充周期内的每一天
//     const current = start!.clone();
//     while (current.isSameOrBefore(end!)) {
//       map[current.format('YYYYMMDD')] = rsi;
//       current.add(1, 'day');
//     }
//   });

//   return map;
// };

// RSI 值映射类型
// interface RSIValueMaps {
//   daily: Record<string, number>;
//   weekly: Record<string, number>;
//   monthly: Record<string, number>;
//   quarterly: Record<string, number>;
// }

// 在 RSI 映射中查找最近 N 天的值
// const findRSIValue = (date: string, rsiMap: Record<string, number>, maxDays: number): number | undefined => {
//   if (rsiMap[date] !== undefined) return rsiMap[date];

//   const dateMoment = moment(date, 'YYYYMMDD');
//   for (let i = 1; i <= maxDays; i++) {
//     const prev = dateMoment.clone().subtract(i, 'day').format('YYYYMMDD');
//     const next = dateMoment.clone().add(i, 'day').format('YYYYMMDD');
//     if (rsiMap[prev] !== undefined) return rsiMap[prev];
//     if (rsiMap[next] !== undefined) return rsiMap[next];
//   }
//   return undefined;
// };

// 获取指定日期各周期的 RSI 值（带回退查找）
// export const getRSIValues11 = (date: string, maps: RSIValueMaps) => ({
//   daily: findRSIValue(date, maps.daily, 1),
//   weekly: findRSIValue(date, maps.weekly, 7),
//   monthly: findRSIValue(date, maps.monthly, 31),
//   quarterly: findRSIValue(date, maps.quarterly, 92),
// });





// RSI 推荐级别规则：单一条件（某周期 RSI6 ≤ 阈值）
export interface RsiThresholdCondition {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  threshold: number;
}

// 某一星级的一组条件：组内为「且」，多组之间为「或」
export type RsiLevelRule = RsiThresholdCondition[][];

// RSI 推荐级别规则表：星级（5/3/1）→ 条件组
export type RsiRecommendationRules = Record<number, RsiLevelRule>;

// 周期 RSI 中文名（用于规则文案与条件取值）
export const rsiPeriodLabelMap: Record<RsiThresholdCondition['period'], string> = {
  daily: '日RSI6',
  weekly: '周RSI6',
  monthly: '月RSI6',
  quarterly: '季RSI6',
};

// 个股 RSI6 推荐级别规则
export const stockRsiRecommendationRules: RsiRecommendationRules = {
  5: [
    [
      { period: 'daily', threshold: 14 },
      { period: 'weekly', threshold: 18 },
      { period: 'monthly', threshold: 22 },
      { period: 'quarterly', threshold: 25 },
    ],
  ],
  3: [
    [
      { period: 'daily', threshold: 9 },
      { period: 'weekly', threshold: 12 },
      { period: 'monthly', threshold: 15 },
    ],
  ],
  1: [
    [
      { period: 'daily', threshold: 15 },
      { period: 'weekly', threshold: 17 },
      { period: 'monthly', threshold: 19 },
    ],
    [
      { period: 'daily', threshold: 9 },
      { period: 'weekly', threshold: 12 },
    ],
  ],
};

// 指数 RSI6 推荐级别规则
export const indexRsiRecommendationRules: RsiRecommendationRules = {
  5: [
    [
      { period: 'monthly', threshold: 10 },
      { period: 'quarterly', threshold: 15 },
    ],
    [
      { period: 'monthly', threshold: 13 },
      { period: 'quarterly', threshold: 13 },
    ],
    [
      { period: 'monthly', threshold: 15 },
      { period: 'quarterly', threshold: 10 },
    ],
  ],
  3: [
    [
      { period: 'monthly', threshold: 15 },
      { period: 'quarterly', threshold: 20 },
    ],
    [
      { period: 'monthly', threshold: 18 },
      { period: 'quarterly', threshold: 18 },
    ],
    [
      { period: 'monthly', threshold: 20 },
      { period: 'quarterly', threshold: 15 },
    ],
  ],
  1: [
    [
      { period: 'monthly', threshold: 25 },
      { period: 'quarterly', threshold: 25 },
    ],
  ],
};

// 基金 RSI6 推荐级别规则（与指数相同口径：仅月/季 RSI6 综合打分）
export const fundRsiRecommendationRules: RsiRecommendationRules = {
  5: [
    [
      { period: 'monthly', threshold: 10 },
      { period: 'quarterly', threshold: 15 },
    ],
    [
      { period: 'monthly', threshold: 13 },
      { period: 'quarterly', threshold: 13 },
    ],
    [
      { period: 'monthly', threshold: 15 },
      { period: 'quarterly', threshold: 10 },
    ],
  ],
  3: [
    [
      { period: 'monthly', threshold: 15 },
      { period: 'quarterly', threshold: 20 },
    ],
    [
      { period: 'monthly', threshold: 18 },
      { period: 'quarterly', threshold: 18 },
    ],
    [
      { period: 'monthly', threshold: 20 },
      { period: 'quarterly', threshold: 15 },
    ],
  ],
  1: [
    [
      { period: 'monthly', threshold: 25 },
      { period: 'quarterly', threshold: 25 },
    ],
  ],
};

// 大商品 RSI6 推荐级别规则
export const commodityRsiRecommendationRules: RsiRecommendationRules = {
  5: [
    [
      { period: 'daily', threshold: 14 },
      { period: 'weekly', threshold: 18 },
      { period: 'monthly', threshold: 22 },
      { period: 'quarterly', threshold: 25 },
    ],
  ],
  3: [
    [
      { period: 'daily', threshold: 9 },
      { period: 'weekly', threshold: 12 },
      { period: 'monthly', threshold: 15 },
    ],
  ],
  1: [
    [
      { period: 'daily', threshold: 15 },
      { period: 'weekly', threshold: 17 },
      { period: 'monthly', threshold: 19 },
    ],
    [
      { period: 'daily', threshold: 9 },
      { period: 'weekly', threshold: 12 },
    ],
  ],
};

// 根据规则表计算 RSI6 推荐级别
const calculateRecommendationLevelByRules = (
  rules: RsiRecommendationRules,
  dailyRSIValue?: number,
  weeklyRSIValue?: number,
  monthlyRSIValue?: number,
  quarterlyRSIValue?: number,
) => {
  const periodValueMap: Record<RsiThresholdCondition['period'], number | undefined> = {
    daily: dailyRSIValue,
    weekly: weeklyRSIValue,
    monthly: monthlyRSIValue,
    quarterly: quarterlyRSIValue,
  };

  // 星级从高到低匹配：5 → 3 → 1
  for (const level of [5, 3, 1]) {
    const groups = rules[level];
    if (!groups) continue;
    // 任一条件组全部命中即达标（组内「且」，组间「或」）
    const hit = groups.some((group) =>
      group.every(({ period, threshold }) => {
        const value = periodValueMap[period];
        return typeof value === 'number' && value <= threshold;
      }),
    );
    if (hit) return level;
  }
  return null;
};

// 计算RSI6推荐级别(个股)
const calculateStockRecommendationLevel = (dailyRSIValue?: number, weeklyRSIValue?: number, monthlyRSIValue?: number, quarterlyRSIValue?: number) =>
  calculateRecommendationLevelByRules(
    stockRsiRecommendationRules,
    dailyRSIValue,
    weeklyRSIValue,
    monthlyRSIValue,
    quarterlyRSIValue,
  );

// 计算RSI6推荐级别(大宗商品) - 口径与个股一致
const calculateCommodityRecommendationLevel = (dailyRSIValue?: number, weeklyRSIValue?: number, monthlyRSIValue?: number, quarterlyRSIValue?: number) =>
  calculateRecommendationLevelByRules(
    commodityRsiRecommendationRules,
    dailyRSIValue,
    weeklyRSIValue,
    monthlyRSIValue,
    quarterlyRSIValue,
  );

// 计算RSI6推荐级别(指数)
export const calculateIndexRecommendationLevel = (dailyRSIValue?: number, weeklyRSIValue?: number, monthlyRSIValue?: number, quarterlyRSIValue?: number) =>
  calculateRecommendationLevelByRules(
    indexRsiRecommendationRules,
    dailyRSIValue,
    weeklyRSIValue,
    monthlyRSIValue,
    quarterlyRSIValue,
  );

// 计算RSI6推荐级别(基金) - 仅按月度/季度 RSI6 综合打分
export const calculateFundRecommendationLevel = (dailyRSIValue?: number, weeklyRSIValue?: number, monthlyRSIValue?: number, quarterlyRSIValue?: number) =>
  calculateRecommendationLevelByRules(
    fundRsiRecommendationRules,
    dailyRSIValue,
    weeklyRSIValue,
    monthlyRSIValue,
    quarterlyRSIValue,
  );

// 标的类型 -> RSI6 推荐级别计算方法 的映射（新增类型在此登记即可）
const recommendationLevelCalculatorMap: Record<
  'stock' | 'index' | 'fund' | 'commodity',
  typeof calculateStockRecommendationLevel
> = {
  stock: calculateStockRecommendationLevel,
  index: calculateIndexRecommendationLevel,
  fund: calculateFundRecommendationLevel,
  commodity: calculateCommodityRecommendationLevel,
};


// 计算分位数
export const calculatePercentile = (data: number[], percentile: number): number => {
  if (data.length === 0) return 0;
  const sortedData = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sortedData.length) - 1;
  return sortedData[Math.max(0, index)];
};

/**
 * 计算年化收益率（复利口径，365 个自然日/年）
 * @param returnPct 区间收益率（百分数，如 12.5 表示 12.5%）
 * @param holdingDays 持有天数（自然日，含非交易日）
 * @returns 年化收益率（百分数）；持仓 0 天或参数非法时返回 null
 */
export const calculateAnnualizedReturn = (
  returnPct: number | null | undefined,
  holdingDays: number | null | undefined,
): number | null => {
  if (returnPct == null || !Number.isFinite(returnPct)) return null;
  if (!holdingDays || holdingDays <= 0 || !Number.isFinite(holdingDays)) return null;
  const growth = 1 + returnPct / 100;
  // 亏损超过 -100% 时本金已为负，复利年化无意义
  if (growth <= 0) return null;
  return Number((((Math.pow(growth, 365 / holdingDays)) - 1) * 100).toFixed(2));
};

// 在周期 RSI 映射中查找匹配给定日期的值
const findMatchingPeriodRSI = (
  rsiMap: Map<string, number>,
  matchFn: (date: moment.Moment) => boolean,
): number => {
  for (const [date, rsi] of rsiMap.entries()) {
    if (matchFn(moment(date))) {
      return rsi;
    }
  }
  return 100; // 默认为 100，不满足条件
};

// 获取日期的各周期（日/周/月/季）RSI值
export const getPeriodRSIValues = (
  dailyRSIData: KLineData, // 日K数据
  weeklyRSIMap: Map<string, number>, // 周K RSI map映射
  monthlyRSIMap: Map<string, number>, // 月K RSI map映射
  quarterlyRSIMap: Map<string, number>, // 季K RSI map映射
) => {
  const dayDate = moment(dailyRSIData.日期);
  const dailyRSIValue = dailyRSIData['__RSI6__'];

  const weeklyRSIValue = findMatchingPeriodRSI(weeklyRSIMap, weekDate =>
    weekDate.year() === dayDate.year() && weekDate.week() === dayDate.week(),
  );

  const monthlyRSIValue = findMatchingPeriodRSI(monthlyRSIMap, monthDate =>
    monthDate.year() === dayDate.year() && monthDate.month() === dayDate.month(),
  );

  const quarter = Math.floor((dayDate.month()) / 3) + 1;
  const quarterlyRSIValue = findMatchingPeriodRSI(quarterlyRSIMap, quarterDate =>
    quarterDate.year() === dayDate.year() && Math.floor((quarterDate.month()) / 3) + 1 === quarter,
  );

  return { dailyRSIValue, weeklyRSIValue, monthlyRSIValue, quarterlyRSIValue };
};

// 映射日K数据：日期、收盘、日/周/月/季RSI6值、推荐级别
export const computeRSIRecommendations = (params: {
  dailyRSI: KLineData[];
  weeklyRSI: KLineData[];
  monthlyRSI: KLineData[];
  quarterlyRSI: KLineData[];
}, type: 'stock' | 'index' | 'fund' | 'commodity' = 'stock'): (KLineData & { __recommendationLevel__: number })[] => {
  const { dailyRSI, weeklyRSI, monthlyRSI, quarterlyRSI } = params;

  if (!dailyRSI || dailyRSI.length === 0) {
    return [];
  }
  // 构建周期数据的映射，键为日期，值为对应的RSI6
  const weeklyRSIMap = new Map(weeklyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));
  const monthlyRSIMap = new Map(monthlyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));
  const quarterlyRSIMap = new Map(quarterlyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));

  // 过滤日K数据并计算推荐级别
  const aaa =  dailyRSI.map(dailyRSIData => {
    const rsiValues = getPeriodRSIValues(dailyRSIData, weeklyRSIMap, monthlyRSIMap, quarterlyRSIMap);
    const calculateFunc = recommendationLevelCalculatorMap[type];
    const __recommendationLevel__ = calculateFunc(
      rsiValues.dailyRSIValue,
      rsiValues.weeklyRSIValue,
      rsiValues.monthlyRSIValue,
      rsiValues.quarterlyRSIValue
    );
    return {
      日期: dailyRSIData.日期,
      收盘: dailyRSIData.收盘,
      __daily__RSI6__: rsiValues.dailyRSIValue ?? null,
      __weekly__RSI6__: rsiValues.weeklyRSIValue ?? null,
      __monthly__RSI6__: rsiValues.monthlyRSIValue ?? null,
      __quarterly__RSI6__: rsiValues.quarterlyRSIValue ?? null,
      __recommendationLevel__: __recommendationLevel__ ?? null,
    };
  })
  return aaa
};

// 查找3连阳或以上且第1阳的换手率在过去5年10%低位的情况
export const findThreeConsecutiveRises = (params: {
  rawData: KLineData[];
}): { startIndex: number; data: KLineData[] }[] => {
  const { rawData } = params;

  if (!rawData || rawData.length < 3) {
    return [];
  }

  // 检查整个数据集的历史是否足够5年
  if (rawData.length >= 2) {
    const firstDate = moment(rawData[0].日期);
    const lastDate = moment(rawData[rawData.length - 1].日期);
    const yearsDiff = lastDate.diff(firstDate, 'years');
    if (yearsDiff < 5) {
      return [];
    }
  } else {
    return [];
  }

  const result: { startIndex: number; data: KLineData[] }[] = [];
  let i = 0;

  // 遍历查找连续阳线
  while (i <= rawData.length - 3) {
    let consecutiveRises = 0;
    let currentIndex = i;

    // 计算连续阳线的长度
    while (currentIndex < rawData.length && rawData[currentIndex].收盘 > rawData[currentIndex].开盘) {
      consecutiveRises++;
      currentIndex++;
    }

    // 检查是否有3连阳或以上
    if (consecutiveRises >= 3) {
      const day1 = rawData[i];

      // 计算第1阳的日期
      const firstRiseDate = moment(day1.日期);

      // 检查第1阳的日期之前是否有至少5年的历史数据
      const dataStartDate = moment(rawData[0].日期);
      const yearsSinceStart = firstRiseDate.diff(dataStartDate, 'years');
      if (yearsSinceStart < 5) {
        // 第1阳的日期之前历史数据不足5年，跳过
        i = currentIndex;
        continue;
      }

      // 计算过去5年的开始日期
      const fiveYearsAgo = firstRiseDate.clone().subtract(5, 'years');

      // 提取过去5年的换手率数据
      const pastFiveYearsData = rawData.filter(item => {
        const itemDate = moment(item.日期);
        return itemDate.isAfter(fiveYearsAgo) && itemDate.isBefore(firstRiseDate) && item.换手率 !== undefined;
      });

      const turnoverRates = pastFiveYearsData.map(item => item.换手率!).filter(rate => !isNaN(rate));

      if (turnoverRates.length > 0) {
        // 计算5%分位数
        turnoverRates.sort((a, b) => a - b);
        const percentile05Index = Math.floor(turnoverRates.length * 0.05);
        const percentile05 = turnoverRates[percentile05Index];

        // 检查第1、2、3阳的换手率是否都小于等于5%分位数
        const day1 = rawData[i];
        const day2 = rawData[i + 1];
        const day3 = rawData[i + 2];

        if (day1.换手率 !== undefined && day2.换手率 !== undefined && day3.换手率 !== undefined &&
          day1.换手率 <= percentile05 && day2.换手率 <= percentile05 && day3.换手率 <= percentile05) {
          // 提取连续阳线的数据
          const consecutiveData = rawData.slice(i, i + consecutiveRises);
          result.push({
            startIndex: i,
            data: consecutiveData
          });
        }
      }

      // 跳过已经处理过的连续阳线
      i = currentIndex;
    } else {
      // 移动到下一个交易日
      i++;
    }
  }

  return result;
};

// 计算波动率（基于日增长率的标准差）
export const calculateVolatility = (params: {
  data: any[];
  navKey: string; // 净值字段名
  dateKey: string; // 日期字段名
  period?: number; // 滚动周期，默认20日
}): (any & { __波动率__: number })[] => {
  const { data, navKey, dateKey, period = 20 } = params;

  if (!data || data.length < period) {
    return data?.map(item => ({ ...item, __波动率__: 0 })) || [];
  }

  // 计算日增长率
  const dataWithGrowth = data.map((item, index) => {
    const currentItem = { ...item };

    if (index > 0) {
      const prevNav = Number(data[index - 1][navKey]);
      const currentNav = Number(currentItem[navKey]);
      if (prevNav > 0) {
        currentItem['__日增长率__'] = ((currentNav - prevNav) / prevNav) * 100;
      }
    }

    return currentItem;
  });

  // 计算滚动波动率（标准差）
  const result = dataWithGrowth.map((item, index) => {
    const currentItem = { ...item };

    if (index >= period - 1) { // 需要至少period个数据点
      const growthRates = [];
      for (let i = index - (period - 1); i <= index; i++) {
        if (dataWithGrowth[i]['__日增长率__'] !== undefined) {
          growthRates.push(dataWithGrowth[i]['__日增长率__']);
        }
      }

      if (growthRates.length > 0) {
        const mean = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
        const variance = growthRates.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / growthRates.length;
        currentItem['__波动率__'] = Math.sqrt(variance);
      } else {
        currentItem['__波动率__'] = 0;
      }
    } else {
      currentItem['__波动率__'] = 0;
    }

    return currentItem;
  });

  return result;
};

// 计算年化波动率
export const calculateAnnualizedVolatility = (volatility: number, tradingDaysPerYear: number = 252): number => {
  return volatility * Math.sqrt(tradingDaysPerYear);
};

// 推荐级别对应的标注样式（更大、更饱和；5星额外发光，在指数线上更醒目）
const ANNOTATION_STYLES: Record<
  number,
  { color: string; fontSize: number; stroke: string; lineWidth: number; shadowColor?: string; shadowBlur?: number }
> = {
  5: {
    color: '#00a800',
    fontSize: 16,
    stroke: '#ffffff',
    lineWidth: 1.5,
    shadowColor: 'rgba(0, 168, 0, 0.65)',
    shadowBlur: 8,
  },
  3: { color: '#3cbc3c', fontSize: 13, stroke: '#ffffff', lineWidth: 1.2 },
  1: { color: '#7ed957', fontSize: 11, stroke: '#ffffff', lineWidth: 1 },
};

// 生成推荐买点标注
export const createRecommendationAnnotations = <T extends { 日期: string; 收盘: number; __recommendationLevel__: number }>(
  items: T[],
) => items.map(item => {
  const style = ANNOTATION_STYLES[item.__recommendationLevel__] || ANNOTATION_STYLES[1];
  return {
    type: 'text' as const,
    data: [new Date(item.日期), item.收盘],
    style: {
      text: '●',
      fontSize: style.fontSize,
      dx: -(style.fontSize / 2),
      fill: style.color,
      // 白色描边让圆点在红绿走势线和网格上都有对比，强推荐额外外发光
      stroke: style.stroke,
      lineWidth: style.lineWidth,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
    },
  };
});

// ============================================================
// 月 & 季 RSI6 百分位策略（抽离自 RsiFilterMark，供基金/指数等场景复用）
// ============================================================

/**
 * 收盘价字段的语义类型：
 * - price：真实价格/指数（如股票收盘价、指数点位），恒为正
 * - cumulativeReturn：累计收益率（%，基金场景，可为负）
 * 两者的持有期收益率计算公式不同，必须区分
 */
export type CloseValueType = 'price' | 'cumulativeReturn';

/**
 * 计算持有期收益率（%）
 * - price 口径：((卖 - 买) / 买) * 100
 * - cumulativeReturn 口径：(((1 + 卖/100) / (1 + 买/100)) - 1) * 100
 *   （累计收益率是相对成立日的涨跌幅，需先还原为净值比再计算区间收益）
 * @param buyClose  买入时收盘值
 * @param sellClose 卖出时收盘值
 * @param closeValueType 收盘值语义，默认 price
 * @returns 收益率（%），保留两位小数；除零时返回 0
 */
export const calculateHoldingReturnRate = (
  buyClose: number,
  sellClose: number,
  closeValueType: CloseValueType = 'price',
): number => {
  if (closeValueType === 'cumulativeReturn') {
    const buyRatio = 1 + buyClose / 100;
    const sellRatio = 1 + sellClose / 100;
    if (buyRatio === 0) return 0;
    return Number((((sellRatio / buyRatio) - 1) * 100).toFixed(2));
  }
  if (buyClose === 0) return 0;
  return Number((((sellClose - buyClose) / buyClose) * 100).toFixed(2));
};

/** RSI 预热点数：calculateRSI 前 rsiWarmup 个点为固定值 50（无统计意义），计算分位时剔除 */
export const rsiWarmup = 6;

/** 月&季 RSI6 共振买入级别规则：星级 → 历史分位阈值（月/季 RSI6 均需低于此分位） */
export const MQ_LEVEL_RULES: { level: number; percentile: number }[] = [
  { level: 5, percentile: 3 },
  { level: 3, percentile: 5 },
  { level: 1, percentile: 10 },
];

/** 月RSI6 卖出分位：月RSI6 突破该历史分位时满足卖出条件之一 */
export const MONTHLY_RSI_SELL_PERCENTILE = 85;
/** 季RSI6 卖出分位：季RSI6 突破该历史分位时满足卖出条件之一 */
export const QUARTERLY_RSI_SELL_PERCENTILE = 85;

// ============================================================
// 单周期 RSI6 百分位策略（周 / 月，规则一致，仅周期与分位常量不同）
// ============================================================

/** 周RSI6 买入分位：周RSI6 触及（≤）该历史分位时建仓/加仓（可配置） */
export const WEEKLY_RSI_BUY_PERCENTILE = 1;
/** 周RSI6 卖出分位：周RSI6 触及（≥）该历史分位且收益率＞0 时卖出（可配置） */
export const WEEKLY_RSI_SELL_PERCENTILE = 90;
/** 月RSI6 买入分位：月RSI6 触及（≤）该历史分位时建仓/加仓（可配置） */
export const MONTHLY_RSI_PCT_BUY_PERCENTILE = 3;
/** 月RSI6 卖出分位：月RSI6 触及（≥）该历史分位且收益率＞0 时卖出（可配置） */
export const MONTHLY_RSI_PCT_SELL_PERCENTILE = 90;

/** 单周期百分位策略持仓期间的重复买入（加仓）记录（仅标记，不参与卖出收益配对） */
export interface SinglePeriodPercentileExtraBuy {
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
}

/** 单周期（周/月）RSI6 百分位策略买卖配对交易记录 */
export interface SinglePeriodPercentileTrade {
  /** 第一次买入日期（卖出时仅与该笔配对计算收益） */
  buyDate: string;
  buyRsi: number;
  buyPrice: number;
  sellDate: string | null;
  sellRsi: number | null;
  sellPrice: number | null;
  holdingDays: number | null;
  returnRate: number | null;
  annualizedReturn: number | null;
  status: '已平仓' | '持仓中';
  /** 持仓期间的重复买入（加仓）记录（不含第一次买入） */
  extraBuys: SinglePeriodPercentileExtraBuy[];
}

/** 单周期百分位策略入参（周/月策略共用） */
export interface SinglePeriodPercentileParams {
  rsiData: KLineData[];
  buyPercentile: number;
  sellPercentile: number;
  warmup?: number;
  closeValueType?: CloseValueType;
}

/** 单周期百分位买卖阈值（买入/卖出分位对应的 RSI6 值） */
export interface PercentileThresholdPair {
  buy: number;
  sell: number;
}

/**
 * 分析单周期（周/月）RSI6 百分位策略
 *
 * 一次计算同时产出「买卖阈值」与「交易配对」，供表格、阈值参考线、规则文案复用同一份结果，
 * 避免调用方各自重算分位阈值导致口径漂移。
 *
 * 口径：剔除前 warmup 个预热点 → 按历史分位计算买入/卖出阈值 →
 * 空仓触及（≤）买入分位建仓；持仓期间触及（≤）即加仓；触及（≥）卖出分位且相对首次买入盈利时卖出。
 *
 * @returns { threshold, trades }；有效数值为空时返回 { threshold: null, trades: [] }
 */
export const analyzeSinglePeriodPercentile = (
  params: SinglePeriodPercentileParams,
): { threshold: PercentileThresholdPair | null; trades: SinglePeriodPercentileTrade[] } => {
  const {
    rsiData,
    buyPercentile,
    sellPercentile,
    warmup = rsiWarmup,
    closeValueType = 'price',
  } = params;

  const arr = (rsiData as RsiKLineData[]).slice(warmup);
  const values = arr
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');

  if (!values.length) return { threshold: null, trades: [] };

  const buyThreshold = roundPercentile(values, buyPercentile);
  const sellThreshold = roundPercentile(values, sellPercentile);

  const trades: SinglePeriodPercentileTrade[] = [];
  let holding: {
    buyDate: string;
    buyRsi: number;
    buyPrice: number;
    buyTime: number;
    extraBuys: SinglePeriodPercentileExtraBuy[];
  } | null = null;

  for (const item of arr) {
    const rsi = item.__RSI6__;
    if (typeof rsi !== 'number') continue;

    if (!holding) {
      // 空仓期间 RSI6 触及（≤）买入分位时建仓
      if (rsi <= buyThreshold) {
        holding = {
          buyDate: item.日期,
          buyRsi: rsi,
          buyPrice: item.收盘,
          buyTime: new Date(item.日期).getTime(),
          extraBuys: [],
        };
      }
      continue;
    }

    // 持仓期间 RSI6 只要触及（≤）买入分位即重复买入（加仓）并标记
    if (rsi <= buyThreshold) {
      holding.extraBuys.push({
        buyDate: item.日期,
        buyRsi: rsi,
        buyPrice: item.收盘,
      });
    }

    // 卖出只与第一次买入配对；超买但未盈利则继续持有
    const returnRate = calculateHoldingReturnRate(holding.buyPrice, item.收盘, closeValueType);
    if (rsi >= sellThreshold && returnRate > 0) {
      const holdingDays = Math.max(
        1,
        Math.round((new Date(item.日期).getTime() - holding.buyTime) / (24 * 60 * 60 * 1000)),
      );
      const tradeReturnRate = Number(returnRate.toFixed(2));
      trades.push({
        buyDate: holding.buyDate,
        buyRsi: holding.buyRsi,
        buyPrice: Number(holding.buyPrice.toFixed(2)),
        sellDate: item.日期,
        sellRsi: rsi,
        sellPrice: Number(item.收盘.toFixed(2)),
        holdingDays,
        returnRate: tradeReturnRate,
        annualizedReturn:
          holdingDays >= 365 ? calculateAnnualizedReturn(tradeReturnRate, holdingDays) : null,
        status: '已平仓',
        extraBuys: holding.extraBuys,
      });
      holding = null;
    }
  }

  // 末尾未卖出：记为持仓中
  if (holding) {
    trades.push({
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
      extraBuys: holding.extraBuys,
    });
  }

  return { threshold: { buy: buyThreshold, sell: sellThreshold }, trades };
};

/**
 * 计算单周期（周/月）RSI6 百分位策略的交易配对（analyzeSinglePeriodPercentile 的薄包装）
 *
 * 仅需交易列表、不需要阈值的调用方（自选表格批量回填等）使用本方法；
 * 同时需要阈值的场景请直接调用 analyzeSinglePeriodPercentile，避免重复计算。
 */
export const computeSinglePeriodPercentileTrades = (
  params: SinglePeriodPercentileParams,
): SinglePeriodPercentileTrade[] => analyzeSinglePeriodPercentile(params).trades;

/** 月+季 RSI6 共振买点（月/季 RSI6 同时跌破历史分位，带推荐级别） */
export interface MonthlyQuarterlyPercentileBuyPoint {
  日期: string;
  收盘: number;
  monthlyRsi: number;
  quarterlyRsi: number;
  /** 推荐星级 1/3/5 */
  level: number;
  /** 卖出日期（★5买点与卖点按时间顺序配对，未配对的为空） */
  sellDate?: string;
  /** 卖出时点月RSI6 */
  sellMonthlyRsi?: number;
  /** 卖出时点季RSI6 */
  sellQuarterlyRsi?: number;
  /** 卖出价（卖出月收盘价） */
  sellPrice?: number;
  /** 持有天数（卖出月 - 买入月，至少1天） */
  holdingDays?: number;
  /** 收益率（%） */
  returnRate?: number;
  /** 年化收益率（%），calculateAnnualizedReturn 可能返回 null */
  annualizedReturn?: number | null;
}

/** 带 RSI6 字段的 K 线数据（calculateRSI 在原 K 线上追加 __RSI6__） */
type RsiKLineData = KLineData & { __RSI6__?: number | null };

/**
 * 计算指定分位值并保留两位小数（统一分位阈值的精度口径）
 * @param values 数值序列
 * @param p 分位数 0~100
 * @returns 两位小数的分位值
 */
export const roundPercentile = (values: number[], p: number): number =>
  Number(calculatePercentile(values, p).toFixed(2));

/**
 * 日期所在自然季度键 `${year}-Q${1~4}`：
 * 1～3 月 → Q1、4～6 月 → Q2、7～9 月 → Q3、10～12 月 → Q4（moment month 为 0-based）
 *
 * 月&季策略表格、季RSI6 vh 阶梯折线、tooltip 查表统一使用本函数，保证三方季度归属一致。
 */
export const getQuarterKey = (dateStr: string): string => {
  const d = moment(dateStr);
  return `${d.year()}-Q${Math.floor(d.month() / 3) + 1}`;
};

/** 月&季 RSI6 百分位策略入参 */
export interface MonthlyQuarterlyPercentileParams {
  monthlyRSI6Data: KLineData[];
  quarterlyRSI6Data: KLineData[];
  warmup?: number;
  /** 收盘值语义，决定收益率计算公式，默认 price */
  closeValueType?: CloseValueType;
}

/** 月&季 RSI6 百分位策略分析结果（阈值 + 卖点 + 买点，一次计算全部产出） */
export interface MonthlyQuarterlyPercentileResult {
  /** 各级别买入分位阈值：★5=3% / ★3=5% / ★1=10% */
  thresholds: Record<number, { monthly: number; quarterly: number }>;
  /** 卖出分位阈值（月/季分别可配置，默认 97%） */
  sellThresholds: { monthly: number; quarterly: number };
  /** 买点列表（含配对的卖出信息） */
  buyPoints: MonthlyQuarterlyPercentileBuyPoint[];
}

/**
 * 分析「月 & 季 RSI6 百分位策略」
 *
 * 策略口径：
 * - 买入：月RSI6 与 季RSI6 同时低于各自历史分位阈值，按分位严度分级（★5=3% / ★3=5% / ★1=10%）
 * - 季度对齐：每个月取其「所在自然季度」的季末 RSI6 ——
 *   1～3 月取 3 月最晚季末值、4～6 月取 6 月最晚、7～9 月取 9 月最晚、10～12 月取 12 月最晚，
 *   与季RSI6 vh（step-before）阶梯折线、shared tooltip 的季度查表完全同口径；
 *   仅当所在季度季末点尚不存在（当前未走完的季度）时，回退最近一个已完成季度
 * - 卖出：持仓中（★5买点）且 月RSI6 与 季RSI6 同时突破各自卖出分位阈值
 * - 仅 ★5 买点参与卖出配对，顺序配对 ★5买点 → 卖点 → ★5买点 → 卖点 ...
 *
 * @returns 阈值与买点；月/季有效数值任一为空时返回 null
 */
export const analyzeMonthlyQuarterlyPercentile = (
  params: MonthlyQuarterlyPercentileParams,
): MonthlyQuarterlyPercentileResult | null => {
  const { monthlyRSI6Data, quarterlyRSI6Data, warmup = rsiWarmup, closeValueType = 'price' } = params;

  const monthlyArr = (monthlyRSI6Data as RsiKLineData[]).slice(warmup);
  const quarterlyArr = (quarterlyRSI6Data as RsiKLineData[]).slice(warmup);

  const monthlyValues = monthlyArr
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');
  const quarterlyValues = quarterlyArr
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');

  if (!monthlyValues.length || !quarterlyValues.length) {
    return null;
  }

  // 按级别计算月/季 RSI6 买入分位阈值
  const thresholds: Record<number, { monthly: number; quarterly: number }> = {};
  for (const { level, percentile } of MQ_LEVEL_RULES) {
    thresholds[level] = {
      monthly: roundPercentile(monthlyValues, percentile),
      quarterly: roundPercentile(quarterlyValues, percentile),
    };
  }

  // 卖出分位阈值
  const sellThresholds = {
    monthly: roundPercentile(monthlyValues, MONTHLY_RSI_SELL_PERCENTILE),
    quarterly: roundPercentile(quarterlyValues, QUARTERLY_RSI_SELL_PERCENTILE),
  };

  // 季末点按「所在自然季度」建表（与季RSI6 vh 折线、tooltip 查表同口径），
  // 同一季度若存在多条则保留日期最晚的一条
  const quarterlyByKey = new Map<string, RsiKLineData>();
  for (const point of quarterlyArr) {
    const key = getQuarterKey(point.日期);
    const existed = quarterlyByKey.get(key);
    if (!existed || point.日期 > existed.日期) {
      quarterlyByKey.set(key, point);
    }
  }

  const buyPoints: MonthlyQuarterlyPercentileBuyPoint[] = [];

  // 持仓状态机：顺序配对 ★5买点 → 卖点 → ★5买点 → 卖点 ...
  let holdingFiveStarBuy: MonthlyQuarterlyPercentileBuyPoint | null = null;

  // 未完成季度回退用：最近一个 日期 <= 月日期 的已完成季度指针
  let qIdx = 0;
  for (const m of monthlyArr) {
    const monthlyRsi = m.__RSI6__;
    if (typeof monthlyRsi !== 'number') continue;

    // 所在自然季度的季末 RSI6：1～3 月取 3 月最晚、4～6 月取 6 月最晚……
    let currentQuarterly = quarterlyByKey.get(getQuarterKey(m.日期));
    if (!currentQuarterly) {
      // 所在季度季末点尚不存在（当前未走完的季度，或预热剔除后该季不可用）：
      // 回退到最近一个已完成季度
      while (
        qIdx + 1 < quarterlyArr.length &&
        quarterlyArr[qIdx + 1].日期 <= m.日期
      ) {
        qIdx += 1;
      }
      currentQuarterly = quarterlyArr[qIdx];
      // 守卫：不存在日期 <= 当前月的有效季度点时必须跳过，
      // 否则会把未来季度点错配给当前月，导致日期与 RSI 值错位
      if (!currentQuarterly || currentQuarterly.日期 > m.日期) continue;
    }
    const quarterlyRsi = currentQuarterly.__RSI6__;
    if (typeof quarterlyRsi !== 'number') continue;

    // 从高到低匹配，取命中的最高级别（买点判断，RSI6 触及分位阈值 ≤ 即算命中）
    const hitRule = MQ_LEVEL_RULES.find(
      ({ level }) =>
        monthlyRsi <= thresholds[level].monthly && quarterlyRsi <= thresholds[level].quarterly,
    );
    if (hitRule) {
      const buyPoint: MonthlyQuarterlyPercentileBuyPoint = {
        日期: m.日期,
        收盘: m.收盘,
        monthlyRsi,
        quarterlyRsi,
        level: hitRule.level,
      };
      buyPoints.push(buyPoint);

      // 仅★5买点参与卖出配对；持仓中（已有未平仓★5）时不再重复建仓
      if (hitRule.level === 5 && !holdingFiveStarBuy) {
        holdingFiveStarBuy = buyPoint;
      }
    }

    // 卖出判断：持仓中且月/季 RSI6 同时触及（≥）卖出分位阈值时平仓
    if (
      holdingFiveStarBuy &&
      monthlyRsi >= sellThresholds.monthly &&
      quarterlyRsi >= sellThresholds.quarterly
    ) {
      const buyTime = new Date(holdingFiveStarBuy.日期).getTime();
      const sellTime = new Date(m.日期).getTime();
      const holdingDays = Math.max(
        1,
        Math.round((sellTime - buyTime) / (24 * 60 * 60 * 1000)),
      );
      const returnRate = calculateHoldingReturnRate(
        holdingFiveStarBuy.收盘,
        m.收盘,
        closeValueType,
      );
      holdingFiveStarBuy.sellDate = m.日期;
      holdingFiveStarBuy.sellMonthlyRsi = monthlyRsi;
      holdingFiveStarBuy.sellQuarterlyRsi = quarterlyRsi;
      holdingFiveStarBuy.sellPrice = Number(m.收盘.toFixed(2));
      holdingFiveStarBuy.holdingDays = holdingDays;
      holdingFiveStarBuy.returnRate = returnRate;
      // 持有不足1年（365天）不计算年化收益率，展示为 --
      holdingFiveStarBuy.annualizedReturn =
        holdingDays >= 365 ? calculateAnnualizedReturn(returnRate, holdingDays) : null;
      // 平仓后等待下一个★5买点
      holdingFiveStarBuy = null;
    }
  }

  return { thresholds, sellThresholds, buyPoints };
};

/**
 * 计算「月 & 季 RSI6 百分位策略」的买点列表（analyzeMonthlyQuarterlyPercentile 的薄包装）
 *
 * 仅需买点列表、不需要阈值的调用方（自选表格批量回填等）使用本方法；
 * 同时需要阈值的场景请直接调用 analyzeMonthlyQuarterlyPercentile，避免重复计算。
 */
export const computeMonthlyQuarterlyPercentileBuyPoints = (
  params: MonthlyQuarterlyPercentileParams,
): MonthlyQuarterlyPercentileBuyPoint[] =>
  analyzeMonthlyQuarterlyPercentile(params)?.buyPoints ?? [];

// ============================================================
// 推荐买点展示相关配置
// ============================================================

/**
 * 近期买点高亮天数：距今天数在该值以内的买点日期会被特殊高亮，便于区分
 * 可配置，默认 100 天
 */
export const RECENT_BUY_POINT_DAYS = 100;

/**
 * 判断给定日期是否在「近期」（距今天数 <= days）
 * 按日历天比较（剥离时分秒），避免当天已过小时数导致边界偏差
 * @param dateStr 日期字符串（YYYY-MM-DD 或可被 Date 解析的格式）
 * @param days  近几天数，默认取 RECENT_BUY_POINT_DAYS
 * @returns 是否为近期日期
 */
export const isRecentDate = (
  dateStr: string | number | Date,
  days: number = RECENT_BUY_POINT_DAYS,
): boolean => {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = (now.getTime() - target.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays >= 0 && diffDays <= days;
};
