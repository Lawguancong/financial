import moment from 'moment';

export const calculateMaxDrawdown = <T extends Record<string, unknown>>(
  data: T[],
  leftKey: string = '收盘',
  dateKey: string = '日期'
): (T & { __最大回撤率__: number; __年化收益率__: number | null })[] => {
  console.log('11111 leftKey', leftKey);
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

    let drawdown: number | null = null;
    if (leftKey === '累计收益率') {
      drawdown = ((maxClose + 100) - (closePrice+100)) / (maxClose + 100);

    } else {
      drawdown = (maxClose - closePrice) / maxClose;
    }
    const drawdownPercent = parseFloat((drawdown * 100).toFixed(2));

    const days = moment(currentDate, 'YYYYMMDD').diff(moment(firstDate, 'YYYYMMDD'), 'days');
    let annualizedRate: number | null = null;
    if (days > 365) {
      if (leftKey === '累计收益率') {
        annualizedRate = parseFloat((Math.pow((closePrice / 100) + 1, 365 / days) - 1).toFixed(4));
      } else {
        annualizedRate = parseFloat((Math.pow(closePrice / firstClose, 365 / days) - 1).toFixed(4));
      }

    }

    return {
      ...item,
      ['__最大回撤率__']: -drawdownPercent,
      __年化收益率__: annualizedRate !== null ? annualizedRate * 100 : null,
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
