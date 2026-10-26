/**
 * buyPointCompute（Worker 纯计算内核）测试
 *
 * 覆盖：个股/指数日线路径、基金累计收益率路径、空数据、结构完整性、
 * ★5 卖出三重条件与分批卖出一致性、回撤派生字段、确定性。
 *
 * 运行：cd Front-End && npm test
 */

import moment from 'moment';
import { runBuyPointTask } from '../src/utils/buyPointCompute';
import type { BuyPointFundItem, BuyPointKLineItem, BuyPointResult } from '../src/utils/buyPointCompute';
import { getMinSellHoldingDays, getSellTrancheCount, summarizeSellTranches } from '../src/utils/stockUtils';
import type { SellTrancheDetail } from '../src/utils/stockUtils';
import { assert, eq, summary } from './testUtils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const splitDates = (text: string): string[] => (text ? text.split(',') : []);

/**
 * 构造 110 个月的目标月收盘价：
 * - 前 80 个月按月间隔 ±3% 震荡（让 RSI 分布分散）
 * - 第 81~86 个月连续下跌 4%（制造 ★5 极低 RSI 买点）
 * - 之后每月涨 8%（持续 24 个月，制造超买并满足满 1 年后的卖出条件）
 *
 * 注：季 RSI6 序列要累计满 60 个月有效样本才出信号（约 6 个季度预热 + 60 个月），
 * 因此历史长度必须显著超过 80 个月，否则买点断言会退化为真空。
 */
const buildMonthlyCloses = (): number[] => {
  const closes: number[] = [];
  let price = 100;
  for (let i = 0; i < 110; i += 1) {
    if (i < 80) price *= 1 + 0.03 * Math.sin((i * Math.PI) / 3);
    else if (i < 86) price *= 0.96;
    else price *= 1.08;
    closes.push(Number(price.toFixed(2)));
  }
  return closes;
};

/** 把月收盘目标值展开为工作日日线（月内线性插值，保证每月最后一天收盘 = 目标值） */
const buildDailyFromMonthly = (monthlyCloses: number[]): BuyPointKLineItem[] => {
  const daily: BuyPointKLineItem[] = [];
  let prevClose = 100;
  monthlyCloses.forEach((target, monthIndex) => {
    const monthStart = moment('2005-01-01').add(monthIndex, 'months').startOf('month');
    const days: moment.Moment[] = [];
    for (let day = 1; day <= monthStart.daysInMonth(); day += 1) {
      const d = monthStart.clone().date(day);
      if (d.day() !== 0 && d.day() !== 6) days.push(d);
    }
    days.forEach((d, i) => {
      const close = prevClose + (target - prevClose) * ((i + 1) / days.length);
      daily.push({ 日期: d.format('YYYYMMDD'), 收盘: Number(close.toFixed(2)) });
    });
    prevClose = target;
  });
  return daily;
};

const monthlyCloses = buildMonthlyCloses();
const dailyData = buildDailyFromMonthly(monthlyCloses);
const monthlyDates = Array.from(
  new Set(dailyData.map(item => moment(item.日期).format('YYYY-MM-DD'))),
);
const lastDaily = dailyData[dailyData.length - 1];

/** 公共结构断言 */
const assertCommonStructure = (result: BuyPointResult, label: string): void => {
  ['quantitative', 'percentile', 'monthlyPercentile'].forEach(key => {
    splitDates(result[key as 'quantitative']).forEach(date => {
      assert(DATE_RE.test(date), `${label} ${key} 日期格式 YYYY-MM-DD（${date}）`);
    });
  });
  eq(
    result.percentile,
    result.mqBuyPoints.map(point => moment(point.日期).format('YYYY-MM-DD')).join(','),
    `${label} percentile 与 mqBuyPoints 日期一一对应`,
  );
  result.mqBuyPoints.forEach(point => {
    assert([1, 3, 5].includes(point.level), `${label} 买点级别合法（${point.level}）`);
    assert(point.monthlyRsi >= 0 && point.monthlyRsi <= 100, `${label} 买入月 RSI6 在 0~100`);
    assert(point.quarterlyRsi >= 0 && point.quarterlyRsi <= 100, `${label} 买入季 RSI6 在 0~100`);
    assert(DATE_RE.test(moment(point.日期).format('YYYY-MM-DD')), `${label} mqBuyPoint 日期合法`);
  });
};

// ============================================================
// A. 空数据 — 3
// ============================================================
console.log('\n── A. 空数据 ──');
{
  const stockEmpty = runBuyPointTask({ type: 'stock', rawData: [] });
  eq(stockEmpty.quantitative, '', 'A1 个股空数据 quantitative 为空串');
  eq(stockEmpty.percentile, '', 'A2 个股空数据 percentile 为空串');
  eq(stockEmpty.mqBuyPoints.length, 0, 'A3 个股空数据 mqBuyPoints 为空');
  eq(stockEmpty.weeklyPercentile, '', 'A4 个股空数据 weeklyPercentile 为空串');
}
{
  const fundEmpty = runBuyPointTask({ type: 'fund', rawData: [] });
  eq(fundEmpty.monthlyPercentile, '', 'A5 基金空数据 monthlyPercentile 为空串');
  eq(fundEmpty.mqBuyPoints.length, 0, 'A6 基金空数据 mqBuyPoints 为空');
}

// ============================================================
// B. 个股日线路径 — 12
// ============================================================
console.log('\n── B. 个股日线路径 ──');
const stockResult = runBuyPointTask({ type: 'stock', rawData: dailyData });
{
  assertCommonStructure(stockResult, 'B');
  assert(stockResult.mqBuyPoints.length > 0, 'B1 合成日线产生月&季共振买点（非真空）');
  assert(splitDates(stockResult.weeklyPercentile).length > 0, 'B2 数据量足够时周 RSI6 策略有买入信号');
  assert(splitDates(stockResult.monthlyPercentile).length > 0, 'B3 月 RSI6 策略有买入信号');

  const dailyDateSet = new Set(monthlyDates);
  splitDates(stockResult.weeklyPercentile).forEach(date => {
    assert(dailyDateSet.has(date), `B4 周策略买入日来自日线序列（${date}）`);
  });
  splitDates(stockResult.monthlyPercentile).forEach(date => {
    assert(dailyDateSet.has(date), `B5 月策略买入日来自日线序列（${date}）`);
  });

  const fiveStar = stockResult.mqBuyPoints.filter(point => point.level === 5);
  assert(fiveStar.length > 0, 'B6 合成数据产生 ★5 买点（非真空）');

  const soldFiveStar = fiveStar.filter(point => point.sellDate != null);
  assert(soldFiveStar.length > 0, 'B7 合成数据完成至少一次 ★5 买卖配对（非真空）');
  soldFiveStar.forEach(point => {
    const sellDate = moment(point.sellDate).format('YYYY-MM-DD');
    const buyDate = moment(point.日期).format('YYYY-MM-DD');
    assert(sellDate >= buyDate, `B8 卖出日晚于买入日（${buyDate} → ${sellDate}）`);
    assert(
      (point.holdingDays ?? 0) >= getMinSellHoldingDays(),
      `B9 ★5 卖出满足最低持有天数（${point.holdingDays} ≥ ${getMinSellHoldingDays()}）`,
    );
    assert(point.returnRate != null, 'B10 ★5 卖出有平均收益率');
    const tranches: SellTrancheDetail[] = point.sellTranches ?? [];
    eq(tranches.length, getSellTrancheCount(), 'B11 分批卖出批次数与配置一致');
    const executed = tranches.filter(tranche => tranche.executed);
    assert(executed.length > 0, 'B12 至少第 1 批已执行');
    let strictlyIncreasing = true;
    for (let i = 1; i < executed.length; i += 1) {
      if ((executed[i].sellDate ?? '') <= (executed[i - 1].sellDate ?? '')) strictlyIncreasing = false;
    }
    assert(strictlyIncreasing, 'B13 已执行批次卖出日严格递增');
    if (point.returnRate != null) {
      eq(point.returnRate, summarizeSellTranches(tranches) ?? point.returnRate, 'B14 平均收益率 = 已执行批次算术平均');
    }
    assert(point.annualizedReturn != null, 'B15 满最低持有天数后年化收益率已计算');
    if (point.maxDrawdown != null) {
      assert(point.maxDrawdown > 0, 'B16 最大回撤为正数百分比');
      assert((point.maxDrawdownClose ?? Number.POSITIVE_INFINITY) < point.收盘, 'B17 回撤低点收盘价低于买入价');
      assert((point.daysToMaxDrawdown ?? -1) >= 0, 'B18 被套天数非负');
    }
  });

  const openFiveStar = fiveStar.filter(point => point.sellDate == null);
  if (openFiveStar.length > 0) {
    const latestDate = moment(lastDaily.日期).format('YYYY-MM-DD');
    openFiveStar.forEach(point => {
      eq(point.latestDate, latestDate, 'B19 未卖出买点写入最新交易日');
      eq(point.latestClose, lastDaily.收盘, 'B20 未卖出买点写入最新收盘价');
      assert((point.holdingDaysToNow ?? 0) >= 1, 'B21 未卖出买点有持有至今天数');
      assert(point.returnRateToNow != null, 'B22 未卖出买点有持有至今收益率');
    });
  } else {
    assert(true, 'B19 当前合成数据无未卖出 ★5（跳过持有至今断言）');
  }
}
{
  const again = runBuyPointTask({ type: 'stock', rawData: dailyData });
  eq(JSON.stringify(again), JSON.stringify(stockResult), 'B23 同一输入两次计算结果完全一致（确定性）');
}

// ============================================================
// C. 基金累计收益率路径 — 10
// ============================================================
console.log('\n── C. 基金累计收益率路径 ──');
const fundData: BuyPointFundItem[] = monthlyCloses.map((close, index) => ({
  日期: moment('2005-01-01').add(index, 'months').endOf('month').format('YYYY-MM-DD'),
  累计收益率: Number(((close / monthlyCloses[0]) * 100 - 100).toFixed(2)),
}));
const fundResult = runBuyPointTask({ type: 'fund', rawData: fundData });
{
  eq(fundResult.weeklyPercentile, '', 'C1 基金无周数据 → weeklyPercentile 恒为空串');
  assertCommonStructure(fundResult, 'C');
  const fundMonthSet = new Set(fundData.map(item => item.日期));
  splitDates(fundResult.monthlyPercentile).forEach(date => {
    assert(fundMonthSet.has(date), `C2 月策略买入日来自基金月度序列（${date}）`);
  });

  const fiveStar = fundResult.mqBuyPoints.filter(point => point.level === 5);
  assert(fiveStar.length > 0, 'C3 基金合成数据产生 ★5 买点（非真空）');
  const sold = fiveStar.filter(point => point.sellDate != null);
  sold.forEach(point => {
    assert(
      (point.holdingDays ?? 0) >= getMinSellHoldingDays(),
      `C4 基金 ★5 卖出满足最低持有天数（${point.holdingDays}）`,
    );
    eq((point.sellTranches ?? []).length, getSellTrancheCount(), 'C5 基金分批卖出批次与配置一致');
    if (point.maxDrawdown != null) {
      assert(point.maxDrawdown > 0, 'C6 基金最大回撤为正数百分比');
      assert((point.maxDrawdownClose ?? Number.POSITIVE_INFINITY) < point.收盘, 'C7 基金回撤低点按净值口径低于买入值');
    }
    assert(point.annualizedReturn != null, 'C8 基金满最低持有天数后年化收益率已计算');
  });
  if (sold.length === 0) {
    assert(true, 'C4 当前基金合成数据无已配对卖出（跳过卖出断言）');
  }

  const againFund = runBuyPointTask({ type: 'fund', rawData: fundData });
  eq(JSON.stringify(againFund), JSON.stringify(fundResult), 'C9 基金同一输入两次计算结果完全一致（确定性）');
  eq(fundResult.quantitative.split(',').filter(Boolean).every(date => DATE_RE.test(date)), true, 'C10 基金定量买点日期格式合法');
}

// ============================================================
// D. 类型分支 — 3
// ============================================================
console.log('\n── D. 类型分支 ──');
{
  const indexResult = runBuyPointTask({ type: 'index', rawData: dailyData });
  const commodityResult = runBuyPointTask({ type: 'commodity', rawData: dailyData });
  assert(Array.isArray(indexResult.mqBuyPoints), 'D1 index 分支返回完整结构');
  assert(Array.isArray(commodityResult.mqBuyPoints), 'D2 commodity 分支返回完整结构');
  // 三类 K 线路径共用同一内核，仅推荐级别规则不同；结构字段必须齐全
  const keys: (keyof BuyPointResult)[] = ['quantitative', 'percentile', 'monthlyPercentile', 'weeklyPercentile', 'mqBuyPoints'];
  keys.forEach(key => {
    assert(indexResult[key] !== undefined && commodityResult[key] !== undefined, `D3 ${key} 字段存在`);
  });
}

summary();
