import moment from 'moment';
import { appConfig } from '@/config/appConfig';

// 数据频率：daily = 保留全部日频数据；monthly = 每月只取最后一条数据
export type DataFrequency = 'daily' | 'monthly';

/**
 * 按频率过滤数据
 * - daily：返回全部数据
 * - monthly（默认）：按 YYYY-MM 归组，取每月最晚的一条
 */
export const filterByFrequency = <T>(
  list: T[] | undefined,
  dateKey: string,
  frequency: DataFrequency = 'monthly',
): T[] => {
  if (!Array.isArray(list)) return [];
  if (frequency === 'daily') return list;
  const monthLastMap = new Map<string, T>();
  list.forEach((item) => {
    const date = moment(item[dateKey as keyof T] as unknown as string);
    const month = date.format('YYYY-MM');
    const existing = monthLastMap.get(month);
    if (!existing || date.isAfter(moment(existing[dateKey as keyof T] as unknown as string))) {
      monthLastMap.set(month, item);
    }
  });
  return Array.from(monthLastMap.values());
};

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

  const firstClose = Number(data[0][leftKey]);
  const firstDate = data[0][dateKey] as string;
  // 峰值以首值为基准：起点本身回撤为 0；累计收益率首值为负时也不会虚构回撤
  let maxClose = Number.isFinite(firstClose) ? firstClose : 0;

  const values = percentKey
    ? data
      .map(item => item[percentKey] as number)
      .filter(value => typeof value === 'number' && !isNaN(value))
      .sort((a, b) => a - b)
    : undefined;

  // 计算15%和85%百分位（未传 percentKey 时不产出对应字段，避免污染数据）
  const percentile15 = values && values.length ? values[Math.floor(values.length * 0.15)] : null;
  const percentile85 = values && values.length ? values[Math.floor(values.length * 0.85)] : null;

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
      ...(percentKey
        ? {
          [`__${percentKey}15%百分位__`]: percentile15 !== null ? Number(percentile15.toFixed(2)) : null,
          [`__${percentKey}85%百分位__`]: percentile85 !== null ? Number(percentile85.toFixed(2)) : null,
        }
        : {}),
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

/**
 * 由 Wilder 平滑后的平均涨幅/跌幅计算 RSI6（保留 2 位小数）
 * calculateRSI 与「周期初→当日」截断口径共用，保证两条路径口径完全一致
 */
const rsiFromAvgGainLoss = (avgGain: number, avgLoss: number): number => {
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
  return parseFloat(rsi.toFixed(2));
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

      result.push({
        ...data[i],
        __RSI6__: rsiFromAvgGainLoss(avgGain, avgLoss),
      });
    } else {
      // 后续每日：使用EMA平滑递推
      // EMA公式：AvgUpt = (AvgUpt-1 × (period-1) + ΔPt) / period
      const currentGain = gains[i - 1];
      const currentLoss = losses[i - 1];

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      result.push({
        ...data[i],
        __RSI6__: rsiFromAvgGainLoss(avgGain, avgLoss),
      });
    }
  }

  return result;
};

/**
 * 计算 MACD（指数平滑异同移动平均线），默认参数 (12, 26, 9)。
 *
 * 口径（与行情软件一致）：
 * - EMA 递推：EMA_t = EMA_(t-1) × (N-1)/(N+1) + 收盘_t × 2/(N+1)，首根 EMA 取首根收盘价；
 * - DIF（快线）= EMA(收盘, 12) − EMA(收盘, 26)；
 * - DEA（慢线）= EMA(DIF, 9)；
 * - MACD 柱 = 2 × (DIF − DEA)。
 *
 * 同时产出两条派生序列（供图表观察快慢线关系）：
 * - DEA − DIF = −MACD柱 / 2；
 * - DEA / DIF：DIF 为 0 时无定义，返回 null（图表显示为断点）。
 *
 * 返回与输入等长的数组（首根 DIF/DEA/柱均为 0，没有历史可比），
 * 不做 warmup 截断，方便图表从首个交易日连续展示。
 */
export const calculateMACD = (
  params: {
    data: KLineData[];
    closeKey?: string;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
  }
): (KLineData & {
  __MACD_DIF__: number;
  __MACD_DEA__: number;
  __MACD_BAR__: number;
  /** DEA − DIF（等于 −MACD柱 / 2） */
  __MACD_DEA_MINUS_DIF__: number;
  /** DEA ÷ DIF；DIF = 0 时无定义，为 null */
  __MACD_DEA_DIV_DIF__: number | null;
})[] => {
  const { data, closeKey = '收盘', fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params;

  if (!data || data.length === 0) {
    return [];
  }

  /** EMA 递推（首值取首个收盘价，保证与行情软件同口径） */
  const calculateEMA = (values: number[], period: number): number[] => {
    const multiplier = 2 / (period + 1);
    return values.reduce<number[]>((ema, value, index) => {
      ema.push(index === 0 ? value : ema[index - 1] * (1 - multiplier) + value * multiplier);
      return ema;
    }, []);
  };

  // 收盘价无效时按 0 处理，避免 NaN 沿 EMA 递推扩散
  const closePrices = data.map(item => {
    const value = Number(item[closeKey as keyof KLineData]);
    return Number.isFinite(value) ? value : 0;
  });

  const fastEMA = calculateEMA(closePrices, fastPeriod);
  const slowEMA = calculateEMA(closePrices, slowPeriod);
  const dif = closePrices.map((_, index) => fastEMA[index] - slowEMA[index]);
  const dea = calculateEMA(dif, signalPeriod);

  const round = (value: number) => parseFloat(value.toFixed(4));

  return data.map((item, index) => {
    const roundedDif = round(dif[index]);
    const roundedDea = round(dea[index]);
    return {
      ...item,
      __MACD_DIF__: roundedDif,
      __MACD_DEA__: roundedDea,
      __MACD_BAR__: round((dif[index] - dea[index]) * 2),
      __MACD_DEA_MINUS_DIF__: round(dea[index] - dif[index]),
      // 用四舍五入后的 DIF/DEA 计算比值，保证与返回字段口径一致；DIF 为 0 时无定义
      __MACD_DEA_DIV_DIF__: roundedDif === 0 ? null : round(roundedDea / roundedDif),
    };
  });
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

/** 中证指数历史接口返回行（只声明清洗所需字段） */
export interface CsindexHistoryRow {
  日期: string;
  收盘?: number | null;
  成交量?: number | null;
  成交金额?: number | null;
}

/**
 * 清洗中证指数历史接口（stock_zh_index_hist_csindex）返回数据。
 *
 * 接口行为：当请求的 start_date 早于指数首条真实数据时，会在结果最前面补一条
 * 「日期 = start_date」的占位行，其收盘/成交量/成交金额与紧随其后的首条真实记录完全相同。
 * 该占位行会让「上市以来」收益、RSI/MACD 等指标多出一个远期伪数据点，因此这里按
 * 「日期等于请求起始日 且 与下一条数值完全重复」识别并剔除；真实数据恰好从起始日开始时不满足
 * 重复条件，会被保留。同时过滤收盘价为空或非正的记录。
 *
 * @param rows 接口原始数据（按日期升序）
 * @param requestStartDate 请求时传入的 start_date（YYYYMMDD 或 YYYY-MM-DD）
 */
export const cleanCsindexHistory = <T extends CsindexHistoryRow>(
  rows: T[] | undefined | null,
  requestStartDate: string,
): T[] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const validRows = rows.filter(row => {
    const close = Number(row.收盘);
    return Number.isFinite(close) && close > 0;
  });
  if (validRows.length <= 1) return validRows;

  const [first, second] = validRows;
  const requestedDate = moment(requestStartDate, ['YYYYMMDD', 'YYYY-MM-DD']).format('YYYY-MM-DD');
  const firstDate = moment(first.日期).format('YYYY-MM-DD');
  const duplicated =
    Number(first.收盘) === Number(second.收盘) &&
    Number(first.成交量 ?? 0) === Number(second.成交量 ?? 0) &&
    Number(first.成交金额 ?? 0) === Number(second.成交金额 ?? 0);

  return firstDate === requestedDate && duplicated ? validRows.slice(1) : validRows;
};

/**
 * 查找序列中的局部峰值索引（滚动窗口极值口径）。
 *
 * 判定条件：
 * - 当前值有效且严格高于相邻的前后各一根（平台期不重复标记）；
 * - 在当前值前后各 window 根组成的窗口内，不存在更高的有效值；
 * - 首尾点不标记（缺少完整的前后邻点）；
 * - 可选 requirePositive：只保留正值峰值（用于 DEA÷DIF 的“顶部最大值”）。
 *
 * @param values 数值序列（可含 null/undefined，表示断点）
 * @param window 前后比较根数（≥1）
 * @param options.requirePositive 是否只标记正值峰值，默认 false
 */
export const findLocalMaxima = (
  values: (number | null | undefined)[],
  window: number,
  options: { requirePositive?: boolean } = {},
): number[] => {
  const { requirePositive = false } = options;
  const result: number[] = [];
  if (!values?.length || window < 1 || values.length < 3) return result;

  for (let i = 1; i < values.length - 1; i++) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) continue;
    if (requirePositive && value <= 0) continue;

    // 断点附近不标记，避免被截断的隐藏高点误判为峰值
    const prev = values[i - 1];
    const next = values[i + 1];
    if (prev == null || next == null || value <= prev || value <= next) continue;

    let isWindowMax = true;
    const start = Math.max(0, i - window);
    const end = Math.min(values.length - 1, i + window);
    for (let j = start; j <= end; j++) {
      const other = values[j];
      if (other != null && Number.isFinite(other) && other > value) {
        isWindowMax = false;
        break;
      }
    }
    if (isWindowMax) result.push(i);
  }

  return result;
};

/** 已确认峰值：峰值位置 + 确认位置（买点日） */
export interface ConfirmedPeak {
  /** 峰值所在索引 */
  peakIndex: number;
  /** 确认所在索引（峰值后第 confirmLag 根，即 as-of 买点日） */
  confirmIndex: number;
}

/**
 * 查找“已确认”的局部峰值（as-of 口径）。
 *
 * 与 findLocalMaxima 的 ±window 不同，这里只回看过去 window 根，并要求峰值后的
 * confirmLag 根全部低于峰值；因此确认日（peakIndex + confirmLag）当天就能得到信号，
 * 不需要确认日之后的数据，避免未来函数。
 *
 * 判定条件：
 * - 当前值是过去 window 根（含当前）内的最高值，且严格高于前一根（平台期不重复标记）；
 * - 峰值后 confirmLag 根必须全部为有效值且严格低于峰值；
 * - 首部/尾部不足 window、confirmLag 的位置不产生信号；
 * - 可选 requirePositive：只保留正值峰值。
 *
 * @param values 数值序列（可含 null/undefined，表示断点）
 * @param window 回看根数（≥1）
 * @param confirmLag 确认滞后根数（≥1，默认由调用方传入 1）
 * @param options.requirePositive 是否只标记正值峰值，默认 false
 * @param options.confirmValues 确认用的数值序列（默认为 values）。
 *   峰值判定可用过滤后的序列（忽略极端值），但确认回落应使用真实比值，
 *   避免显示裁剪产生的 null 把有效峰值误判为未确认。
 */
export const findConfirmedPeaks = (
  values: (number | null | undefined)[],
  window: number,
  confirmLag: number,
  options: { requirePositive?: boolean; confirmValues?: (number | null | undefined)[] } = {},
): ConfirmedPeak[] => {
  const { requirePositive = false } = options;
  const confirmValues = options.confirmValues ?? values;
  const result: ConfirmedPeak[] = [];
  const lookback = Math.max(1, Math.floor(window));
  const lag = Math.max(1, Math.floor(confirmLag));
  if (!values?.length || values.length < lookback + lag) return result;

  for (let i = lookback - 1; i < values.length - lag; i++) {
    const value = values[i];
    if (value == null || !Number.isFinite(value)) continue;
    if (requirePositive && value <= 0) continue;

    // 严格新高：优先用峰值判定序列；若上一根被显示裁剪为 null，则回退到真实比值
    // （真实值更低时仍可成为峰值；真实值更高时说明仍在下降，不应标记）
    const prev = values[i - 1] ?? confirmValues[i - 1];
    if (prev == null || !Number.isFinite(prev) || value <= prev) continue;

    // 过去 window 根（含当前）内最高
    let isWindowMax = true;
    for (let j = i - lookback + 1; j <= i; j++) {
      const other = values[j];
      if (other != null && Number.isFinite(other) && other > value) {
        isWindowMax = false;
        break;
      }
    }
    if (!isWindowMax) continue;

    // 峰值后 confirmLag 根全部低于峰值，才算确认（使用真实比值，避免显示裁剪的 null 误判）
    let confirmed = true;
    for (let j = i + 1; j <= i + lag; j++) {
      const next = confirmValues[j];
      if (next == null || !Number.isFinite(next) || next >= value) {
        confirmed = false;
        break;
      }
    }
    if (confirmed) result.push({ peakIndex: i, confirmIndex: i + lag });
  }

  return result;
};

/** 峰值行配对：峰值位置的数据行 + 确认位置（买点日）的数据行 */
export interface ConfirmedPeakRowPair<T> {
  peakIndex: number;
  confirmIndex: number;
  peakRow: T;
  confirmRow: T;
}

/**
 * 将 findConfirmedPeaks 返回的索引映射为峰值行/确认行。
 * 索引越界时跳过该条，保证表格数据安全。
 */
export const mapConfirmedPeakRows = <T>(
  rows: T[],
  peaks: ConfirmedPeak[],
): ConfirmedPeakRowPair<T>[] =>
  peaks.flatMap(({ peakIndex, confirmIndex }) => {
    const peakRow = rows[peakIndex];
    const confirmRow = rows[confirmIndex];
    return peakRow === undefined || confirmRow === undefined
      ? []
      : [{ peakIndex, confirmIndex, peakRow, confirmRow }];
  });

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
        // 使用 ISO weekYear 而非日历 year：跨年周（如 2014-12-29~2015-01-02）属同一周，
        // 若用 year() 会被拆成两组、并与同年 12 月合并，导致周K日期错位、周RSI6 取到错误的上一完成周
        key = `${date.weekYear()}-W${week}`;
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

    // 按日期排序（用 moment 解析，兼容 YYYY-MM-DD / YYYYMMDD 两种输入）
    group.sort((a, b) => moment(a.日期).valueOf() - moment(b.日期).valueOf());

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

  // 按日期排序（用 moment 解析，兼容 YYYY-MM-DD / YYYYMMDD 两种输入）
  kLineData.sort((a, b) => moment(a.日期).valueOf() - moment(b.日期).valueOf());

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

/**
 * 逐根返回 Wilder RSI 的递推状态（处理完第 i 根后的 avgGain/avgLoss）
 * 与 calculateRSI 的递推完全一致：第 period 根为简单平均种子，之后为递推；前 period 根无有效状态（null）
 */
const computeWilderStates = (
  closes: number[],
  period: number,
): ({ avgGain: number; avgLoss: number } | null)[] => {
  const states: ({ avgGain: number; avgLoss: number } | null)[] = closes.map(() => null);
  if (closes.length < period + 1) return states;

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  // 初始 period 根：简单平均
  let avgGain = 0;
  let avgLoss = 0;
  for (let j = 0; j < period; j++) {
    avgGain += gains[j];
    avgLoss += losses[j];
  }
  avgGain /= period;
  avgLoss /= period;
  states[period] = { avgGain, avgLoss };

  for (let i = period + 1; i < closes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    states[i] = { avgGain, avgLoss };
  }
  return states;
};

/**
 * 计算「周期初→当日」截断口径的周/月 RSI6（逐日产出，消除未来函数）
 *
 * 背景：整周期口径下每个周/月只产出一根周期 K 线（日期=周期最后一天）。若把周期内某一天
 * 直接匹配到该周期末 K 线，等于用该天之后（未来）的数据计算当天的周 RSI6 / 月 RSI6。本函数改为逐日产出：
 *
 * - 已完成周期（前 k 根周期 K 线）作为历史前缀，其 Wilder 递推状态在周期末固定；
 * - 当日所在周期按「周期初→当日」截断（截断周期收盘 = 当日收盘）；
 * - 用前缀状态对「截断周期相对上一已完成周期的涨跌」做一次 Wilder 递推，得到当日周/月 RSI6；
 * - 周期末当天的截断周期即整周期 K 线，结果与整周期口径一致；
 * - 前 period 根周期（预热点，无有效前缀状态）内的日不输出。
 *
 * 复杂度 O(日 K 数 × log 周期数)：每天的周期定位用二分查找，不依赖 dailyData 的输入顺序。
 *
 * @param dailyData 日 K 数据（输入顺序不限，逐日独立定位其所属周期）
 * @param periodBars 对应周期的 K 线序列（须按日期升序），通常直接传入 calculateWeeklyRSI6 / calculateMonthlyRSI6 的结果
 * @returns 逐日序列（日期=日 K 日期，收盘=当日收盘，__RSI6__=当日截断口径的周/月 RSI6）
 */
export const calculateAsOfPeriodRSI6 = (
  dailyData: KLineData[],
  periodBars: KLineData[],
): (KLineData & { __RSI6__: number })[] => {
  const period = 6;
  if (!dailyData?.length || !periodBars || periodBars.length < period + 1) return [];

  const barCloses = periodBars.map(bar => bar.收盘 as number);
  const states = computeWilderStates(barCloses, period);

  // k === period 时的种子：前 period-1 个「已完成周期之间」涨跌累计（固定不变）
  let seedGain = 0;
  let seedLoss = 0;
  for (let j = 1; j < period; j++) {
    const change = barCloses[j] - barCloses[j - 1];
    seedGain += Math.max(change, 0);
    seedLoss += Math.max(-change, 0);
  }

  // 二分查找：首个「周期末日期 >= 当日」的周期 K 线下标；当日晚于最后一根周期 K 线时返回 periodBars.length
  // 逐日独立定位（O(log 周期数)），不使用单调指针，因此不依赖 dailyData 的输入顺序
  const findPeriodIndex = (dayDate: string): number => {
    let lo = 0;
    let hi = periodBars.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (periodBars[mid].日期 < dayDate) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  };

  const result: (KLineData & { __RSI6__: number })[] = [];
  for (const day of dailyData) {
    // 定位当日所在周期
    const k = findPeriodIndex(day.日期);
    if (k >= periodBars.length) continue; // 当日晚于最后一根周期 K 线，无对应周期
    if (k < period) continue; // 预热点：无有效前缀状态

    const close = day.收盘 as number;
    // 截断周期相对「上一已完成周期」的涨跌
    const change = close - barCloses[k - 1];
    let avgGain: number;
    let avgLoss: number;
    if (k === period) {
      // 首个有效周期：简单平均种子（前 period-1 个变化固定，第 period 个为截断变化）
      avgGain = (seedGain + Math.max(change, 0)) / period;
      avgLoss = (seedLoss + Math.max(-change, 0)) / period;
    } else {
      const state = states[k - 1];
      if (!state) continue;
      avgGain = (state.avgGain * (period - 1) + Math.max(change, 0)) / period;
      avgLoss = (state.avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    }
    result.push({ 日期: day.日期, 收盘: close, __RSI6__: rsiFromAvgGainLoss(avgGain, avgLoss) });
  }
  return result;
};

/**
 * 计算「季初→当月」截断口径的季 RSI6 序列（消除未来函数）
 *
 * 背景：整季口径每季只产出一根季 K 线（日期=季末），若把 1～2 月的月度点直接匹配到
 * 该季末 K 线，等于用 3 月（未来）数据计算 1 月、2 月的季 RSI6。本函数改为逐月产出：
 *
 * - 取「已完成季度」的季末 K 线序列作为历史前缀（每季一根，收盘=该季最后一个月的收盘）；
 * - 当前季度按「季初→当月」截断：前缀 + 当月收盘，构成「截至当月」的季 K 线序列；
 * - 在该序列上计算 Wilder RSI6，取序列最后一点作为该月的季 RSI6；
 * - 季末月（1～3 月取 3 月、4～6 月取 6 月 …）的截断季 K 线即整季 K 线，结果与整季口径一致；
 * - 前缀不足 rsiWarmup 个已完成季度（RSI 尚不可信）的月份不输出，保证分位样本不含预热点。
 *
 * @returns 与月 K 线一一对应的季 RSI6 序列（日期=当月最后一条数据日期，__RSI6__=当月季 RSI6）
 */
export const calculateQuarterlyRSI6 = (dailyData: KLineData[]) => {
  // 季初→当月 的截断序列以「月」为粒度，先聚合为月 K 线
  const monthlyData = aggregateKLineByPeriod({ dailyData, period: 'monthly' });
  if (monthlyData.length === 0) return [];

  const closeKey = '收盘';
  const result: (KLineData & { __RSI6__: number })[] = [];
  // 已完成季度的季末 K 线（后续月份计算季 RSI6 的历史前缀）
  const completedQuarters: KLineData[] = [];

  let i = 0;
  while (i < monthlyData.length) {
    const quarterKey = getQuarterKey(monthlyData[i].日期);

    // 收集当前自然季度内的所有月份
    const quarterMonths: KLineData[] = [];
    let j = i;
    while (j < monthlyData.length && getQuarterKey(monthlyData[j].日期) === quarterKey) {
      quarterMonths.push(monthlyData[j]);
      j += 1;
    }

    // 前缀不足预热数时 RSI 不可信，整季跳过（不参与分位与买卖判定）
    if (completedQuarters.length >= rsiWarmup) {
      // 季内每个月：已完成季度前缀 + 当月收盘 => 「季初→当月」截断季序列
      for (const month of quarterMonths) {
        const rsiSeries = calculateRSI({
          data: [...completedQuarters, month],
          closeKey,
          period: 6,
        });
        if (!rsiSeries.length) continue;
        result.push({ ...month, __RSI6__: rsiSeries[rsiSeries.length - 1].__RSI6__ });
      }
    }

    // 本季度已走完：其季末 K 线（季内最后一个月）进入历史前缀
    completedQuarters.push(quarterMonths[quarterMonths.length - 1]);
    i = j;
  }

  return result;
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

/**
 * 判断「买入&卖出一一配对」在候选卖点是否达到最低收益率门槛
 *
 * 门槛口径按持有期分两段（门槛与分界均可配置，见 appConfig.rsi.sellMinReturnPct / annualizeMinHoldingDays）：
 * - 持有不足年化分界天数（当前配置 1 天，该分支实际不会命中）：要求区间收益率 ≥ 门槛；
 * - 持有满年化分界天数及以上（当前配置下为全部持有期）：要求年化收益率 ≥ 门槛（年化为 null 视为不满足）。
 *
 * @param returnRate 区间收益率（%，卖出价 vs 第一次买入价）
 * @param holdingDays 持有天数（自然日）
 * @param minReturnPct 最低收益率门槛（%）
 */
const isPairSellReturnSatisfied = (
  returnRate: number,
  holdingDays: number,
  minReturnPct: number,
): boolean => {
  if (holdingDays >= RSI_ANNUALIZE_MIN_HOLDING_DAYS) {
    const annualized = calculateAnnualizedReturn(returnRate, holdingDays);
    return annualized != null && annualized >= minReturnPct;
  }
  return returnRate >= minReturnPct;
};

/**
 * 获取某日的各周期（日/周/月/季）RSI6 值
 *
 * 周/月/季均使用「周期初→当日」截断口径（消除未来函数）：
 * - weeklyRSIMap / monthlyRSIMap 键为「日 K 日期 YYYY-MM-DD」，值为当日截断口径的周/月 RSI6
 *   （由 calculateAsOfPeriodRSI6 逐日产出）
 * - quarterlyRSIMap 键为「YYYY-MM」，值为当月「季初→当月」截断口径的季 RSI6
 * 缺失时取 100（不满足任何买入条件），与旧实现的默认值保持一致
 */
export const getPeriodRSIValues = (
  dailyRSIData: KLineData, // 日K数据
  weeklyRSIMap: Map<string, number>, // 当日截断口径周RSI6映射（键 YYYY-MM-DD）
  monthlyRSIMap: Map<string, number>, // 当日截断口径月RSI6映射（键 YYYY-MM-DD）
  quarterlyRSIMap: Map<string, number>, // 当月截断口径季RSI6映射（键 YYYY-MM）
) => {
  const dayDate = moment(dailyRSIData.日期);
  const dailyRSIValue = dailyRSIData['__RSI6__'];

  const dayKey = dayDate.format('YYYY-MM-DD');
  const dayMonthKey = dayDate.format('YYYY-MM');

  const weeklyRSIValue = weeklyRSIMap.get(dayKey) ?? 100;
  const monthlyRSIValue = monthlyRSIMap.get(dayKey) ?? 100;
  const quarterlyRSIValue = quarterlyRSIMap.get(dayMonthKey) ?? 100;

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
  // 日→周、周→月 亦采用「周期初→当日」截断口径（消除未来函数）：
  // 不再把周期内某一天直接匹配到周期末 K 线，而是逐日重算当天的周/月 RSI6（键为日 K 日期）
  const weeklyRSIMap = new Map(
    calculateAsOfPeriodRSI6(dailyRSI, weeklyRSI).map(item => [
      moment(item.日期).format('YYYY-MM-DD'),
      item.__RSI6__,
    ]),
  );
  const monthlyRSIMap = new Map(
    calculateAsOfPeriodRSI6(dailyRSI, monthlyRSI).map(item => [
      moment(item.日期).format('YYYY-MM-DD'),
      item.__RSI6__,
    ]),
  );
  // 季RSI6 为「季初→当月」截断口径（与月 K 线一一对应）：键为 YYYY-MM
  const quarterlyRSIMap = new Map(
    quarterlyRSI.map(item => [moment(item.日期).format('YYYY-MM'), item.__RSI6__]),
  );

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

// ============================================================
// RSI 策略参数（统一配置见 @/config/appConfig 的 rsi 段）
// 此处仅做本地解构，避免改动内部既有引用；对外请直接使用 appConfig。
// ============================================================
const rsiConfig = appConfig.rsi;
const {
  warmup: rsiWarmup,
  asOfWindowMonths: RSI_ASOF_WINDOW_MONTHS,
  minSampleCount: MQ_MIN_SAMPLE_MONTHS,
  sellMinReturnPct: MQ_SELL_MIN_RETURN_PCT,
  annualizeMinHoldingDays: RSI_ANNUALIZE_MIN_HOLDING_DAYS,
} = rsiConfig;
const {
  levelRules: MQ_LEVEL_RULES,
  monthlySellPercentile: MONTHLY_RSI_SELL_PERCENTILE,
  quarterlySellPercentile: QUARTERLY_RSI_SELL_PERCENTILE,
  sellMinHoldingDays: MQ_SELL_MIN_HOLDING_DAYS,
  trancheCount: MQ_SELL_TRANCHE_COUNT,
  trancheIntervalDays: MQ_SELL_TRANCHE_INTERVAL_DAYS,
} = rsiConfig.monthlyQuarterly;
const SINGLE_PERIOD_SELL_MIN_RETURN_PCT = rsiConfig.sellMinReturnPct;
const SINGLE_PERIOD_MIN_SAMPLE_COUNT = rsiConfig.minSampleCount;


/**
 * 滚动窗口分位读取器（as-of）：
 * 按时间顺序 push 当前样本，读取时只用窗口内「当期及之前」的样本（含当期），不含未来数据；
 * 超出近 windowMonths 个月的旧样本会自动移出窗口，但至少保留 minKeep 个样本，
 * 对应「历史不足 10 年但满 60 个月时用全部历史回测」。
 */
interface RollingPercentileReader {
  /** 追加一个样本（保持内部有序，二分插入），date 为样本所属日期 */
  push: (value: number, date: string) => void;
  /** 读取当前窗口的分位值（两位小数，最近秩口径与 calculatePercentile 一致） */
  read: (percentile: number) => number;
  /** 当前窗口有效样本数 */
  size: () => number;
}

const createRollingPercentileReader = (
  minKeep = MQ_MIN_SAMPLE_MONTHS,
  windowMonths = RSI_ASOF_WINDOW_MONTHS,
): RollingPercentileReader => {
  const sorted: number[] = [];
  const queue: { value: number; time: number }[] = [];

  /** 从有序数组中移除一个指定值（重复值任意移除一个即可） */
  const removeValue = (value: number): void => {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sorted[middle] < value) low = middle + 1;
      else high = middle;
    }
    if (sorted[low] === value) sorted.splice(low, 1);
  };

  return {
    push(value: number, date: string): void {
      let low = 0;
      let high = sorted.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (sorted[middle] < value) low = middle + 1;
        else high = middle;
      }
      sorted.splice(low, 0, value);

      const current = moment(date);
      queue.push({ value, time: current.valueOf() });

      // 窗口左界：当期往前 windowMonths 个月；只保留晚于左界的样本
      const cutoff = current.clone().subtract(windowMonths, 'months').valueOf();
      while (queue.length > minKeep && queue[0].time <= cutoff) {
        const removed = queue.shift();
        if (removed) removeValue(removed.value);
      }
    },
    read(percentile: number): number {
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return Number(sorted[Math.max(0, index)].toFixed(2));
    },
    size(): number {
      return sorted.length;
    },
  };
};

/** 读取当前窗口的买入分级阈值与卖出阈值（as-of 快照） */
const readMonthlyQuarterlyThresholds = (
  monthlyReader: RollingPercentileReader,
  quarterlyReader: RollingPercentileReader,
): {
  thresholds: Record<number, { monthly: number; quarterly: number }>;
  sellThresholds: { monthly: number; quarterly: number };
} => {
  const thresholds: Record<number, { monthly: number; quarterly: number }> = {};
  for (const { level, monthlyPercentile, quarterlyPercentile } of MQ_LEVEL_RULES) {
    thresholds[level] = {
      monthly: monthlyReader.read(monthlyPercentile),
      quarterly: quarterlyReader.read(quarterlyPercentile),
    };
  }
  return {
    thresholds,
    sellThresholds: {
      monthly: monthlyReader.read(MONTHLY_RSI_SELL_PERCENTILE),
      quarterly: quarterlyReader.read(QUARTERLY_RSI_SELL_PERCENTILE),
    },
  };
};

/** 归一化分批次数（配置见 appConfig.rsi.monthlyQuarterly.trancheCount）：非法值兜底为 1，保证至少卖出一次 */
export const getSellTrancheCount = (): number => Math.max(1, Math.floor(MQ_SELL_TRANCHE_COUNT));

/** 归一化分批间隔（配置见 appConfig.rsi.monthlyQuarterly.trancheIntervalDays）：强制 > 1 天，避免多批落在同一交易日 */
export const getSellTrancheIntervalDays = (): number =>
  Math.max(2, Math.floor(MQ_SELL_TRANCHE_INTERVAL_DAYS));

/** 分批卖出列名：如「第2批卖出收益率（T+7天）」，天数随间隔配置自动变化 */
export const getSellTrancheColumnTitle = (index: number): string =>
  `第${index}批卖出收益率（T+${(index - 1) * getSellTrancheIntervalDays()}天）`;

/**
 * 归一化最低持有天数（配置见 appConfig.rsi.monthlyQuarterly.sellMinHoldingDays）：非法值兜底为 1 天。
 *
 * 说明：持有未满该天数时，即使月/季 RSI6 同时触及卖出分位、收益率也达门槛也不卖出；
 * 该值同时作为本策略「年化收益率」的计算门槛（未满则不计算，页面/导出展示为 --）；
 * 仅作用于「月&季 RSI6 百分位策略」的 ★5 配对，周/月单周期策略不受影响。
 */
export const getMinSellHoldingDays = (): number =>
  Math.max(1, Math.floor(MQ_SELL_MIN_HOLDING_DAYS));


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
  /** 产生信号前所需的最小有效样本数（默认 SINGLE_PERIOD_MIN_SAMPLE_COUNT） */
  minSamples?: number;
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
 * 口径（as-of 滚动窗口）：剔除前 warmup 个预热点后，每一期先把当期 RSI6 追加进窗口，
 * 再用「当期及之前、近 RSI_ASOF_WINDOW_MONTHS 个月」的样本读取买入/卖出阈值（含当期自身），
 * 不使用该期之后的数据；历史不足 10 年但满 60 个样本时使用全部历史；
 * 有效样本不足 minSamples 时不产生信号；空仓触及（≤）买入分位建仓，
 * 持仓期间触及（≤）即加仓，触及（≥）卖出分位且收益率达门槛时卖出。
 *
 * @returns { threshold, trades }：threshold 为最新一期窗口快照（仅供图表水平参考线展示）；
 *          有效数值为空时返回 { threshold: null, trades: [] }
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
    minSamples = SINGLE_PERIOD_MIN_SAMPLE_COUNT,
  } = params;

  const arr = (rsiData as RsiKLineData[]).slice(warmup);
  // 近 RSI_ASOF_WINDOW_MONTHS 个月滚动窗口；历史不足 10 年时自然退化为全部历史
  const reader = createRollingPercentileReader(minSamples);

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

    // 先入样本（含当期），再读取当期阈值：保证只使用当期及之前、近 10 年窗口内的数据
    reader.push(rsi, item.日期);
    // 有效样本不足时不产生任何买卖信号，避免早期分位阈值退化为窗口极值
    if (reader.size() < minSamples) continue;

    const buyThreshold = reader.read(buyPercentile);
    const sellThreshold = reader.read(sellPercentile);

    if (!holding) {
      // 空仓期间 RSI6 触及（≤）买入分位时建仓
      if (rsi <= buyThreshold) {
        holding = {
          buyDate: item.日期,
          buyRsi: rsi,
          buyPrice: item.收盘,
          // 用 moment 解析日期，兼容 YYYY-MM-DD / YYYYMMDD；new Date('YYYYMMDD') 会得到 Invalid Date
          buyTime: moment(item.日期).valueOf(),
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

    // 卖出只与第一次买入配对；满足 RSI 超买条件且收益率达门槛才平仓（按年化收益率判定，分界见 appConfig.rsi.annualizeMinHoldingDays）
    const returnRate = calculateHoldingReturnRate(holding.buyPrice, item.收盘, closeValueType);
    const holdingDays = Math.max(
      1,
      Math.round((moment(item.日期).valueOf() - holding.buyTime) / (24 * 60 * 60 * 1000)),
    );
    if (
      rsi >= sellThreshold &&
      isPairSellReturnSatisfied(returnRate, holdingDays, SINGLE_PERIOD_SELL_MIN_RETURN_PCT)
    ) {
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
          holdingDays >= RSI_ANNUALIZE_MIN_HOLDING_DAYS
            ? calculateAnnualizedReturn(tradeReturnRate, holdingDays)
            : null,
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

  if (reader.size() === 0) return { threshold: null, trades: [] };

  // 最新一期窗口快照（含最新一期自身），仅供图表水平参考线展示；
  // 历史各期实际判定使用各自当期的 as-of 阈值，不回填、不重绘
  return {
    threshold: {
      buy: reader.read(buyPercentile),
      sell: reader.read(sellPercentile),
    },
    trades,
  };
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

/** 月&季 RSI6 ★5 单批卖出明细 */
export interface SellTrancheDetail {
  /** 批次序号，从 1 开始 */
  index: number;
  /** 目标卖出日（信号日 + (index-1) × 间隔天数，YYYY-MM-DD） */
  targetDate: string;
  /** 实际卖出日（>= 目标日且晚于上一批的首个交易日；无数据时不填） */
  sellDate?: string;
  /** 本批卖出价（与买入价同口径） */
  sellPrice?: number;
  /** 本批持有天数（买入日 → 实际卖出日） */
  holdingDays?: number;
  /** 本批收益率（%） */
  returnRate?: number;
  /** 是否已执行（后续行情数据不足时为 false） */
  executed: boolean;
}

/** 月+季 RSI6 共振买点（月/季 RSI6 同时跌破「截至当月、近 10 年」的 as-of 滚动分位，带推荐级别） */
export interface MonthlyQuarterlyPercentileBuyPoint {
  日期: string;
  收盘: number;
  monthlyRsi: number;
  quarterlyRsi: number;
  /** 推荐星级 1/3/5 */
  level: number;
  /** 卖出日期（★5买点与卖点按时间顺序配对，未配对的为空；分批卖出时为第 1 批信号日） */
  sellDate?: string;
  /** 卖出时点月RSI6 */
  sellMonthlyRsi?: number;
  /** 卖出时点季RSI6 */
  sellQuarterlyRsi?: number;
  /** 卖出价（卖出信号日收盘价） */
  sellPrice?: number;
  /** 持有天数（买入月 - 首笔卖出信号日，至少1天） */
  holdingDays?: number;
  /** 平均收益率（%）：各批已执行卖出收益率的算术平均 */
  returnRate?: number;
  /** 年化收益率（%），calculateAnnualizedReturn 可能返回 null */
  annualizedReturn?: number | null;
  /** 分批卖出明细（批次 = 1 时为单条，等同一次性卖出） */
  sellTranches?: SellTrancheDetail[];
  /**
   * 最大回撤率（%，正值）：以买入价为基准，买入之后（已配对的至卖出日，未卖出则至最新交易日）
   * 低于买入价的最大跌幅；全程未跌破买入价时无值（展示为 -）
   */
  maxDrawdown?: number;
  /** 最大回撤最低点日期（回撤最低点所在交易日） */
  maxDrawdownDate?: string;
  /** 最大回撤的收盘价（回撤最低点的收盘价） */
  maxDrawdownClose?: number;
  /** 买点到最大回撤最低点的天数（日历天） */
  daysToMaxDrawdown?: number;
  /**
   * 回本日期：最大回撤最低点之后、首个收盘价 ≥ 买入价的交易日（等于买入价即不亏钱）；
   * 区间内一直未回本（含卖出时仍亏损、或持有到最新交易日仍在成本线下）时无值（展示为 -）
   */
  recoveryDate?: string;
  /**
   * 最大回本持有天数（日历天）：持有期内多次跌破买入价时，取「跌破 → 回本」最长一段的天数；
   * 只统计已回本的连续水下区间，全程未跌破买入价或最后一段仍未回本且无其它已回本区间时无值（展示为 -）
   */
  maxRecoveryHoldingDays?: number;
  /** Calmar 比率 = 年化收益率 / 最大回撤率（年化收益率为空或无回撤时无值） */
  calmarRatio?: number;
  // ---- 「持有至今」信息：仅补充在尚未配对卖出的买点上，供「买入计划」导出使用 ----
  /** 最新交易日日期（YYYY-MM-DD） */
  latestDate?: string;
  /** 最新交易日收盘值（与买入价同口径，用于计算持有至今收益率） */
  latestClose?: number;
  /** 持有至今天数（买入日 → 最新交易日，至少1天） */
  holdingDaysToNow?: number;
  /** 持有至今收益率（%，最新交易日 vs 买入价，可正可负） */
  returnRateToNow?: number;
}

/**
 * 为买点补充「当前价格」与（未卖出时的）「持有至今」信息
 *
 * - 所有买点：`latestDate` / `latestClose` = 最新交易日及其收盘值（导出「当前价格」列使用）；
 * - 未配对卖出（无 sellDate）的买点另补：持有天数 = 买入日 → 最新交易日；
 *   持有至今收益率 = 最新交易日收盘值 vs 买入价（可为负）。
 *
 * 已配对卖出的买点不补「持有至今」口径，避免与「卖出 vs 买入」的已实现口径混淆。
 *
 * @param points 买点明细（原地补充）
 * @param latestDate 最新交易日日期
 * @param latestClose 最新交易日收盘值
 * @param closeValueType 收盘值语义（基金为 cumulativeReturn）
 */
export const fillHoldingToNow = (
  points: MonthlyQuarterlyPercentileBuyPoint[],
  latestDate: string,
  latestClose: number,
  closeValueType: CloseValueType = 'price',
): void => {
  const latestNorm = moment(latestDate).format('YYYY-MM-DD');
  const latestCloseValue = Number(latestClose.toFixed(2));
  points.forEach(point => {
    point.latestDate = latestNorm;
    point.latestClose = latestCloseValue;
    if (point.sellDate) return;
    point.holdingDaysToNow = Math.max(1, moment(latestNorm).diff(moment(point.日期), 'days'));
    point.returnRateToNow = calculateHoldingReturnRate(point.收盘, latestClose, closeValueType);
  });
};

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
  /**
   * 卖出取价序列（日频或接口原始频率，需含 日期 / 收盘）：
   * 分批卖出按「信号日 + n×间隔」取首个 >= 目标日的交易日收盘价；
   * 缺省时退化为用月线 (monthlyRSI6Data) 取价
   */
  priceSeries?: KLineData[];
  /** 收盘值语义，决定收益率计算公式，默认 price */
  closeValueType?: CloseValueType;
}

/** 月&季 RSI6 百分位策略分析结果（阈值 + 卖点 + 买点，一次计算全部产出） */
export interface MonthlyQuarterlyPercentileResult {
  /** 各级别买入分位阈值（as-of：最新月近 10 年窗口快照，取值见 appConfig.rsi.monthlyQuarterly.levelRules） */
  thresholds: Record<number, { monthly: number; quarterly: number }>;
  /** 卖出分位阈值（as-of：最新月近 10 年窗口快照，月/季分别可配置，见 appConfig.rsi.monthlyQuarterly） */
  sellThresholds: { monthly: number; quarterly: number };
  /** 买点列表（含配对的卖出信息；每个买点按「当月及之前近 10 年」的滚动窗口阈值判定） */
  buyPoints: MonthlyQuarterlyPercentileBuyPoint[];
}

/** 日期归一化为 YYYY-MM-DD（字符串比较依赖该格式） */
const toDateKey = (date: string): string => moment(date).format('YYYY-MM-DD');

/** 日历天差（至少 1 天） */
const diffCalendarDays = (from: string, to: string): number =>
  Math.max(1, moment(to).diff(moment(from), 'days'));

/** 按日期升序的序列中，二分查找首个 date >= target 的下标 */
const findFirstDateIndex = (series: { date: string }[], target: string): number => {
  let low = 0;
  let high = series.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (series[middle].date < target) low = middle + 1;
    else high = middle;
  }
  return low;
};

/** 分批卖出构建入参 */
export interface SellTrancheParams {
  /** 买入日期 */
  buyDate: string;
  /** 买入价（与卖出价同口径） */
  buyClose: number;
  /** 卖出信号日 */
  signalDate: string;
  /** 卖出信号日收盘价 */
  signalClose: number;
  /** 后续批次取价序列（日频或接口原始频率）；缺省时后续批次标记未执行 */
  priceSeries?: KLineData[];
  /** 收盘值语义（基金为 cumulativeReturn） */
  closeValueType?: CloseValueType;
}

/**
 * 构建「月&季 RSI6 ★5 分批卖出」明细
 *
 * - 第 1 批固定为卖出信号当日（T+0），价格取信号日收盘价；
 * - 第 i 批目标日 = 信号日 + (i-1) × 间隔天数，目标日非交易日时顺延到下一个交易日的收盘价，
 *   且必须严格晚于上一批实际卖出日（避免数据稀疏时重复取价）；
 * - 后续行情不足（目标日之后没有数据）时该批 `executed = false`，不参与平均收益率统计。
 */
export const buildSellTranches = (params: SellTrancheParams): SellTrancheDetail[] => {
  const {
    buyDate,
    buyClose,
    signalDate,
    signalClose,
    priceSeries,
    closeValueType = 'price',
  } = params;
  const count = getSellTrancheCount();
  const intervalDays = getSellTrancheIntervalDays();
  const buyDateKey = toDateKey(buyDate);

  // 归一化并按日期升序（二分查找依赖有序），过滤无效收盘值
  const series = (priceSeries ?? [])
    .map((item) => ({ date: toDateKey(item.日期), close: item.收盘 }))
    .filter((item) => Number.isFinite(item.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  const tranches: SellTrancheDetail[] = [];
  let lastSellDate = '';

  for (let index = 1; index <= count; index += 1) {
    const targetDate = moment(signalDate)
      .add((index - 1) * intervalDays, 'days')
      .format('YYYY-MM-DD');

    // 第 1 批：卖出信号当日
    if (index === 1) {
      lastSellDate = toDateKey(signalDate);
      tranches.push({
        index,
        targetDate,
        sellDate: lastSellDate,
        sellPrice: Number(signalClose.toFixed(2)),
        holdingDays: diffCalendarDays(buyDateKey, lastSellDate),
        returnRate: calculateHoldingReturnRate(buyClose, signalClose, closeValueType),
        executed: true,
      });
      continue;
    }

    // 目标日可能非交易日：顺延到首个 >= 目标日且严格晚于上一批的实际卖出日
    let position = findFirstDateIndex(series, targetDate);
    while (position < series.length && series[position].date <= lastSellDate) {
      position += 1;
    }
    const candidate = series[position];
    if (!candidate) {
      tranches.push({ index, targetDate, executed: false });
      continue;
    }

    lastSellDate = candidate.date;
    tranches.push({
      index,
      targetDate,
      sellDate: candidate.date,
      sellPrice: Number(candidate.close.toFixed(2)),
      holdingDays: diffCalendarDays(buyDateKey, candidate.date),
      returnRate: calculateHoldingReturnRate(buyClose, candidate.close, closeValueType),
      executed: true,
    });
  }

  return tranches;
};

/** 平均收益率：仅统计已执行批次，保留两位小数；无已执行批次时返回 undefined */
export const summarizeSellTranches = (tranches: SellTrancheDetail[]): number | undefined => {
  const rates = tranches
    .filter((tranche) => tranche.executed && tranche.returnRate != null)
    .map((tranche) => tranche.returnRate as number);
  if (!rates.length) return undefined;
  return Number((rates.reduce((sum, rate) => sum + rate, 0) / rates.length).toFixed(2));
};

/**
 * 分析「月 & 季 RSI6 百分位策略」
 *
 * 策略口径：
 * - 买入：月RSI6 与 季RSI6 同时低于各自分位阈值，按分位严度分级（默认 ★5=2% / ★3=5% / ★1=10%，见 appConfig.rsi.monthlyQuarterly.levelRules）
 * - 分位阈值 as-of：判定某月时，阈值只用「该月及之前近 RSI_ASOF_WINDOW_MONTHS 个月（默认 120 个月 = 10 年）」
 *   的 RSI 样本（含当月），不使用该月之后的数据 → 历史买点可复现，不含未来数据；
 *   历史不足 10 年但满 60 个月时使用全部历史；有效样本不足 MQ_MIN_SAMPLE_MONTHS（默认 60 个月）时不产生信号
 * - 季度对齐：每个月取「季初→当月」截断口径的季 RSI6（见 calculateQuarterlyRSI6）——
 *   1 月只用 1 月数据、2 月用 1～2 月数据 …… 不再用未来的季末（3 月）数据回填，
 *   与季RSI6 折线、shared tooltip 的季度查表完全同口径（均按「年月」匹配）
 * - 卖出：持仓中（★5买点）且 月RSI6 与 季RSI6 同时突破各自卖出分位阈值（同样按当月 as-of 窗口计算）、
 *   持有满最低天数（见 MQ_SELL_MIN_HOLDING_DAYS，默认 365 天），
 *   并且收益率达门槛（本策略卖出时均已满最低持有天数，故按年化收益率判定，见 MQ_SELL_MIN_RETURN_PCT）时触发卖出信号；
 *   任一条件不满足则继续持有，等待后续同时满足条件的信号；
 *   后续按 MQ_SELL_TRANCHE_COUNT / MQ_SELL_TRANCHE_INTERVAL_DAYS 分批卖出，各批收益率取平均
 * - 仅 ★5 买点参与卖出配对，顺序配对 ★5买点 → 卖点 → ★5买点 → 卖点 ...
 *
 * @returns 阈值与买点；月/季有效数值任一为空时返回 null
 */
export const analyzeMonthlyQuarterlyPercentile = (
  params: MonthlyQuarterlyPercentileParams,
): MonthlyQuarterlyPercentileResult | null => {
  const {
    monthlyRSI6Data,
    quarterlyRSI6Data,
    warmup = rsiWarmup,
    priceSeries,
    closeValueType = 'price',
  } = params;

  const monthlyArr = (monthlyRSI6Data as RsiKLineData[]).slice(warmup);
  // 季RSI6 为「季初→当月」截断口径序列（已按月产出并剔除预热段），无需再按 warmup 截断
  const quarterlyArr = quarterlyRSI6Data as RsiKLineData[];

  const monthlyValues = monthlyArr
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');
  const quarterlyValues = quarterlyArr
    .map((item) => item.__RSI6__)
    .filter((value): value is number => typeof value === 'number');

  if (!monthlyValues.length || !quarterlyValues.length) {
    return null;
  }

  // as-of 滚动窗口读取器：按月顺序 push，读取时只含「当月及之前、近 10 年」的样本
  const monthlyReader = createRollingPercentileReader(MQ_MIN_SAMPLE_MONTHS);
  const quarterlyReader = createRollingPercentileReader(MQ_MIN_SAMPLE_MONTHS);

  // 季RSI6 与月 K 线一一对应：按「年月」建表（值为当月「季初→当月」截断口径的季 RSI6），
  // 与季RSI6 折线、shared tooltip 查表同口径（均按年月匹配，天然不含未来函数）
  const quarterlyByMonth = new Map<string, RsiKLineData>();
  for (const point of quarterlyArr) {
    quarterlyByMonth.set(moment(point.日期).format('YYYY-MM'), point);
  }

  const buyPoints: MonthlyQuarterlyPercentileBuyPoint[] = [];

  // 持仓状态机：顺序配对 ★5买点 → 卖点 → ★5买点 → 卖点 ...
  let holdingFiveStarBuy: MonthlyQuarterlyPercentileBuyPoint | null = null;

  for (const m of monthlyArr) {
    const monthlyRsi = m.__RSI6__;

    // 当月「季初→当月」截断口径的季 RSI6（当月无季值时不参与判定）
    const currentQuarterly = quarterlyByMonth.get(moment(m.日期).format('YYYY-MM'));
    const quarterlyRsi = currentQuarterly?.__RSI6__;

    // 先入样本（含当月），再读取阈值：保证每个月只用当月及之前、近 10 年窗口内的数据
    if (typeof monthlyRsi === 'number') monthlyReader.push(monthlyRsi, m.日期);
    if (typeof quarterlyRsi === 'number') quarterlyReader.push(quarterlyRsi, m.日期);

    if (typeof monthlyRsi !== 'number' || typeof quarterlyRsi !== 'number') continue;
    // 有效月样本不足门槛时不产生任何买卖信号
    if (
      monthlyReader.size() < MQ_MIN_SAMPLE_MONTHS ||
      quarterlyReader.size() < MQ_MIN_SAMPLE_MONTHS
    ) {
      continue;
    }

    // 当月 as-of 阈值快照（买入分级 + 卖出）
    const { thresholds, sellThresholds } = readMonthlyQuarterlyThresholds(
      monthlyReader,
      quarterlyReader,
    );

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

    // 卖出判断：持仓中且月/季 RSI6 同时触及（≥）卖出分位阈值、持有满最低天数、且收益率达门槛
    // （按年化收益率判定，分界见 appConfig.rsi.annualizeMinHoldingDays）时才平仓；不满足则继续持有等待下一个满足条件的信号
    if (
      holdingFiveStarBuy &&
      monthlyRsi >= sellThresholds.monthly &&
      quarterlyRsi >= sellThresholds.quarterly
    ) {
      const returnRate = calculateHoldingReturnRate(
        holdingFiveStarBuy.收盘,
        m.收盘,
        closeValueType,
      );
      // 用 moment 解析日期，兼容 YYYY-MM-DD / YYYYMMDD；new Date('YYYYMMDD') 会得到 Invalid Date
      const buyTime = moment(holdingFiveStarBuy.日期).valueOf();
      const sellTime = moment(m.日期).valueOf();
      const holdingDays = Math.max(
        1,
        Math.round((sellTime - buyTime) / (24 * 60 * 60 * 1000)),
      );
      // 持有未满最低天数（默认 365 天 ≈ 满 1 年）时不卖出，继续持有等待后续信号
      const holdingDaysMet = holdingDays >= getMinSellHoldingDays();
      // 收益率未达门槛时（按年化收益率判定，分界见 appConfig.rsi.annualizeMinHoldingDays）不卖出，继续持有等待下一个满足条件的信号
      if (holdingDaysMet && isPairSellReturnSatisfied(returnRate, holdingDays, MQ_SELL_MIN_RETURN_PCT)) {
        // 卖出信号成立后按常量分批卖出：各批价格独立取数，收益率取已执行批次的平均
        const sellTranches = buildSellTranches({
          buyDate: holdingFiveStarBuy.日期,
          buyClose: holdingFiveStarBuy.收盘,
          signalDate: m.日期,
          signalClose: m.收盘,
          priceSeries: priceSeries ?? monthlyRSI6Data,
          closeValueType,
        });
        const averageReturnRate = summarizeSellTranches(sellTranches) ?? returnRate;

        holdingFiveStarBuy.sellDate = m.日期;
        holdingFiveStarBuy.sellMonthlyRsi = monthlyRsi;
        holdingFiveStarBuy.sellQuarterlyRsi = quarterlyRsi;
        holdingFiveStarBuy.sellPrice = Number(m.收盘.toFixed(2));
        holdingFiveStarBuy.sellTranches = sellTranches;
        holdingFiveStarBuy.holdingDays = holdingDays;
        holdingFiveStarBuy.returnRate = averageReturnRate;
        // 持有未满最低持有天数（默认 365 天）不计算年化收益率，展示为 --
        holdingFiveStarBuy.annualizedReturn =
          holdingDays >= getMinSellHoldingDays()
            ? calculateAnnualizedReturn(averageReturnRate, holdingDays)
            : null;
        // 平仓后等待下一个★5买点
        holdingFiveStarBuy = null;
      }
    }
  }

  // 最新月近 10 年窗口快照（含最新月自身），供图表水平参考线展示；
  // 月/季按年月对齐建表，正常情况下两个读取器均非空，此处兜底避免空窗口读取
  if (monthlyReader.size() === 0 || quarterlyReader.size() === 0) return null;
  const latest = readMonthlyQuarterlyThresholds(monthlyReader, quarterlyReader);
  return { thresholds: latest.thresholds, sellThresholds: latest.sellThresholds, buyPoints };
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
 * 判断给定日期是否在「近期」（距今天数 <= days）
 * 按日历天比较（剥离时分秒），避免当天已过小时数导致边界偏差
 * @param dateStr 日期字符串（YYYY-MM-DD 或可被 Date 解析的格式）
 * @param days  近几天数，默认取 appConfig.rsi.recentBuyPointDays（默认 100 天）
 * @returns 是否为近期日期
 */
export const isRecentDate = (
  dateStr: string | number | Date,
  days: number = appConfig.rsi.recentBuyPointDays,
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
