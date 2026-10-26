/**
 * stockUtils 通用工具函数测试（补充 asof-rolling.test.ts 未覆盖的纯函数）
 *
 * 运行：cd Front-End && npm test
 */

import moment from 'moment';
import {
  aggregateKLineByPeriod,
  analyzeMonthlyQuarterlyPercentile,
  analyzeSinglePeriodPercentile,
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateFundRecommendationLevel,
  calculateHoldingReturnRate,
  calculatePercentile,
  calculatePercentiles,
  calculateStartDate,
  calculateVolatility,
  filterByFrequency,
  fillHoldingToNow,
  getQuarterKey,
  isRecentDate,
  roundPercentile,
} from '../src/utils/stockUtils';
import type { KLineData, MonthlyQuarterlyPercentileBuyPoint } from '../src/utils/stockUtils';
import { appConfig } from '../src/config/appConfig';
import { approx, assert, eq, summary } from './testUtils';

// ============================================================
// A. filterByFrequency — 4
// ============================================================
console.log('\n── A. filterByFrequency ──');
{
  const rows = [
    { date: '2024-01-05', value: 1 },
    { date: '2024-01-31', value: 2 },
    { date: '2024-02-10', value: 3 },
  ];
  const monthly = filterByFrequency(rows, 'date', 'monthly');
  eq(monthly.length, 2, 'A1 两个月 → 2 条');
  eq(monthly[0].value, 2, 'A2 1 月取最晚一条');
  eq(monthly[1].value, 3, 'A3 2 月唯一一条保留');
}
{
  const rows = [{ date: '2024-01-31', value: 1 }, { date: '2024-01-05', value: 2 }];
  eq(filterByFrequency(rows, 'date', 'monthly')[0].value, 1, 'A4 输入乱序时仍取当月最晚一条');
}
{
  const rows = [{ date: '2024-01-01', value: 1 }];
  assert(filterByFrequency(rows, 'date', 'daily') === rows, 'A5 daily 原样返回同一数组引用');
}
{
  eq(filterByFrequency(undefined, 'date').length, 0, 'A6 undefined → 空数组');
}

// ============================================================
// B. calculateStartDate — 4
// ============================================================
console.log('\n── B. calculateStartDate ──');
{
  eq(calculateStartDate(''), '', 'B1 空发布日期 → 空串');
  eq(calculateStartDate('20100104', '上市以来'), '20100104', 'B2 上市以来 → 发布日');
  const expected3y = moment().subtract(3, 'years').format('YYYYMMDD');
  eq(calculateStartDate('20100104', '3年'), expected3y, 'B3 3年 → 当前日期回推 3 年');
  const recentPublish = moment().subtract(1, 'year').format('YYYYMMDD');
  eq(calculateStartDate(recentPublish, '10年'), recentPublish, 'B4 区间起点早于发布日时收敛到发布日');
}

// ============================================================
// C. 分位函数 — 7
// ============================================================
console.log('\n── C. 分位函数 ──');
{
  const empty = calculatePercentiles([], 'x');
  eq(empty.percentile15, null, 'C1 空数组 15% 分位为 null');
  eq(empty.percentile85, null, 'C2 空数组 85% 分位为 null');
}
{
  const result = calculatePercentiles(
    [{ x: 10 }, { x: 20 }, { x: 30 }, { x: 40 }, { x: Number.NaN }, { x: 'bad' as unknown as number }],
    'x',
  );
  eq(result.percentile15, 10, 'C3 15% 分位（floor 索引）');
  eq(result.percentile85, 40, 'C4 85% 分位（floor 索引）且忽略非法值');
}
{
  eq(calculatePercentile([], 50), 0, 'C5 空序列分位返回 0');
  eq(calculatePercentile([10], 25), 10, 'C6 单元素任意分位返回该值');
  // [1,2,3,4] 的 50%：ceil(0.5*4)-1 = 1 → 2
  eq(calculatePercentile([1, 2, 3, 4], 50), 2, 'C7 最近秩 50% 分位');
  eq(calculatePercentile([1, 2, 3, 4], 0), 1, 'C8 0% 分位兜底为最小值');
  eq(roundPercentile([1, 2, 3, 100], 95), 100, 'C9 roundPercentile 保留两位小数口径');
}

// ============================================================
// D. calculateAnnualizedReturn — 6
// ============================================================
console.log('\n── D. calculateAnnualizedReturn ──');
{
  eq(calculateAnnualizedReturn(null, 365), null, 'D1 收益率为 null → null');
  eq(calculateAnnualizedReturn(10, 0), null, 'D2 持有 0 天 → null');
  eq(calculateAnnualizedReturn(-100, 365), null, 'D3 亏损 100% → null');
  eq(calculateAnnualizedReturn(100, 365), 100, 'D4 365 天翻倍 → 100%');
  eq(calculateAnnualizedReturn(-50, 365), -50, 'D5 365 天亏半 → -50%');
  approx(calculateAnnualizedReturn(21, 730) as number, 10, 'D6 两年 +21% → 年化约 10%', 0.01);
}

// ============================================================
// E. calculateHoldingReturnRate — 6
// ============================================================
console.log('\n── E. calculateHoldingReturnRate ──');
{
  eq(calculateHoldingReturnRate(100, 120), 20, 'E1 price：100 → 120 = 20%');
  eq(calculateHoldingReturnRate(120, 90), -25, 'E2 price：120 → 90 = -25%');
  eq(calculateHoldingReturnRate(0, 100), 0, 'E3 price 买入价为 0 时兜底 0');
  eq(calculateHoldingReturnRate(-50, -25, 'cumulativeReturn'), 50, 'E4 累计收益率 -50 → -25 = 50%');
  eq(calculateHoldingReturnRate(-50, 0, 'cumulativeReturn'), 100, 'E5 累计收益率 -50 → 0 = 100%');
  eq(calculateHoldingReturnRate(-100, 0, 'cumulativeReturn'), 0, 'E6 买入累计收益率 -100（净值 0）兜底 0');
}

// ============================================================
// F. 波动率 — 5
// ============================================================
console.log('\n── F. 波动率 ──');
{
  const short = calculateVolatility({ data: [{ 日期: '2024-01-01', 净值: 1 }], navKey: '净值', dateKey: '日期' });
  eq(short[0].__波动率__, 0, 'F1 数据量不足周期 → 波动率 0');
}
{
  const data = Array.from({ length: 21 }, (_, i) => ({
    日期: moment('2024-01-01').add(i, 'days').format('YYYY-MM-DD'),
    净值: i % 2 === 0 ? 100 : 110,
  }));
  const result = calculateVolatility({ data, navKey: '净值', dateKey: '日期', period: 20 });
  const vols = result.map(item => item.__波动率__);
  assert(vols.slice(0, 19).every(value => value === 0), 'F2 前 period-1 个点波动率为 0');
  assert(vols[19] > 0 && vols[20] > 0, 'F3 满周期后涨跌交替序列波动率大于 0');
}
{
  const data = Array.from({ length: 25 }, (_, i) => ({
    日期: moment('2024-01-01').add(i, 'days').format('YYYY-MM-DD'),
    净值: 100 * Math.pow(1.1, i),
  }));
  const result = calculateVolatility({ data, navKey: '净值', dateKey: '日期', period: 20 });
  approx(result[24].__波动率__, 0, 'F4 恒定日增长率序列的滚动波动率为 0', 1e-9);
}
{
  approx(calculateAnnualizedVolatility(10), 158.75, 'F5 日频默认按 √252 年化', 0.01);
  approx(calculateAnnualizedVolatility(10, 12), 34.64, 'F6 月频按 √12 年化', 0.01);
}

// ============================================================
// G. aggregateKLineByPeriod — 7
// ============================================================
console.log('\n── G. aggregateKLineByPeriod ──');
{
  const daily: KLineData[] = [
    { 日期: '2024-01-01', 开盘: 10, 最高: 12, 最低: 9, 收盘: 11, 成交量: 100, 成交额: 1000 },
    { 日期: '2024-01-02', 开盘: 11, 最高: 13, 最低: 10, 收盘: 12, 成交量: 200, 成交额: 2000 },
    { 日期: '2024-01-08', 开盘: 12, 最高: 14, 最低: 11, 收盘: 13, 成交量: 300, 成交额: 3000 },
  ];
  const weekly = aggregateKLineByPeriod({ dailyData: daily, period: 'weekly' });
  eq(weekly.length, 2, 'G1 两周 → 2 条周 K');
  eq(weekly[0].日期, '2024-01-02', 'G2 周 K 日期取该周最后一天');
  eq(weekly[0].开盘, 10, 'G3 周 K 开盘取该周首日开盘');
  eq(weekly[0].最高, 13, 'G4 周 K 最高取该周最大值');
  eq(weekly[0].最低, 9, 'G5 周 K 最低取该周最小值');
  eq(weekly[0].收盘, 12, 'G6 周 K 收盘取该周最后一天收盘');
  eq(weekly[0].成交量, 300, 'G7 周 K 成交量求和');
}
{
  const daily: KLineData[] = [
    { 日期: '2024-01-31', 收盘: 10 },
    { 日期: '2024-02-29', 收盘: 20 },
    { 日期: '2024-04-30', 收盘: 30 },
  ];
  eq(aggregateKLineByPeriod({ dailyData: daily, period: 'monthly' }).length, 3, 'G8 月 K 按月分组');
  eq(aggregateKLineByPeriod({ dailyData: daily, period: 'quarterly' }).length, 2, 'G9 季 K 按季度分组');
  eq(aggregateKLineByPeriod({ dailyData: [], period: 'monthly' }).length, 0, 'G10 空数据 → 空数组');
}
{
  const crossYear: KLineData[] = [
    { 日期: '2014-12-29', 收盘: 10 },
    { 日期: '2014-12-31', 收盘: 11 },
    { 日期: '2015-01-02', 收盘: 12 },
  ];
  const weekly = aggregateKLineByPeriod({ dailyData: crossYear, period: 'weekly' });
  eq(weekly.length, 1, 'G11 跨年同周按 ISO weekYear 归为一组');
  eq(weekly[0].日期, '2015-01-02', 'G12 跨年周 K 日期取该周最后一天');
}

// ============================================================
// H. getQuarterKey — 4
// ============================================================
console.log('\n── H. getQuarterKey ──');
{
  eq(getQuarterKey('2024-01-15'), '2024-Q1', 'H1 1 月 → Q1');
  eq(getQuarterKey('2024-03-31'), '2024-Q1', 'H2 3 月 → Q1');
  eq(getQuarterKey('2024-04-01'), '2024-Q2', 'H3 4 月 → Q2');
  eq(getQuarterKey('2024-12-31'), '2024-Q4', 'H4 12 月 → Q4');
}

// ============================================================
// I. fillHoldingToNow — 4
// ============================================================
console.log('\n── I. fillHoldingToNow ──');
{
  const sold = {
    日期: '2020-01-01', 收盘: 100, monthlyRsi: 10, quarterlyRsi: 10, level: 5,
    sellDate: '2021-01-01', sellPrice: 120,
  } as MonthlyQuarterlyPercentileBuyPoint;
  const open = {
    日期: '2021-01-01', 收盘: 100, monthlyRsi: 10, quarterlyRsi: 10, level: 5,
  } as MonthlyQuarterlyPercentileBuyPoint;
  fillHoldingToNow([sold, open], '2022-01-01', 120, 'price');
  eq(sold.latestDate, '2022-01-01', 'I1 已卖出买点也写入最新交易日');
  eq(sold.latestClose, 120, 'I2 已卖出买点写入最新收盘');
  eq(sold.holdingDaysToNow, undefined, 'I3 已卖出买点不写「持有至今」天数');
  eq(open.holdingDaysToNow, 365, 'I4 未卖出买点写「持有至今」天数');
  eq(open.returnRateToNow, 20, 'I5 未卖出买点写「持有至今」收益率（price）');
}
{
  const open = {
    日期: '2021-01-01', 收盘: 0, monthlyRsi: 10, quarterlyRsi: 10, level: 5,
  } as MonthlyQuarterlyPercentileBuyPoint;
  fillHoldingToNow([open], '2022-01-01', 20, 'cumulativeReturn');
  eq(open.returnRateToNow, 20, 'I6 未卖出买点「持有至今」收益率按累计收益率口径');
}

// ============================================================
// J. 基金推荐级别规则 — 4
// ============================================================
console.log('\n── J. 基金推荐级别规则 ──');
{
  eq(calculateFundRecommendationLevel(undefined, undefined, 10, 15), 5, 'J1 月 10 / 季 15 → ★5');
  eq(calculateFundRecommendationLevel(undefined, undefined, 10, 16), 3, 'J2 月 10 / 季 16 → ★3');
  eq(calculateFundRecommendationLevel(undefined, undefined, 30, 30), null, 'J3 月 30 / 季 30 → 无级别');
  eq(calculateFundRecommendationLevel(undefined, undefined, undefined, undefined), null, 'J4 缺失 RSI → 无级别');
}

// ============================================================
// K. isRecentDate — 4
// ============================================================
console.log('\n── K. isRecentDate ──');
{
  const days = appConfig.rsi.recentBuyPointDays;
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  const longAgo = moment().subtract(days + 10, 'days').format('YYYY-MM-DD');
  const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
  assert(isRecentDate(today), 'K1 今天属于近期');
  assert(isRecentDate(yesterday), 'K2 昨天属于近期');
  assert(!isRecentDate(longAgo), 'K3 超出窗口的历史日期不属于近期');
  assert(!isRecentDate(tomorrow), 'K4 未来日期不属于近期');
  assert(!isRecentDate(''), 'K5 空日期返回 false');
}

// ============================================================
// L. YYYYMMDD 日期兼容（回归：new Date('YYYYMMDD') 会得到 Invalid Date）— 7
// ============================================================
console.log('\n── L. YYYYMMDD 日期兼容 ──');
{
  type RsiRow = KLineData & { __RSI6__: number };
  const rsiRows: RsiRow[] = [];
  const priceRows: KLineData[] = [];
  // 6 个预热点 + 60 个递增填充点（填充期不触发买入）+ 买入点 + 11 期持有 + 卖出点
  for (let i = 0; i < 79; i += 1) {
    const date = moment('2010-01-31').add(i, 'months').endOf('month').format('YYYYMMDD');
    let rsi = 50;
    let close = 100;
    if (i >= 6 && i < 66) rsi = 50 + ((i - 6) / 59) * 29; // 50 → 79 递增，避免触发买入
    else if (i === 66) rsi = 5; // 买入点：跌破买入分位
    else if (i >= 67 && i < 78) {
      rsi = 60;
      close = 100 + (i - 66) * 2;
    } else if (i >= 78) {
      rsi = 95; // 卖出点：突破卖出分位
      close = 130;
    }
    rsiRows.push({ 日期: date, 收盘: close, __RSI6__: Number(rsi.toFixed(2)) });
    priceRows.push({ 日期: date, 收盘: close });
  }
  // 卖出信号后继续补充价格，供 4 批分批卖出取价
  for (let i = 79; i <= 83; i += 1) {
    priceRows.push({
      日期: moment('2010-01-31').add(i, 'months').endOf('month').format('YYYYMMDD'),
      收盘: 130 + (i - 78) * 5,
    });
  }

  const { monthly: monthlyCfg } = appConfig.rsi.singlePeriod;
  const single = analyzeSinglePeriodPercentile({
    rsiData: rsiRows,
    buyPercentile: monthlyCfg.buyPercentile,
    sellPercentile: monthlyCfg.sellPercentile,
  });
  eq(single.trades.length, 1, 'L1 YYYYMMDD 序列产生一笔单周期交易');
  const trade = single.trades[0];
  eq(trade.status, '已平仓', 'L2 YYYYMMDD 日期可正常触发卖出（旧实现 new Date 为 Invalid Date）');
  eq(trade.buyDate, '20150731', 'L3 买入日保留原始 YYYYMMDD 格式');
  eq(trade.sellDate, '20160731', 'L4 卖出日按 12 个月后触发');
  eq(trade.holdingDays, 366, 'L5 持有天数为有限数值（非 NaN）');
  approx(trade.returnRate ?? -1, 30, 'L6 区间收益率 100 → 130 = 30%', 0.01);
  assert((trade.annualizedReturn ?? 0) > 10, 'L7 年化收益率已计算且为正');

  const mq = analyzeMonthlyQuarterlyPercentile({
    monthlyRSI6Data: rsiRows,
    quarterlyRSI6Data: rsiRows.map(row => ({ ...row })),
    priceSeries: priceRows,
  });
  assert(mq != null, 'M1 月&季共振分析返回非空结果');
  const fiveStar = (mq?.buyPoints ?? []).filter(point => point.level === 5);
  eq(fiveStar.length, 1, 'M2 YYYYMMDD 序列产生 1 个 ★5 买点');
  const point = fiveStar[0];
  eq(point?.sellDate, '20160731', 'M3 ★5 在满 365 天后触发卖出（旧实现持有天数为 NaN 永不卖出）');
  eq(point?.holdingDays, 366, 'M4 ★5 持有天数为有限数值（非 NaN）');
  eq(point?.sellTranches?.length, appConfig.rsi.monthlyQuarterly.trancheCount, 'M5 分批卖出批次与配置一致');
  assert((point?.returnRate ?? 0) > 15, 'M6 ★5 卖出收益率超过门槛');
  assert((point?.annualizedReturn ?? 0) > 5, 'M7 ★5 卖出年化收益率已计算');
}

summary();
