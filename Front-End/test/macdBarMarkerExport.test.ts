/**
 * macdBarMarkerExport（最低 MACD 柱月K标记导出）测试
 *
 * 仅覆盖可在 Node 离线验证的纯逻辑：列定义、月度标记计算、持有/回撤指标口径。
 * 不覆盖需要浏览器环境的 Excel 下载与批量取数交互。
 *
 * 运行：cd Front-End && npm test
 */

import moment from 'moment';
import { appConfig } from '../src/config/appConfig';
import {
  buildMacdBarMarkerCells,
  buildMacdBarMarkerColumns,
  buildMacdBarMarkerRows,
  buildMacdBarMarkerSummaryExcludedTitles,
  resolveCurrentPriceTitle,
} from '../src/utils/macdBarMarkerExport';
import { computeHoldingDrawdown } from '../src/utils/buyPointCompute';
import { aggregateKLineByPeriod, calculateMACD } from '../src/utils/stockUtils';
import type { KLineData } from '../src/utils/stockUtils';
import { classifyColumn } from '../src/utils/reportExportStyle';
import { approx, assert, eq, summary } from './testUtils';

const MONTHLY_WINDOW = appConfig.chart.macd.peakWindows.monthly;
const MIN_MONTHLY_BARS = appConfig.chart.macd.minMonthlyBars;
const CURRENT_PRICE_TITLE = '当前2026-11-01价格';

/** 生成「每月最后一个交易日」的收盘序列，供月度聚合测试 */
const buildMonthlySeries = (prices: number[]): { 日期: string; 收盘: number }[] =>
  prices.map((close, index) => ({
    日期: moment('2015-01-31').add(index, 'months').endOf('month').format('YYYY-MM-DD'),
    收盘: close,
  }));

/** 仅含日期的收盘序列补全为 KLineData，供月度聚合复用 */
const toKLineData = (items: { 日期: string; 收盘: number }[]): KLineData[] =>
  items.map(item => ({
    日期: item.日期,
    收盘: item.收盘,
    开盘: item.收盘,
    最高: item.收盘,
    最低: item.收盘,
    成交量: 0,
    成交额: 0,
  }));

const makePrices = (): number[] => {
  const rising = Array.from({ length: 36 }, (_, index) => 100 + index * 2.8);
  const falling = Array.from({ length: 14 }, (_, index) => 200 - (index + 1) * 5);
  // 区间结束买入后再走一段「下跌 → 回本 → 新高」，用于验证买入后的被套/峰值回撤
  return [
    ...rising,
    ...falling,
    136, 142, 134, 126, 122, 128, 134, 140, 148, 156, 164,
    150, 140, 130, 135, 145, 155, 165,
  ];
};

// ============================================================
// A. 列定义 — 5
// ============================================================
console.log('\n── A. buildMacdBarMarkerColumns ──');
{
  const titles = buildMacdBarMarkerColumns('收盘价', CURRENT_PRICE_TITLE).map(column => column.title);
  const expected = [
    '代码',
    '名称',
    '最低MACD柱日期',
    '最低MACD柱',
    '最低柱收盘价',
    '最低柱前连续负值柱数',
    '负值区间总柱数',
    '买入日期',
    '买入收盘价',
    '买入MACD',
    CURRENT_PRICE_TITLE,
    '持有天数',
    '持有至今收益率',
    '持有至今年化收益率',
    '买入后最大浮盈率',
    '被套最大回撤率',
    '被套最大回撤最低点日期',
    '被套最大回撤的收盘价',
    '买点到被套最大回撤的天数',
    '回本日期',
    '最大回本持有天数',
    '被套回撤修复天数',
    'Calmar比率（年化收益 / 最大回撤）',
  ];
  eq(titles.length, expected.length, 'A1 列数量为 23');
  assert(
    titles.every((title, index) => title === expected[index]),
    'A2 列顺序与导出单元格严格对齐',
    { titles },
  );
}
{
  const titles = buildMacdBarMarkerColumns('累计收益率', CURRENT_PRICE_TITLE).map(column => column.title);
  eq(titles[4], '最低柱累计收益率', 'A3 基金口径：最低柱列为累计收益率');
  eq(titles[8], '买入累计收益率', 'A4 基金口径：买入列为累计收益率');
  eq(titles[17], '被套最大回撤的收盘价', 'A5 被套回撤低点列标题保持「收盘价」');
}

// ============================================================
// B. 月度标记计算 — 10
// ============================================================
console.log('\n── B. buildMacdBarMarkerRows ──');
{
  eq(buildMacdBarMarkerRows([]).length, 0, 'B1 空数据 → 空结果');
}
{
  const shortSeries = buildMonthlySeries(Array.from({ length: MIN_MONTHLY_BARS - 1 }, () => 100));
  eq(buildMacdBarMarkerRows(shortSeries).length, 0, 'B2 月K样本低于 MACD 预热门槛 → 空结果');
}

const rows = buildMacdBarMarkerRows(buildMonthlySeries(makePrices()));
assert(rows.length > 0, 'B3 合成行情产生最低柱标记', { count: rows.length });
{
  const row = rows[0];
  assert(row.minDate < row.buyDate, 'B4 买入确认日期晚于最低柱日期', row);
  assert(row.runLength >= MONTHLY_WINDOW, 'B5 负值区间总柱数不少于月K窗口', row);
  assert(row.buyBar > row.minBar, 'B6 买入确认 MACD 高于最低柱', row);
  assert(row.latestDate >= row.buyDate, 'B7 最新交易日不早于买入确认日', row);
  assert(row.holdingDays >= 1, 'B8 持有天数至少 1 天', row);
  approx(
    row.returnRateToNow,
    Number((((row.latestClose - row.buyClose) / row.buyClose) * 100).toFixed(2)),
    'B9 持有至今收益率 = 最新值 / 买入值',
    0.02,
  );
  assert(
    row.barsBeforeMin >= 0 && row.barsBeforeMin < row.runLength,
    'B10 最低柱前连续负值柱数（不含最低柱）不小于 0 且小于区间总柱数',
    row,
  );
  assert(Number.isFinite(row.buyBar), 'B11 买入 MACD 为有效数值', row.buyBar);
  assert(
    row.maxFavorableReturn == null || row.maxFavorableReturn > 0,
    'B13 买入后最大浮盈率仅在 >0 时提供',
  );
}
{
  const row = rows.find(item => item.maxDrawdown != null);
  assert(row != null, 'B15 行情回撤段产生被套回撤指标');
  if (row) {
    assert(row.maxDrawdown! > 0, 'B16 被套最大回撤率为正', row.maxDrawdown);
    assert(
      (row.maxDrawdownClose ?? Infinity) < row.buyClose,
      'B17 被套回撤低点低于买入价',
      row.maxDrawdownClose,
    );
    assert(row.recoveryDate != null, 'B18 回撤后回本，产生回本日期', row.recoveryDate);
    assert(
      row.drawdownRepairDays != null && row.drawdownRepairDays >= 0,
      'B19 被套回撤修复天数为非负数值',
      row.drawdownRepairDays,
    );
    if (row.calmarRatio != null && row.annualizedReturn != null) {
      approx(
        row.calmarRatio,
        Number((row.annualizedReturn / row.maxDrawdown!).toFixed(2)),
        'B22 Calmar = 年化收益率 / 最大回撤率',
        0.02,
      );
    }
  }
}

// ============================================================
// C. 持有期回撤口径（价格 / 累计收益率） — 8
// ============================================================
console.log('\n── C. computeHoldingDrawdown ──');
{
  const series = [
    { 日期: '2020-01-01', 收盘: 100 },
    { 日期: '2020-02-01', 收盘: 80 },
    { 日期: '2020-03-01', 收盘: 110 },
    { 日期: '2020-04-01', 收盘: 90 },
    { 日期: '2020-05-01', 收盘: 120 },
  ];
  const drawdown = computeHoldingDrawdown(series, '2020-01-01', 100);
  assert(drawdown != null, 'C1 价格口径：跌破买入价时产生回撤');
  if (drawdown) {
    eq(drawdown.maxDrawdown, 20, 'C2 最大回撤率 = (100-80)/100');
    eq(drawdown.troughDate, '2020-02-01', 'C3 最大回撤最低点日期');
    eq(drawdown.troughClose, 80, 'C4 最大回撤最低点收盘价');
    eq(drawdown.recoveryDate, '2020-03-01', 'C5 最低点之后首个回本日');
    eq(drawdown.maxRecoveryHoldingDays, 30, 'C6 最大回本持有天数取最长水下区间（4/1→5/1）');
  }
}
{
  const series = [
    { 日期: '2020-01-01', 收盘: 0 },
    { 日期: '2020-02-01', 收盘: -20 },
    { 日期: '2020-03-01', 收盘: 10 },
  ];
  const drawdown = computeHoldingDrawdown(series, '2020-01-01', 0, undefined, 'cumulativeReturn');
  assert(drawdown != null, 'C7 累计收益率口径：负收益按净值折算后产生回撤');
  if (drawdown) {
    eq(drawdown.maxDrawdown, 20, 'C8 累计收益率回撤率 = (100-80)/100');
  }
}

// ============================================================
// D. 下一周期买入（截断验证） — 6
// ============================================================
console.log('\n── D. 下一周期买入（截断验证） ──');
{
  const priceSeries = buildMonthlySeries(makePrices());
  const fullRows = buildMacdBarMarkerRows(priceSeries);
  const firstRow = fullRows[0];
  assert(firstRow != null, 'D1 完整数据产生标记');

  const atBuySeries = priceSeries.filter(item => item.日期 <= firstRow.buyDate);
  const atBuyRows = buildMacdBarMarkerRows(atBuySeries);
  const matchedRow = atBuyRows.find(
    row => row.minDate === firstRow.minDate && row.buyDate === firstRow.buyDate,
  );
  assert(matchedRow != null, 'D2 截断到买入日期，标记与买入日保持不变');
  if (matchedRow) {
    eq(matchedRow.latestDate, firstRow.buyDate, 'D3 截断后最新交易日 = 买入日期');
    eq(matchedRow.holdingDays, 1, 'D4 截断后持有天数至少 1 天');
    eq(matchedRow.returnRateToNow, 0, 'D5 截断后持有至今收益率为 0');
  }

  const beforeBuySeries = priceSeries.filter(item => item.日期 < firstRow.buyDate);
  const beforeBuyRows = buildMacdBarMarkerRows(beforeBuySeries);
  assert(
    !beforeBuyRows.some(row => row.minDate === firstRow.minDate),
    'D6 截断到买入日之前（下一周期确认柱不存在）不产生该买入行',
  );
}

// ============================================================
// E. buildMacdBarMarkerCells — 列/单元格对齐
// ============================================================
console.log('\n── E. buildMacdBarMarkerCells ──');
{
  const sampleRow = rows.find(row => row.maxDrawdown != null) ?? rows[0];
  const sampleItem = { code: 'TEST', name: '测试', ...sampleRow };
  const cells = buildMacdBarMarkerCells(sampleItem);
  const columns = buildMacdBarMarkerColumns('收盘价', CURRENT_PRICE_TITLE);

  eq(cells.length, columns.length, 'E1 单元格数量 = 列数量');
  eq(cells[3], sampleRow.minBar, 'E2 最低柱值单元格对齐');
  eq(cells[7], sampleRow.buyDate, 'E3 买入日期单元格对齐');
  eq(cells[8], sampleRow.buyClose, 'E4 买入价单元格对齐');
  eq(cells[9], sampleRow.buyBar, 'E5 买入 MACD 单元格对齐');
  eq(cells[14], sampleRow.maxFavorableReturn ?? '', 'E6 买入后最大浮盈率单元格对齐（≤0 时为空）');
  eq(cells[15], sampleRow.maxDrawdown ?? '-', 'E7 最大回撤率单元格对齐');
  eq(cells[22], sampleRow.calmarRatio ?? '-', 'E8 Calmar 单元格对齐');
}

// ============================================================
// F. 独立校验：下一周期买入 / 负值区间 / 指标
// ============================================================
console.log('\n── F. 独立校验 ──');
{
  const daily = buildMonthlySeries(makePrices());
  const monthly = aggregateKLineByPeriod({ dailyData: toKLineData(daily), period: 'monthly' });
  const macdRows = calculateMACD({ data: monthly, ...appConfig.chart.macd.macdParams });
  const row = rows[0];
  const minIndex = monthly.findIndex(
    item => moment(item.日期).format('YYYY-MM-DD') === row.minDate,
  );
  assert(minIndex >= 0, 'F1 最低柱日期可在月K中定位');

  eq(
    row.minBar,
    Number(Number(macdRows[minIndex].__MACD_BAR__).toFixed(2)),
    'F2 最低柱值 = 独立 MACD 计算',
  );

  const buyIndex = minIndex + 1;
  assert(buyIndex < monthly.length, 'F3 买入日期存在下一周期月K');
  const buyDate = moment(monthly[buyIndex].日期).format('YYYY-MM-DD');
  eq(row.buyDate, buyDate, 'F4 买入日期 = 最低柱下一周期');
  eq(
    row.buyClose,
    Number(Number(monthly[buyIndex].收盘).toFixed(2)),
    'F5 买入价 = 下一周期收盘价',
  );
  eq(
    row.buyBar,
    Number(Number(macdRows[buyIndex].__MACD_BAR__).toFixed(2)),
    'F6 买入 MACD = 下一周期 MACD',
  );

  let runStart = minIndex;
  while (runStart > 0 && macdRows[runStart - 1].__MACD_BAR__ < 0) runStart -= 1;
  let runEnd = minIndex;
  while (runEnd + 1 < macdRows.length && macdRows[runEnd + 1].__MACD_BAR__ < 0) runEnd += 1;
  eq(row.barsBeforeMin, minIndex - runStart, 'F7 最低柱前连续负值柱数 = 独立扫描');
  eq(row.runLength, runEnd - runStart + 1, 'F8 负值区间总柱数 = 独立扫描');

  const buyCloseRaw = Number(monthly[buyIndex].收盘);
  let maxReturn = 0;
  daily.forEach(item => {
    const date = moment(item.日期).format('YYYY-MM-DD');
    if (date < buyDate) return;
    const ret = ((item.收盘 - buyCloseRaw) / buyCloseRaw) * 100;
    if (ret > maxReturn) maxReturn = ret;
  });
  eq(row.maxFavorableReturn, Number(maxReturn.toFixed(2)), 'F9 MFE = 独立窗口最高收益率');

  const independentDrawdown = computeHoldingDrawdown(daily, buyDate, buyCloseRaw);
  eq(
    row.maxDrawdown,
    independentDrawdown?.maxDrawdown ?? undefined,
    'F10 最大回撤率 = 独立 computeHoldingDrawdown',
  );
  if (row.maxDrawdown != null && row.annualizedReturn != null) {
    approx(
      row.calmarRatio!,
      Number((row.annualizedReturn / row.maxDrawdown).toFixed(2)),
      'F11 Calmar = 年化收益率 / 最大回撤率',
      0.02,
    );
  }
}

// ============================================================
// G. 当前价格表头 / 汇总排除 / 列类型
// ============================================================
console.log('\n── G. 表头与汇总排除 ──');
{
  eq(
    resolveCurrentPriceTitle(['2026-10-16', '2026-10-16']),
    '当前2026-10-16价格',
    'G1 最新交易日一致 → 动态日期表头',
  );
  eq(
    resolveCurrentPriceTitle(['2026-10-16', '2026-10-15']),
    '当前价格',
    'G2 最新交易日不一致 → 回退固定表头',
  );
  eq(resolveCurrentPriceTitle([]), '当前价格', 'G3 无行 → 固定表头');

  const excluded = buildMacdBarMarkerSummaryExcludedTitles('收盘价', '当前2026-10-16价格');
  assert(
    excluded.has('代码') && excluded.has('买入日期') && excluded.has('当前2026-10-16价格'),
    'G4 文本/日期/价格列被排除',
  );
  assert(
    !excluded.has('买入后最大浮盈率') &&
      !excluded.has('Calmar比率（年化收益 / 最大回撤）'),
    'G5 数值列参与汇总统计',
  );

  eq(classifyColumn('买入后最大浮盈率'), 'returnRate', 'G6 MFE 按收益率列格式化');
  eq(classifyColumn('买入MACD'), 'ratio', 'G7 买入 MACD 按两位小数格式化');
  eq(classifyColumn('最低柱前连续负值柱数'), 'count', 'G8 负值柱数按整数格式化');
}

// ============================================================
// H. 数据清洗 / 累计收益率口径
// ============================================================
console.log('\n── H. 数据清洗与累计收益率 ──');
{
  const base = buildMonthlySeries(makePrices());
  const lastDate = moment(base[base.length - 1].日期)
    .add(1, 'month')
    .endOf('month')
    .format('YYYY-MM-DD');
  const rowsWithZero = buildMacdBarMarkerRows([...base, { 日期: lastDate, 收盘: 0 }]);
  assert(rowsWithZero.length > 0, 'H1 异常 0 价格不影响已有标记');
  assert(rowsWithZero.every(row => row.latestClose > 0), 'H2 价格口径剔除 0 值');

  const rowsWithInvalid = buildMacdBarMarkerRows([...base, { 日期: '', 收盘: 100 }]);
  eq(rowsWithInvalid.length, rows.length, 'H3 空日期被忽略，不产生伪月K');

  const cumulative = base.map(item => ({ 日期: item.日期, 收盘: item.收盘 - 100 }));
  const rowsCumulative = buildMacdBarMarkerRows(cumulative, 'cumulativeReturn');
  assert(rowsCumulative.length > 0, 'H4 累计收益率口径产生标记');
  assert(
    rowsCumulative.every(
      row =>
        (row.maxFavorableReturn == null || row.maxFavorableReturn > 0) &&
        Number.isFinite(row.buyClose),
    ),
    'H5 累计收益率口径的 MFE（仅 >0）/买入价有效',
  );
}

summary();
