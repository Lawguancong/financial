import moment from 'moment';

export const calculateMaxDrawdown = <T extends Record<string, unknown>>(
  data: T[],
  leftKey: string = '收盘'
): (T & { 最大回撤率: number })[] => {
  if (!data || data.length === 0) {
    return [];
  }

  let maxClose = 0;

  return data.map(item => {
    const closePrice = item[leftKey] as number;

    if (closePrice > maxClose) {
      maxClose = closePrice;
    }

    const drawdown = (maxClose - closePrice) / maxClose;
    const drawdownPercent = parseFloat((drawdown * 100).toFixed(2));

    return {
      ...item,
      最大回撤率: drawdownPercent,
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
  const publishMoment = moment(publishDate, 'YYYYMMDD');
  let startDate = '';

  switch (timeRange) {
    case '上市以来':
      startDate = publishMoment.format('YYYYMMDD');
      break;
    case '20年':
      startDate = currentMoment.subtract(20, 'years').format('YYYYMMDD');
      break;
    case '15年':
      startDate = currentMoment.subtract(15, 'years').format('YYYYMMDD');
      break;
    case '10年':
      startDate = currentMoment.subtract(10, 'years').format('YYYYMMDD');
      break;
    case '5年':
      startDate = currentMoment.subtract(5, 'years').format('YYYYMMDD');
      break;
    case '3年':
      startDate = currentMoment.subtract(3, 'years').format('YYYYMMDD');
      break;
    default:
      startDate = currentMoment.subtract(10, 'years').format('YYYYMMDD');
  }

  if (startDate && startDate < publishDate) {
    startDate = publishDate;
  }

  return startDate;
};
