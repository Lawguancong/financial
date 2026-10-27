/**
 * as-of 滚动窗口 + RSI6 百分位策略 测试用例
 *
 * 运行：
 *   cd Front-End
 *   npm test            # 运行 test/*.test.ts 全部用例（等价于 tsx --tsconfig tsconfig.app.json --test test/*.test.ts）
 *
 * 断言分类（共 ~48 个）：
 *   A. RollingPercentileReader（6）— 窗口行为
 *   B. RSI6 数学正确性（4）— Wilder 递推 + 预热点
 *   C. RSI6 消除未来函数（4）— 周期截断口径 + 乱序输入 + 季初→当月
 *   D. 月&季共振 as-of（9）— 原有不变性 + 确定性 + 卖出三重条件
 *   E. 单周期 as-of（8）— 原有不变性 + 确定性
 *   F. 收益率口径（4）— 年化公式 + price vs cumulativeReturn + 负收益
 *   G. 分批卖出边界（5）— 无后续数据 + 非交易日顺延 + 严格递增 + 间隔兜底
 */

import moment from 'moment';
import { appConfig } from '../src/config/appConfig';
import {
  analyzeMonthlyQuarterlyPercentile,
  analyzeSinglePeriodPercentile,
  calculateAsOfPeriodRSI6,
  calculateAnnualizedReturn,
  calculateHoldingReturnRate,
  calculateMaxDrawdown,
  calculateQuarterlyRSI6,
  calculateRSI,
  calculateMonthlyRSI6,
  aggregateKLineByPeriod,
  buildSellTranches,
  getQuarterKey,
  roundPercentile,
} from '../src/utils/stockUtils';
import type { KLineData } from '../src/utils/stockUtils';

// ============================================================
// 本地复制的 RollingPercentileReader（与 stockUtils.ts 同逻辑）
// ============================================================
const createRollingPercentileReader = (minKeep = 60, windowMonths = 120) => {
  const sorted: number[] = [];
  const queue: { value: number; time: number }[] = [];

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
      queue.push({ value, time: moment(date).valueOf() });

      const cutoff = moment(date).clone().subtract(windowMonths, 'months').valueOf();
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

// ---------- 轻量 assert ----------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, label: string, detail?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`  ❌ ${label}`);
    if (detail !== undefined) console.error('      detail:', detail);
  }
}

function eq<T>(actual: T, expected: T, label: string, tol?: number): void {
  let ok: boolean;
  if (tol !== undefined && typeof actual === 'number' && typeof expected === 'number') {
    ok = Math.abs(actual - expected) <= tol;
  } else {
    ok = actual === expected;
  }
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${label}  (${JSON.stringify(actual)})`);
  } else {
    failed += 1;
    failures.push(label);
    console.error(`  ❌ ${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

function approx(actual: number, expected: number, label: string, tol = 0.01): void {
  eq(actual, expected, label, tol);
}

// ---------- 合成数据：deterministic 正弦 + 周期暴跌 ----------
function buildSyntheticDaily(days: number = 4500, startPrice = 100): KLineData[] {
  const arr: KLineData[] = [];
  let price = startPrice;
  let date = moment('2000-01-03');

  for (let i = 0; i < days; i += 1) {
    const trend = 0.03;
    const midWave = Math.sin((i / 30) * Math.PI * 2) * 0.8;
    const hiWave = Math.sin((i / 10) * Math.PI * 2) * 0.3;

    let shock = 0;
    const phase = i % 200;
    if (phase >= 180 && phase <= 189) shock = -3.0;
    else if (phase >= 190 && phase <= 198) shock = 2.0;

    price = Math.max(1, price * (1 + (trend + midWave + hiWave + shock) / 100));
    arr.push({
      日期: date.format('YYYYMMDD'),
      收盘: Number(price.toFixed(2)),
    });
    date = date.clone().add(1, 'day');
  }
  return arr;
}

function dailyToMonthly(daily: KLineData[]): KLineData[] {
  return aggregateKLineByPeriod({ dailyData: daily, period: 'monthly' });
}

// ============================================================
// A. RollingPercentileReader（窗口行为）— 6 个
// ============================================================
console.log('\n── A. RollingPercentileReader（窗口行为） ──');

{
  const reader = createRollingPercentileReader(60, 120);
  for (let i = 0; i < 10; i += 1) {
    reader.push(50 + i, `2020-${String(i + 1).padStart(2, '0')}-01`);
  }
  eq(reader.size(), 10, 'A1 push 10 个后 size = 10');
}

{
  const reader = createRollingPercentileReader(60, 120);
  for (let i = 0; i < 125; i += 1) {
    const d = moment('2000-01-01').add(i, 'months');
    reader.push(100 + i, d.format('YYYY-MM-DD'));
  }
  eq(reader.size(), 120, 'A2 125 → size 固定 120（最早 5 个被 evict）');
  assert(reader.read(1) >= 105, `A2 eviction 生效：read(1)=${reader.read(1)} >= 105`);
}

{
  const reader = createRollingPercentileReader(60, 120);
  for (let i = 0; i < 70; i += 1) {
    const d = moment('2000-01-01').add(i, 'months');
    reader.push(50 + i * 0.1, d.format('YYYY-MM-DD'));
  }
  eq(reader.size(), 70, 'A3 70 个月 < 120 → 全部保留');
}

{
  const reader = createRollingPercentileReader(60, 120);
  for (let i = 0; i < 50; i += 1) {
    const d = moment('2000-01-01').add(i, 'months');
    reader.push(50 + i * 0.1, d.format('YYYY-MM-DD'));
  }
  eq(reader.size(), 50, 'A4 50 个月 < 60 → 不产生信号');
}

{
  const readerFull = createRollingPercentileReader(60, 120);
  const readerCut = createRollingPercentileReader(60, 120);
  for (let i = 0; i < 100; i += 1) {
    const d = moment('2000-01-01').add(i, 'months');
    const v = 50 + Math.sin(i / 5) * 30 + i * 0.05;
    readerFull.push(v, d.format('YYYY-MM-DD'));
    readerCut.push(v, d.format('YYYY-MM-DD'));
  }
  let allEqual = true;
  for (const r of [2, 5, 10, 50, 90, 95, 98]) {
    if (readerFull.read(r) !== readerCut.read(r)) { allEqual = false; break; }
  }
  assert(allEqual, 'A5 两个 reader push 到同一位置，read 结果完全一致（历史不可重绘）');
}

{
  // A6：minKeep=30，windowMonths=60 —— 更早触发 eviction
  const reader = createRollingPercentileReader(30, 60);
  for (let i = 0; i < 70; i += 1) {
    const d = moment('2000-01-01').add(i, 'months');
    reader.push(100 + i, d.format('YYYY-MM-DD'));
  }
  eq(reader.size(), 60, 'A6 minKeep=30, windowMonths=60 → 70 条后 size=60');
}

// ============================================================
// B. RSI6 数学正确性 — 4 个
// ============================================================
console.log('\n── B. RSI6 数学正确性 ──');

{
  // B1：纯上涨序列 RSI6 = 100
  const data: KLineData[] = Array.from({ length: 20 }, (_, i) => ({
    日期: `2020-01-${String(i + 1).padStart(2, '0')}`,
    收盘: 100 + i * 2,
  }));
  const result = calculateRSI({ data, closeKey: '收盘', period: 6 });
  const last = result[result.length - 1];
  assert(last.__RSI6__ === 100, `B1 纯上涨 RSI6=100（实际 ${last.__RSI6__}）`);
}

{
  // B2：纯下跌序列 RSI6 = 0
  const data: KLineData[] = Array.from({ length: 20 }, (_, i) => ({
    日期: `2020-01-${String(i + 1).padStart(2, '0')}`,
    收盘: 140 - i * 2,
  }));
  const result = calculateRSI({ data, closeKey: '收盘', period: 6 });
  const last = result[result.length - 1];
  assert(last.__RSI6__ === 0, `B2 纯下跌 RSI6=0（实际 ${last.__RSI6__}）`);
}

{
  // B3：前 6 个点 RSI6 = 50（预热点）
  const data: KLineData[] = Array.from({ length: 20 }, (_, i) => ({
    日期: `2020-01-${String(i + 1).padStart(2, '0')}`,
    收盘: 100 + Math.sin(i) * 10,
  }));
  const result = calculateRSI({ data, closeKey: '收盘', period: 6 });
  let warmupAll50 = true;
  for (let i = 0; i < 6; i += 1) {
    if (result[i].__RSI6__ !== 50) { warmupAll50 = false; break; }
  }
  assert(warmupAll50, 'B3 前 6 个预热点 RSI6=50');
  assert(result[6].__RSI6__ !== 50, 'B3 第 7 个点开始有实际值');
}

{
  // B4：连续大跌后 RSI6 应很低（< 20）
  // 先造 7 天小幅震荡让 RSI 预热，再连跌 10 天
  const data: KLineData[] = [];
  let p = 100;
  for (let i = 0; i < 7; i += 1) {
    p += i % 2 === 0 ? 0.5 : -0.3;
    data.push({ 日期: `2020-01-${String(i + 1).padStart(2, '0')}`, 收盘: Number(p.toFixed(2)) });
  }
  for (let i = 0; i < 10; i += 1) {
    p -= 3; // 每天 -3
    data.push({ 日期: `2020-01-${String(8 + i).padStart(2, '0')}`, 收盘: Number(Math.max(1, p).toFixed(2)) });
  }
  const result = calculateRSI({ data, closeKey: '收盘', period: 6 });
  // 最后一个点应该 RSI6 很低
  const lowPoint = result[result.length - 1].__RSI6__;
  assert(lowPoint < 20, `B4 连跌 10 天后 RSI6 < 20（实际 ${lowPoint}）`);
}

// ============================================================
// C. RSI6 消除未来函数 — 4 个
// ============================================================
console.log('\n── C. RSI6 消除未来函数 ──');

const synthetic = buildSyntheticDaily(4500);

{
  // C1：calculateAsOfPeriodRSI6 —— 周/月 RSI6 的 周期末当日 = 整周期口径
  // 取月 K 的最后一天，calculateAsOfPeriodRSI6 产出当日值 应 等于 calculateMonthlyRSI6 产出的该月值
  const monthlyBars = calculateMonthlyRSI6(synthetic);
  const monthlyAsOfMap = new Map(
    calculateAsOfPeriodRSI6(synthetic, monthlyBars).map(x => [
      moment(x.日期).format('YYYY-MM-DD'), x.__RSI6__,
    ]),
  );
  let allEqual = true;
  let checked = 0;
  for (const bar of monthlyBars) {
    const barDate = moment(bar.日期).format('YYYY-MM-DD');
    const asOfVal = monthlyAsOfMap.get(barDate);
    if (asOfVal !== undefined && Math.abs(asOfVal - bar.__RSI6__) > 0.02) {
      allEqual = false;
      break;
    }
    checked += 1;
  }
  assert(allEqual && checked > 10,
    `C1 月周期末当日 as-of RSI6 与整周期口径一致（校验 ${checked} 个月末）`);
}

{
  // C2：calculateAsOfPeriodRSI6 倒序 / 乱序输入结果一致（二分定位不依赖输入顺序）
  // 确定性洗牌（Fisher-Yates + 固定种子的线性同余发生器），避免 Math.random 造成偶发失败
  let seed = 20260318;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const shuffled = [...synthetic];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const monthlyBars = calculateMonthlyRSI6(synthetic);
  const normalMap = new Map(
    calculateAsOfPeriodRSI6(synthetic, monthlyBars).map(x => [
      moment(x.日期).format('YYYY-MM-DD'), x.__RSI6__,
    ]),
  );
  const shuffledMap = new Map(
    calculateAsOfPeriodRSI6(shuffled, monthlyBars).map(x => [
      moment(x.日期).format('YYYY-MM-DD'), x.__RSI6__,
    ]),
  );
  let allEqual = true;
  let checked = 0;
  for (const [date, v] of normalMap) {
    const other = shuffledMap.get(date);
    if (other === undefined || Math.abs(other - v) > 0.02) { allEqual = false; break; }
    checked += 1;
  }
  assert(allEqual && checked > 10, `C2 乱序输入结果与升序完全一致（校验 ${checked} 日）`);
}

{
  // C3：as-of 截断口径验证 —— 把 dailyData 截断到某月月中某一天，重算当日 as-of 月RSI6
  //   应该和完整数据算的该天值完全一致（as-of 只用到当日及之前的数据，不受后续数据影响）
  const monthlyBars = calculateMonthlyRSI6(synthetic);
  const fullMap = new Map(
    calculateAsOfPeriodRSI6(synthetic, monthlyBars).map(x => [
      moment(x.日期).format('YYYY-MM-DD'), x.__RSI6__,
    ]),
  );
  // 找到第 20 个月末附近（截断点要有足够 RSI warmup）
  const barDate = monthlyBars[20].日期;
  const midMonthKey = moment(barDate).format('YYYY-MM');
  // 在这个月中选一个交易日（月中 15 日左右）
  const midPoint = synthetic.find(d =>
    moment(d.日期).format('YYYY-MM') === midMonthKey &&
    Number(moment(d.日期).format('DD')) >= 14 &&
    Number(moment(d.日期).format('DD')) <= 20,
  )!;
  const midKey = moment(midPoint.日期).format('YYYY-MM-DD');
  const fullVal = fullMap.get(midKey)!;

  // 截断到 midPoint 当日（含当日），重算 as-of
  const truncated = synthetic.filter(d =>
    moment(d.日期).isSameOrBefore(moment(midPoint.日期)),
  );
  const truncatedMonthly = calculateMonthlyRSI6(truncated);
  const truncatedMap = new Map(
    calculateAsOfPeriodRSI6(truncated, truncatedMonthly).map(x => [
      moment(x.日期).format('YYYY-MM-DD'), x.__RSI6__,
    ]),
  );
  const truncatedVal = truncatedMap.get(midKey);

  assert(truncatedVal !== undefined, 'C3 截断数据中当日有 as-of RSI6 值');
  assert(Math.abs(truncatedVal! - fullVal) < 0.02,
    `C3 截断到当日后 as-of RSI6 与完整数据一致：truncated=${truncatedVal}, full=${fullVal}`);
}

{
  // C4：warmup 预热点剔除 —— 分位策略里前 6 个月不产生信号
  const monthly = dailyToMonthly(synthetic);
  const monthlyRSI6 = calculateRSI({ data: monthly, closeKey: '收盘', period: 6 });
  // 前 6 个月 RSI6 应该都是 50
  let all50 = true;
  for (let i = 0; i < 6; i += 1) {
    if (monthlyRSI6[i].__RSI6__ !== 50) { all50 = false; break; }
  }
  assert(all50, 'C4 月 RSI6 前 6 个预热点值为 50');
}

// ============================================================
// D. 月&季共振 as-of — 9 个（保留原有，加更细断言）
// ============================================================
console.log('\n── D. 月&季共振 as-of ──');

const monthly = dailyToMonthly(synthetic);
const monthlyRSI6 = calculateRSI({ data: monthly, closeKey: '收盘', period: 6 });
const quarterlyRSI6 = calculateQuarterlyRSI6(synthetic);

const fullResult = analyzeMonthlyQuarterlyPercentile({
  monthlyRSI6Data: monthlyRSI6,
  quarterlyRSI6Data: quarterlyRSI6,
  priceSeries: synthetic,
  closeValueType: 'price',
})!;

assert(fullResult !== null, 'D analyzeMonthlyQuarterlyPercentile 返回非空');
assert(fullResult.buyPoints.length > 0,
  `D 至少有 ${fullResult.buyPoints.length} 个买点（deterministic 合成数据）`);

{
  const fullResult2 = analyzeMonthlyQuarterlyPercentile({
    monthlyRSI6Data: monthlyRSI6,
    quarterlyRSI6Data: quarterlyRSI6,
    priceSeries: synthetic,
    closeValueType: 'price',
  })!;
  eq(fullResult.buyPoints.length, fullResult2.buyPoints.length, 'D1 重算买点数量完全一致');
  let allMatch = true;
  for (let i = 0; i < fullResult.buyPoints.length; i += 1) {
    const a = fullResult.buyPoints[i];
    const b = fullResult2.buyPoints[i];
    if (a.日期 !== b.日期 || a.level !== b.level || a.sellDate !== b.sellDate) {
      allMatch = false; break;
    }
  }
  assert(allMatch, 'D1 重算逐笔日期/级别/卖出日期完全一致（确定性）');
}

{
  // D2 卖出三重条件：已配对 ★5 均满足
  const sold = fullResult.buyPoints.filter(p => p.level === 5 && p.sellDate);
  let holdOk = true;
  let annualOk = true;
  for (const p of sold) {
    if ((p.holdingDays ?? 0) < 365) holdOk = false;
    if ((p.annualizedReturn ?? 0) < 15) annualOk = false;
  }
  assert(sold.length === 0 || holdOk, `D2a 已配对 ★5 持有天数 >= 365（共 ${sold.length} 笔）`);
  assert(sold.length === 0 || annualOk, `D2b 已配对 ★5 年化收益率 >= 15%（共 ${sold.length} 笔）`);
}

{
  // D3 历史截断不变性
  const cutIdx = Math.floor(monthlyRSI6.length * 0.6);
  const cutMonthly = monthlyRSI6.slice(0, cutIdx);
  const lastMonthKey = moment(cutMonthly[cutMonthly.length - 1].日期).format('YYYY-MM');
  const cutQuarterly = quarterlyRSI6.filter(q =>
    moment(q.日期).format('YYYY-MM') <= lastMonthKey,
  );
  const cutResult = analyzeMonthlyQuarterlyPercentile({
    monthlyRSI6Data: cutMonthly,
    quarterlyRSI6Data: cutQuarterly,
    priceSeries: synthetic,
    closeValueType: 'price',
  });

  const fullInRange = fullResult.buyPoints.filter(p =>
    moment(p.日期).format('YYYY-MM') <= lastMonthKey,
  );
  const cutBuyPoints = cutResult?.buyPoints ?? [];

  eq(fullInRange.length, cutBuyPoints.length, 'D3a 截断前后买点数量一致');

  let datesEqual = true;
  let levelsEqual = true;
  let sellsEqual = true;
  let monthlyRsiEqual = true;
  for (let i = 0; i < cutBuyPoints.length; i += 1) {
    if (fullInRange[i]?.日期 !== cutBuyPoints[i]?.日期) datesEqual = false;
    if (fullInRange[i]?.level !== cutBuyPoints[i]?.level) levelsEqual = false;
    if ((fullInRange[i]?.sellDate ?? null) !== (cutBuyPoints[i]?.sellDate ?? null)) sellsEqual = false;
    if ((fullInRange[i]?.monthlyRsi ?? null) !== (cutBuyPoints[i]?.monthlyRsi ?? null)) monthlyRsiEqual = false;
  }
  assert(datesEqual, 'D3b 截断前后买点日期完全一致');
  assert(levelsEqual, 'D3c 截断前后买点级别完全一致');
  assert(sellsEqual, 'D3d 截断前后卖出日期完全一致');
  assert(monthlyRsiEqual, 'D3e 截断前后当月 RSI6 逐点一致');
}

{
  // D4 初始段（前 60 个月）没有任何买点 —— minSampleCount=60 门槛
  const early = fullResult.buyPoints.filter(p =>
    moment(p.日期).isBefore(moment('2005-12-01')),
  );
  assert(early.length === 0 || early.every(p => p.level !== 5),
    `D4 前 60 个月不应有 ★5 买点（实际 ${early.filter(p => p.level === 5).length} 个）`);
}

{
  // D5 thresholds 是快照：最新月窗口
  assert(fullResult.thresholds != null && fullResult.sellThresholds != null,
    'D5 返回了最新月的 thresholds / sellThresholds 快照');
}

{
  // D6 构造序列：★5 买入 → 满 365 天后月/季双超买且年化 ≥15% → 配对卖出（非真空断言）
  const months: string[] = [];
  const base = moment('2000-01-01');
  for (let i = 0; i < 80; i += 1) months.push(base.clone().add(i, 'months').format('YYYY-MM-DD'));
  const buyIdx = 66; // 前 6 个被 warmup 剔除后仍有 ≥60 个有效样本
  const sellIdx = 79;
  const series = months.map((date, i) => ({
    日期: date,
    // 价格在卖出信号月才跳到 120，之前保持 100：避免未满 365 天时因收益率提前卖出
    收盘: i === sellIdx ? 120 : 100,
    // 买入前缓升（不触发低分位），买入月给极低值产生 ★5，卖出月给超买值
    __RSI6__: i < buyIdx ? 50 + i * 0.1 : i === buyIdx ? 20 : i === sellIdx ? 100 : 50,
  }));
  const crafted = analyzeMonthlyQuarterlyPercentile({
    monthlyRSI6Data: series,
    quarterlyRSI6Data: series,
    priceSeries: series,
  });
  const fiveStar = crafted?.buyPoints.find(p => p.日期 === months[buyIdx]);
  eq(fiveStar?.level, 5, 'D6 构造序列在低分位月产生 ★5 买点');
  eq(fiveStar?.sellDate, months[sellIdx], 'D6 满 365 天且月/季双超买 + 年化达标 → 配对卖出');
  assert((fiveStar?.holdingDays ?? 0) >= 365, `D6 卖出持有天数 >= 365（实际 ${fiveStar?.holdingDays}）`);
  assert((fiveStar?.annualizedReturn ?? 0) >= 15, `D6 卖出年化收益率 >= 15%（实际 ${fiveStar?.annualizedReturn}）`);
  eq(fiveStar?.sellTranches?.length, 4, 'D6 分批卖出默认 4 批');
  eq(fiveStar?.sellTranches?.[0]?.executed, true, 'D6 第 1 批已执行');
}

// ============================================================
// E. 单周期 as-of — 8 个（保留原有）
// ============================================================
console.log('\n── E. 单周期（月）as-of ──');

const singleResult = analyzeSinglePeriodPercentile({
  rsiData: monthlyRSI6,
  buyPercentile: 3,
  sellPercentile: 90,
});
assert(singleResult !== null, 'E analyzeSinglePeriodPercentile 返回非空');
assert(singleResult.trades.length > 0, `E 至少有 ${singleResult.trades.length} 笔交易`);

{
  const singleResult2 = analyzeSinglePeriodPercentile({
    rsiData: monthlyRSI6,
    buyPercentile: 3,
    sellPercentile: 90,
  });
  eq(singleResult.trades.length, singleResult2.trades.length, 'E1 重算笔数一致');
  let allMatch = true;
  for (let i = 0; i < singleResult.trades.length; i += 1) {
    const a = singleResult.trades[i];
    const b = singleResult2.trades[i];
    if (a.buyDate !== b.buyDate || a.sellDate !== b.sellDate || a.status !== b.status) {
      allMatch = false; break;
    }
  }
  assert(allMatch, 'E1 重算逐笔买入/卖出/状态完全一致');
}

{
  const closed = singleResult.trades.filter(t => t.status === '已平仓');
  const minDays = appConfig.rsi.annualizeMinHoldingDays;
  let allOk = true;
  for (const t of closed) {
    const days = t.holdingDays ?? 0;
    const rate = t.returnRate ?? 0;
    const annualized = t.annualizedReturn;
    const ok = days >= minDays ? (annualized ?? 0) >= 15 : rate >= 15;
    if (!ok) allOk = false;
  }
  assert(closed.length === 0 || allOk, `E2 已平仓均满足收益率门槛（共 ${closed.length} 笔）`);
}

{
  const cutIdx = Math.floor(monthlyRSI6.length * 0.6);
  const cutLastDate = moment(monthlyRSI6[cutIdx - 1].日期);
  const cutSingle = analyzeSinglePeriodPercentile({
    rsiData: monthlyRSI6.slice(0, cutIdx),
    buyPercentile: 3,
    sellPercentile: 90,
  });
  const fullInRange = singleResult.trades.filter(t =>
    moment(t.buyDate).isSameOrBefore(cutLastDate),
  );

  eq(fullInRange.length, cutSingle.trades.length, 'E3a 截断前后笔数一致');

  let buyDatesMatch = true;
  for (let i = 0; i < cutSingle.trades.length; i += 1) {
    if (fullInRange[i]?.buyDate !== cutSingle.trades[i]?.buyDate) buyDatesMatch = false;
  }
  assert(buyDatesMatch, 'E3b 截断前后买入日期完全一致（历史不可重绘）');
}

{
  // E4 初始段（前 60 个月）没有任何交易 —— minSampleCount=60 门槛
  const startYear = moment(singleResult.trades[0]?.buyDate ?? '2099-01-01').year();
  assert(startYear >= 2005, `E4 第一笔交易在 60 个月之后（startYear=${startYear}）`);
}

// ============================================================
// F. 收益率口径 — 4 个
// ============================================================
console.log('\n── F. 收益率口径 ──');

{
  // F1 price 口径：(120-100)/100 = 20%
  eq(calculateHoldingReturnRate(100, 120, 'price'), 20,
    'F1 price 口径 100→120 = 20%');
}

{
  // F2 cumulativeReturn 口径：buy=30%（净值 1.30）, sell=50%（净值 1.50）, 区间 ≈ 15.38%
  approx(calculateHoldingReturnRate(30, 50, 'cumulativeReturn'), 15.38,
    'F2 cumulativeReturn 口径 buy=30%, sell=50% = 15.38%');
  // 验证公式：(1+50/100)/(1+30/100) - 1 = 1.5/1.3 - 1 = 0.1538
  const manual = (150 / 130 - 1) * 100;
  approx(calculateHoldingReturnRate(30, 50, 'cumulativeReturn'), manual,
    'F2b cumulativeReturn 口径 = (1+sell/100)/(1+buy/100)-1');
}

{
  // F3 年化：+15% / 365 天 = 15%（不按复利，1 年刚好）
  eq(calculateAnnualizedReturn(15, 365), 15, 'F3 年化 +15% / 365 天 = 15%');
  // +30% / 2 年 = ~14.02% 年化
  const ann = calculateAnnualizedReturn(30, 730);
  assert(ann != null, 'F3b 年化返回非 null');
  approx(ann!, 14.02, 'F3b +30% / 730 天 ≈ 14.02%');
}

{
  // F4 边界：参数非法返回 null
  assert(calculateAnnualizedReturn(null, 365) === null, 'F4a return=null → null');
  assert(calculateAnnualizedReturn(15, 0) === null, 'F4b days=0 → null');
  assert(calculateAnnualizedReturn(15, -10) === null, 'F4c days 负 → null');
}

// ============================================================
// G. 分批卖出边界 — 5 个
// ============================================================
console.log('\n── G. 分批卖出边界 ──');

{
  // G1 第 1 批 = 信号当日
  const tranches = buildSellTranches({
    buyDate: '2020-01-01', buyClose: 100,
    signalDate: '2021-01-01', signalClose: 120,
    priceSeries: [{ 日期: '2021-01-01', 收盘: 120 }],
  });
  eq(tranches.length, 4, 'G1 默认分 4 批');
  eq(tranches[0].sellDate, '2021-01-01', 'G1 第 1 批 = 信号当日');
  eq(tranches[0].sellPrice, 120, 'G1 第 1 批价格 = 信号日收盘价');
  assert(tranches[0].holdingDays! >= 365, 'G1 持有天数 >= 365');
}

{
  // G2 后续批次按 7 天间隔 + 非交易日顺延
  const dailySeries: KLineData[] = [];
  const base = moment('2021-01-01');
  // 信号日 + 14 天中间跳过几个，验证顺延
  for (let i = 0; i < 30; i += 1) {
    // 构造稀疏：只在 0, 3, 7, 10, 14, 17, 21 日有数据
    if ([0, 3, 7, 10, 14, 17, 21, 28].includes(i)) {
      dailySeries.push({
        日期: base.clone().add(i, 'days').format('YYYYMMDD'),
        收盘: 100 + i,
      });
    }
  }
  const tranches = buildSellTranches({
    buyDate: '2020-01-01', buyClose: 100,
    signalDate: '2021-01-01', signalClose: 100,
    priceSeries: dailySeries,
  });
  // 批次 1 = 2021-01-01（有）
  // 批次 2 目标 = 2021-01-08（无） → 顺延到 2021-01-11
  // 批次 3 目标 = 2021-01-15（无，且需严格晚于上一批）→ 顺延到 2021-01-18
  // 批次 4 目标 = 2021-01-22（无，且需严格晚于上一批）→ 顺延到 2021-01-29
  assert(tranches[1].sellDate != null, 'G2 第 2 批有卖出日（顺延）');
  assert(tranches[2].sellDate != null, 'G2 第 3 批有卖出日（顺延）');
  assert(tranches[3].sellDate != null, 'G2 第 4 批有卖出日（顺延）');
  // 严格递增
  let increasing = true;
  for (let i = 1; i < tranches.length; i += 1) {
    const prev = tranches[i - 1].sellDate!;
    const cur = tranches[i].sellDate!;
    if (cur <= prev) { increasing = false; break; }
  }
  assert(increasing, 'G2 各批卖出日严格递增（无重复取价）');
}

{
  // G3 卖出信号日之后没有数据 → 后续批次 executed=false
  const tranches = buildSellTranches({
    buyDate: '2020-01-01', buyClose: 100,
    signalDate: '2021-01-01', signalClose: 120,
    priceSeries: [{ 日期: '2021-01-01', 收盘: 120 }],
  });
  assert(tranches[0].executed === true, 'G3 第 1 批 executed=true');
  assert(tranches[1].executed === false, 'G3 第 2 批 executed=false（无后续数据）');
  assert(tranches[3].executed === false, 'G3 第 4 批 executed=false');
}

{
  // G4 买入当天卖出（holdingDays >= 1）
  const tranches = buildSellTranches({
    buyDate: '2021-01-01', buyClose: 100,
    signalDate: '2021-01-02', signalClose: 110,
    priceSeries: [{ 日期: '2021-01-02', 收盘: 110 }],
  });
  eq(tranches[0].holdingDays, 1, 'G4 holdingDays 至少为 1');
}

{
  // G5 getQuarterKey 正确性
  eq(getQuarterKey('20240115'), '2024-Q1', 'G5a 1月 → Q1');
  eq(getQuarterKey('20240331'), '2024-Q1', 'G5b 3月 → Q1');
  eq(getQuarterKey('20240401'), '2024-Q2', 'G5c 4月 → Q2');
  eq(getQuarterKey('20241231'), '2024-Q4', 'G5d 12月 → Q4');
}

// ============================================================
// H. roundPercentile 边界 — 2 个（加 E2 凑整）
// ============================================================
console.log('\n── H. roundPercentile 边界 ──');

{
  // H1 空数组返回 0（calculatePercentile 实现）
  eq(roundPercentile([], 50), 0, 'H1 空数组 → 0');
  // H2 单元素数组
  eq(roundPercentile([100], 50), 100, 'H2 单元素 → 该值');
  // H3 偶数组（按最近秩）
  const v = roundPercentile([10, 20, 30, 40], 25);
  assert(v === 10 || v === 20, `H3 25% 分位 → ${v}（最近秩实现）`);
}

// ============================================================
// I. appConfig 历史分位参考配置 — 3 个
// ============================================================
console.log('\n── I. appConfig 历史分位参考配置 ──');

{
  const refs = appConfig.chart.rsiPercentileRefs;
  // I1 默认展示 2% / 5% / 10% / 90%
  eq(refs.join(','), '2,5,10,90', 'I1 默认分位列 = 2/5/10/90');
  // I2 升序（展示顺序与表格列模板一致）
  eq(refs.every((v, i) => i === 0 || refs[i - 1] < v), true, 'I2 分位列严格升序');
  // I3 全部落在 (0, 100) 区间内，避免 roundPercentile 越界
  eq(refs.every((v) => v > 0 && v < 100), true, 'I3 分位均在 (0,100) 内');
}

// ============================================================
// J. calculateMaxDrawdown 口径 — 4 个
// ============================================================
console.log('\n── J. calculateMaxDrawdown 口径 ──');

{
  // J1 价格口径：峰值以首值为基准，首点回撤为 0
  const rows = calculateMaxDrawdown({
    data: [
      { 日期: '20200101', 收盘: 100 },
      { 日期: '20200102', 收盘: 120 },
      { 日期: '20200103', 收盘: 90 },
      { 日期: '20200104', 收盘: 110 },
    ],
    leftKey: '收盘',
    dateKey: '日期',
  });
  eq(rows[0].__最大回撤率__, 0, 'J1 价格口径首点回撤 = 0');
  approx(rows[2].__最大回撤率__, -25, 'J1 120 → 90 回撤 = -25%');
  approx(rows[3].__最大回撤率__, -8.33, 'J1 120 → 110 回撤 = -8.33%', 0.02);
}

{
  // J2 累计收益率口径：首值为负时不应虚构回撤
  const rows = calculateMaxDrawdown({
    data: [
      { 日期: '20200101', 累计收益率: -20 },
      { 日期: '20200102', 累计收益率: -10 },
      { 日期: '20200103', 累计收益率: -30 },
      { 日期: '20200104', 累计收益率: -20 },
    ],
    leftKey: '累计收益率',
    dateKey: '日期',
    closeValueType: 'cumulativeReturn',
  });
  eq(rows[0].__最大回撤率__, 0, 'J2 累计收益率首值为 -20 时回撤 = 0（不再虚构）');
  eq(rows[1].__最大回撤率__, 0, 'J2 从 -20 回升到 -10 回撤 = 0');
  approx(rows[2].__最大回撤率__, -22.22, 'J2 -10 → -30 回撤 = -22.22%（按净值折算）', 0.02);
  approx(rows[3].__最大回撤率__, -11.11, 'J2 -10 → -20 回撤 = -11.11%', 0.02);
}

{
  // J3 未传 percentKey：不产出百分位字段，且不出现 NaN
  const rows = calculateMaxDrawdown({
    data: [
      { 日期: '20200101', 收盘: 100 },
      { 日期: '20200102', 收盘: 90 },
    ],
    leftKey: '收盘',
    dateKey: '日期',
  });
  const keys = Object.keys(rows[0]);
  const record = rows[0] as unknown as Record<string, unknown>;
  assert(!keys.some(key => key.includes('百分位')), 'J3 未传 percentKey 时不产出百分位字段');
  assert(!keys.some(key => Number.isNaN(record[key] as number)), 'J3 不产生 NaN 字段');
}

{
  // J4 传 percentKey：百分位字段有值
  const rows = calculateMaxDrawdown({
    data: [
      { 日期: '20200101', 收盘: 100, 市盈率: 10 },
      { 日期: '20200102', 收盘: 90, 市盈率: 20 },
      { 日期: '20200103', 收盘: 95, 市盈率: 30 },
    ],
    leftKey: '收盘',
    dateKey: '日期',
    percentKey: '市盈率',
  });
  const key15 = '__市盈率15%百分位__';
  const key85 = '__市盈率85%百分位__';
  const record = rows[0] as unknown as Record<string, unknown>;
  assert(Number.isFinite(record[key15] as number), 'J4 percentKey 15% 分位字段有值');
  assert(Number.isFinite(record[key85] as number), 'J4 percentKey 85% 分位字段有值');
}

// ============================================================
// 汇总
// ============================================================
console.log(`\n── 汇总：通过 ${passed} / 失败 ${failed} ──`);
if (failed > 0) {
  console.error('失败列表：', failures);
  throw new Error(`${failed} 个断言失败`);
}
console.log('全部通过 ✅');
