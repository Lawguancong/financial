import moment from 'moment';

export const calculateMaxDrawdown = <T extends Record<string, unknown>>(
  params: {
    data: T[];
    leftKey?: string;
    dateKey?: string;
    percentKey?: string;
  }
): (T & { __最大回撤率__: number; __年化收益率__: number | null })[] => {
  const { data, leftKey = '', dateKey = '', percentKey } = params;
  if (!data || data.length === 0) {
    return [];
  }

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
    if (leftKey === '累计收益率') {
      drawdown = ((maxClose + 100) - (closePrice + 100)) / (maxClose + 100);
    } else {
      drawdown = (maxClose - closePrice) / maxClose;
    }
    const drawdownPercent = parseFloat((drawdown * 100).toFixed(2));

    const days = moment(currentDate, 'YYYYMMDD').diff(moment(firstDate, 'YYYYMMDD'), 'days');
    let annualizedRate: number | null = null;
    if (days > 365) {
      if (leftKey === '累计收益率') {
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
  const percentile15 = values[Math.floor(values.length * 0.2)];
  const percentile85 = values[Math.floor(values.length * 0.8)];

  // 为每条数据添加百分位信息
  return {
    percentile15,
    percentile85,
  };
};

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

// K线数据类型
export interface KLineData {
  日期: string;
  股票代码: string;
  开盘: number;
  收盘: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  振幅?: number;
  涨跌幅?: number;
  涨跌额?: number;
  换手率?: number;
}

// 周期类型
export type KLinePeriod = 'weekly' | 'monthly' | 'quarterly';

// 转换日K数据为指定周期的K线数据
export const convertToKLine = (params: {
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

// // 转换日K数据为周K数据
// export const convertToWeeklyK = (dailyData: KLineData[]): KLineData[] => {
//   return convertToKLine(dailyData, 'weekly');
// };

// // 转换日K数据为月K数据
// export const convertToMonthlyK = (dailyData: KLineData[]): KLineData[] => {
//   return convertToKLine(dailyData, 'monthly');
// };

// // 转换日K数据为季K数据
// export const convertToQuarterlyK = (dailyData: KLineData[]): KLineData[] => {
//   return convertToKLine(dailyData, 'quarterly');
// };

// 过滤日K数据，基于周K、月K、季K的RSI6阈值
// 条件：季K的RSI6 < threshold 且对应月K的RSI6 < threshold 且对应周K的RSI6 < threshold
export const filterKLineByRSI = (params: {
  dailyData: KLineData[];
  weeklyData: KLineData[];
  monthlyData: KLineData[];
  quarterlyData: KLineData[];
  rsiThreshold?: number;
}): KLineData[] => {
  const { dailyData, weeklyData, monthlyData, quarterlyData, rsiThreshold = 28 } = params;

  if (!dailyData || dailyData.length === 0) {
    return [];
  }

  // 计算各周期的RSI6
  const weeklyRSI = calculateRSI({ data: weeklyData, period: 6 });
  const monthlyRSI = calculateRSI({ data: monthlyData, period: 6 });
  const quarterlyRSI = calculateRSI({ data: quarterlyData, period: 6 });

  // 构建周期数据的映射，键为日期，值为对应的RSI6
  const weeklyRSIMap = new Map(weeklyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));
  const monthlyRSIMap = new Map(monthlyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));
  const quarterlyRSIMap = new Map(quarterlyRSI.map(item => [moment(item.日期).format('YYYY-MM-DD'), item.__RSI6__]));

  // 过滤日K数据
  return dailyData.filter(dailyItem => {
    const dayDate = moment(dailyItem.日期);
    const dailyRSIValue = dailyItem['__RSI6__'];

    // 找到包含该日的周K日期（周K的日期是该周的最后一个交易日）
    const weekKey = `${dayDate.year()}-W${dayDate.week()}`;
    let weeklyRSIValue = 100; // 默认为100，不满足条件
    for (const [date, rsi] of weeklyRSIMap.entries()) {
      const weekDate = moment(date);
      if (weekDate.year() === dayDate.year() && weekDate.week() === dayDate.week()) {
        weeklyRSIValue = rsi;
        break;
      }
    }

    // 找到包含该日的月K日期（月K的日期是该月的最后一个交易日）
    const monthKey = `${dayDate.year()}-M${dayDate.month() + 1}`;
    let monthlyRSIValue = 100; // 默认为100，不满足条件
    for (const [date, rsi] of monthlyRSIMap.entries()) {
      const monthDate = moment(date);
      if (monthDate.year() === dayDate.year() && monthDate.month() === dayDate.month()) {
        monthlyRSIValue = rsi;
        break;
      }
    }

    // 找到包含该日的季K日期（季K的日期是该季的最后一个交易日）
    const quarter = Math.floor((dayDate.month() + 1 - 1) / 3) + 1;
    const quarterKey = `${dayDate.year()}-Q${quarter}`;
    let quarterlyRSIValue = 100; // 默认为100，不满足条件
    for (const [date, rsi] of quarterlyRSIMap.entries()) {
      const quarterDate = moment(date);
      const dateQuarter = Math.floor((quarterDate.month() + 1 - 1) / 3) + 1;
      if (quarterDate.year() === dayDate.year() && dateQuarter === quarter) {
        quarterlyRSIValue = rsi;
        break;
      }
    }

    // 检查是否满足所有条件
    // todo 指标优化
    // return dailyRSIValue > (100 - 20) && weeklyRSIValue > (100 - 25) && monthlyRSIValue > (100 - 28) && quarterlyRSIValue > (100 - 30); // 超买 
    // return dailyRSIValue < 15 && weeklyRSIValue < 24 && monthlyRSIValue < 27 && quarterlyRSIValue < 30 // 超卖
    return  dailyRSIValue < 12 && weeklyRSIValue < 20 && monthlyRSIValue < 25 && quarterlyRSIValue < 30 // 超卖 todo 推荐指数：多少颗星
    || dailyRSIValue < 12 && weeklyRSIValue < 24 && monthlyRSIValue < 27 && quarterlyRSIValue < 30 // 超卖 todo 多少颗星
    || dailyRSIValue < 10 && weeklyRSIValue < 20 && monthlyRSIValue < 25
    || dailyRSIValue < 15 && weeklyRSIValue < 20 && monthlyRSIValue < 20
    || dailyRSIValue < 8 && weeklyRSIValue < 10


    // || dailyRSIValue < 20 && weeklyRSIValue < 20 && monthlyRSIValue < 20 
    // || dailyRSIValue < 15 && quarterlyRSIValue < 20
    // || dailyRSIValue < 12 && weeklyRSIValue < 20 &&  monthlyRSIValue < 25
  });
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
