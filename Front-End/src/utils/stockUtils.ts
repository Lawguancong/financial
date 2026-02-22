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
