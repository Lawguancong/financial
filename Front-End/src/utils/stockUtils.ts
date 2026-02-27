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
