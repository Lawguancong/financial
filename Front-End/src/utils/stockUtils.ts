import moment from 'moment';

export const calculateMaxDrawdown = <T extends Record<string, unknown>>(
  data: T[],
  leftKey: string = '收盘',
  dateKey: string = '日期'
): (T & { 最大回撤率: number; 年化收益率: number | null })[] => {
  if (!data || data.length === 0) {
    return [];
  }

  let maxClose = 0;
  const firstClose = data[0][leftKey] as number;
  const firstDate = data[0][dateKey] as string;

  return data.map(item => {
    const closePrice = item[leftKey] as number;
    const currentDate = item[dateKey] as string;

    if (closePrice > maxClose) {
      maxClose = closePrice;
    }

    const drawdown = (maxClose - closePrice) / maxClose;
    const drawdownPercent = parseFloat((drawdown * 100).toFixed(2));

    const days = moment(currentDate, 'YYYYMMDD').diff(moment(firstDate, 'YYYYMMDD'), 'days');
    
    // console.log('年化收益率计算:', {
    //   firstDate,
    //   currentDate,
    //   days,
    //   firstClose,
    //   closePrice,
    //   ratio: closePrice / firstClose,
    //   annualizedRate: days > 365 ? Math.pow(closePrice / firstClose, 365 / days) - 1 : null,
    // });
    
    let annualizedRate: number | null = null;
    if (days > 365) {
      annualizedRate = parseFloat((Math.pow(closePrice / firstClose, 365 / days) - 1).toFixed(4));
    }

    return {
      ...item,
      最大回撤率: drawdownPercent,
      年化收益率: annualizedRate !== null ? annualizedRate * 100 : null,
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

  switch (timeRange) {
    case '上市以来':
      startDate = moment(publishDate).format('YYYYMMDD');
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
