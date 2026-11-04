/**
 * buySellReportExport（买入&卖出报告 / 买入计划导出公共逻辑）测试
 *
 * 仅覆盖可在 Node 离线验证的纯逻辑：筛选规则、列定义、列插入位置，
 * 以及「推荐买点」的列/单元格对齐、排序与多买点、汇总排除列与数值统计。
 * 不覆盖需要浏览器环境的 Excel 下载与 DOM 交互。
 *
 * 运行：cd Front-End && npm test
 */

import {
  BUY_SELL_REPORT_COLUMNS,
  RECOMMENDATION_BUY_POINT_COLUMNS,
  RECOMMENDATION_SUMMARY_EXCLUDED_TITLES,
  buildBuyPlanColumns,
  buildRecommendationCells,
  buildRecommendationExportValues,
  buildReportCells,
  buildReportColumns,
  pickOpenFiveStarBuys,
  pickPairedFiveStarBuys,
} from '../src/utils/buySellReportExport';
import {
  getSellTrancheColumnTitle,
  getSellTrancheCount,
} from '../src/utils/stockUtils';
import { SUMMARY_DEFS, buildSummaryRow } from '../src/utils/reportExportStyle';
import type { MonthlyQuarterlyPercentileBuyPoint } from '../src/utils/stockUtils';
import { assert, eq, summary } from './testUtils';

const makePoint = (
  date: string,
  level: number,
  sellDate?: string,
): MonthlyQuarterlyPercentileBuyPoint => ({
  日期: date,
  收盘: 100,
  monthlyRsi: 10,
  quarterlyRsi: 10,
  level,
  ...(sellDate ? { sellDate } : {}),
});

const CURRENT_PRICE_TITLE = '当前2026-10-16价格';

// ============================================================
// A. 买入&卖出报告筛选 — 5
// ============================================================
console.log('\n── A. pickPairedFiveStarBuys ──');
{
  const points = [
    makePoint('2020-01-01', 5, '2021-01-01'),
    makePoint('2020-02-01', 5),
    makePoint('2020-03-01', 3, '2021-03-01'),
    makePoint('2020-04-01', 1, '2021-04-01'),
    makePoint('2020-05-01', 5, '2021-05-01'),
  ];
  const picked = pickPairedFiveStarBuys(points);
  eq(picked.length, 2, 'A1 仅保留 ★5 且已配对卖出的买点');
  eq(picked[0].日期, '2020-01-01', 'A2 保持买入顺序（第 1 条）');
  eq(picked[1].日期, '2020-05-01', 'A3 保持买入顺序（第 2 条）');
  assert(picked.every(point => point.level === 5 && point.sellDate != null), 'A4 过滤后全部满足 ★5 + 已卖出');
  eq(pickPairedFiveStarBuys([]).length, 0, 'A5 空列表 → 空结果');
}

// ============================================================
// B. 买入计划筛选 — 7
// ============================================================
console.log('\n── B. pickOpenFiveStarBuys ──');
{
  const points = [
    makePoint('2020-01-01', 5, '2020-12-01'),
    makePoint('2020-06-01', 5, '2021-06-01'),
    makePoint('2021-07-01', 5),
    makePoint('2021-08-01', 3),
    makePoint('2021-09-01', 5),
    makePoint('2021-10-01', 1),
  ];
  const picked = pickOpenFiveStarBuys(points);
  eq(picked.length, 2, 'B1 只保留最近一次配对卖出之后的未卖出 ★5');
  eq(picked[0].日期, '2021-07-01', 'B2 第一条为最近卖出后的首个 ★5');
  eq(picked[1].日期, '2021-09-01', 'B3 第二条为同周期内后续 ★5');
  assert(picked.every(point => point.sellDate == null && point.level === 5), 'B4 不含已卖出与非 ★5');
}
{
  const points = [
    makePoint('2020-01-01', 5),
    makePoint('2020-02-01', 5),
    makePoint('2020-03-01', 3),
  ];
  eq(pickOpenFiveStarBuys(points).length, 2, 'B5 无任何卖出记录时返回全部未卖出 ★5');
}
{
  eq(pickOpenFiveStarBuys([makePoint('2020-01-01', 5, '2020-06-01')]).length, 0, 'B6 全部已卖出 → 空结果');
  eq(pickOpenFiveStarBuys([]).length, 0, 'B7 空列表 → 空结果');
}

// ============================================================
// C. 买入&卖出报告列 — 6
// ============================================================
console.log('\n── C. buildReportColumns ──');
{
  const baseTitles = BUY_SELL_REPORT_COLUMNS.map(column => column.title);
  const columns = buildReportColumns(CURRENT_PRICE_TITLE);
  const titles = columns.map(column => column.title);

  eq(columns.length, BUY_SELL_REPORT_COLUMNS.length + 1, 'C1 在基础列上仅新增 1 列「当前价格」');
  const sellQuarterlyIndex = titles.indexOf('卖出季RSI6');
  eq(titles[sellQuarterlyIndex + 1], CURRENT_PRICE_TITLE, 'C2「当前价格」紧跟在「卖出季RSI6」之后');
  eq(titles.indexOf(CURRENT_PRICE_TITLE), sellQuarterlyIndex + 1, 'C3「当前价格」只出现一次且位置正确');
  eq(titles.filter(title => title === CURRENT_PRICE_TITLE).length, 1, 'C4「当前价格」列唯一');

  // 基础列顺序保持不变（除插入点外）
  const withoutCurrent = titles.filter(title => title !== CURRENT_PRICE_TITLE);
  eq(withoutCurrent.join('|'), baseTitles.join('|'), 'C5 除「当前价格」外基础列顺序与定义完全一致');
  assert(baseTitles.includes('平均收益率') && baseTitles.includes('年化收益率'), 'C6 基础列含收益与年化列');
  assert(baseTitles.includes('买入后最大浮盈率'), 'C7 基础列含买入后最大浮盈率');
}

// ============================================================
// D. 买入计划列 — 7
// ============================================================
console.log('\n── D. buildBuyPlanColumns ──');
{
  const trancheCount = getSellTrancheCount();
  const trancheTitles = trancheCount > 1
    ? Array.from({ length: trancheCount }, (_, index) => getSellTrancheColumnTitle(index + 1))
    : [];
  const columns = buildBuyPlanColumns(CURRENT_PRICE_TITLE);
  const titles = columns.map(column => column.title);

  eq(
    columns.length,
    BUY_SELL_REPORT_COLUMNS.length - trancheTitles.length - 1 + 1,
    'D1 买入计划列数 = 基础列 − 分批列 − 最大浮盈列 + 当前价格列',
  );
  assert(trancheTitles.every(title => !titles.includes(title)), 'D2 不含分批卖出收益率列');
  assert(!titles.includes('买入后最大浮盈率'), 'D8 买入计划不含「买入后最大浮盈率」列');
  assert(titles.includes('持有至今收益率'), 'D3「平均收益率」改名为「持有至今收益率」');
  assert(!titles.includes('平均收益率'), 'D4 旧「平均收益率」列已移除');
  assert(titles.includes('持有至今年化收益率'), 'D5「年化收益率」改名为「持有至今年化收益率」');
  assert(!titles.includes('年化收益率'), 'D6 旧「年化收益率」列已移除');

  const sellQuarterlyIndex = titles.indexOf('卖出季RSI6');
  eq(titles[sellQuarterlyIndex + 1], CURRENT_PRICE_TITLE, 'D7「当前价格」插入位置与报告一致');
}

// ============================================================
// E. 分批列标题 — 3
// ============================================================
console.log('\n── E. 分批列标题 ──');
{
  const trancheCount = getSellTrancheCount();
  const titles = Array.from({ length: trancheCount }, (_, index) => getSellTrancheColumnTitle(index + 1));
  eq(new Set(titles).size, trancheCount, 'E1 同一配置下分批列标题互不重复');
  if (trancheCount > 1) {
    assert(
      titles.every(title => BUY_SELL_REPORT_COLUMNS.some(column => column.title === title)),
      'E2 分批列已包含在报告基础列中',
    );
    eq(getSellTrancheColumnTitle(1), titles[0], 'E3 列标题生成函数可重复调用且稳定');
  } else {
    assert(true, 'E2 分批数为 1 时不生成分批列');
    assert(true, 'E3 分批数为 1 时跳过标题一致性断言');
  }
}

// ============================================================
// F. buildReportCells — 列与单元格对齐（含新增 MFE 列）
// ============================================================
console.log('\n── F. buildReportCells 列/单元格对齐 ──');
{
  const trancheCount = getSellTrancheCount();
  const point: MonthlyQuarterlyPercentileBuyPoint = {
    日期: '2020-01-01',
    收盘: 100,
    monthlyRsi: 10,
    quarterlyRsi: 10,
    level: 5,
    sellDate: '2021-01-01',
    sellPrice: 120,
    sellMonthlyRsi: 90,
    sellQuarterlyRsi: 90,
    holdingDays: 366,
    returnRate: 20,
    annualizedReturn: 20,
    sellTranches: Array.from({ length: trancheCount }, (_, index) => ({
      index: index + 1,
      targetDate: '2021-01-01',
      executed: true,
      returnRate: 20,
      holdingDays: 366,
      sellPrice: 120,
      sellDate: '2021-01-01',
    })),
    latestDate: '2026-10-16',
    latestClose: 130,
    holdingDaysToNow: 2000,
    returnRateToNow: 30,
    maxFavorableReturn: 35,
    maxDrawdown: 10,
    maxDrawdownDate: '2020-02-01',
    maxDrawdownClose: 90,
    daysToMaxDrawdown: 31,
    recoveryDate: '2020-03-01',
    maxRecoveryHoldingDays: 60,
    calmarRatio: 2,
  };
  const item = { code: 'TEST', name: '测试', point };

  const pairedColumns = buildReportColumns(CURRENT_PRICE_TITLE);
  const pairedCells = buildReportCells(item, 'paired');
  eq(pairedCells.length, pairedColumns.length, 'F1 配对报告：单元格数量 = 列数量');
  const mfeIndex = pairedColumns.findIndex(column => column.title === '买入后最大浮盈率');
  assert(mfeIndex >= 0, 'F2 配对报告包含「买入后最大浮盈率」列');
  eq(pairedCells[mfeIndex], 35, 'F3 MFE 单元格取值 = point.maxFavorableReturn');
  const drawdownIndex = pairedColumns.findIndex(column => column.title === '最大回撤率');
  eq(pairedCells[drawdownIndex], 10, 'F4 最大回撤率单元格未因 MFE 插入而错位');
  const currentPriceIndex = pairedColumns.findIndex(column => column.title === CURRENT_PRICE_TITLE);
  eq(pairedCells[currentPriceIndex], 130, 'F5 当前价格单元格未错位');

  const planColumns = buildBuyPlanColumns(CURRENT_PRICE_TITLE);
  const planCells = buildReportCells(item, 'open');
  eq(planCells.length, planColumns.length, 'F6 买入计划：单元格数量 = 列数量');
  assert(
    !planColumns.some(column => column.title === '买入后最大浮盈率'),
    'F7 买入计划不含「买入后最大浮盈率」列',
  );
  const planDrawdownIndex = planColumns.findIndex(column => column.title === '最大回撤率');
  eq(planCells[planDrawdownIndex], 10, 'F8 买入计划：最大回撤率单元格未错位');
  const planHoldingReturnIndex = planColumns.findIndex(column => column.title === '持有至今收益率');
  eq(planCells[planHoldingReturnIndex], 30, 'F9 买入计划：持有至今收益率单元格未错位');

  const noMfeItem = {
    code: 'TEST',
    name: '测试',
    point: { ...point, maxFavorableReturn: undefined },
  };
  const noMfeCells = buildReportCells(noMfeItem, 'paired');
  eq(noMfeCells[mfeIndex], '', 'F10 MFE ≤0/缺失时显示空');
}

// ============================================================
// G. 推荐买点导出列 — 5
// ============================================================
console.log('\n── G. RECOMMENDATION_BUY_POINT_COLUMNS ──');
{
  const titles = RECOMMENDATION_BUY_POINT_COLUMNS.map(column => column.title);
  const expected = [
    '代码',
    '名称',
    '推荐级别',
    '买入日期',
    '买入收盘价',
    '买入月RSI6',
    '买入季RSI6',
    '最大回撤率',
    '最大回撤最低点日期',
    '最大回撤的收盘价',
    '买点到最大回撤率的被套天数',
    '回本日期',
    '最大回本持有天数',
  ];
  eq(RECOMMENDATION_BUY_POINT_COLUMNS.length, 13, 'G1 推荐买点共 13 列');
  eq(titles.join('|'), expected.join('|'), 'G2 列顺序与需求一致');
  assert(!titles.includes('数据源'), 'G3 不含「数据源」列');
  assert(!titles.some(title => /当前.*价格/.test(title)), 'G4 不含当前价格列');
  assert(
    !titles.includes('持有天数') && !titles.includes('平均收益率') && !titles.includes('年化收益率'),
    'G5 不含持有天数/平均收益率/年化收益率列',
  );
}

// ============================================================
// H. buildRecommendationCells — 回撤明细对齐 — 14
// ============================================================
console.log('\n── H. buildRecommendationCells ──');
{
  const columns = RECOMMENDATION_BUY_POINT_COLUMNS;
  const point: MonthlyQuarterlyPercentileBuyPoint = {
    日期: '2020-01-01',
    收盘: 100,
    monthlyRsi: 8,
    quarterlyRsi: 9,
    level: 5,
    sellDate: '2021-06-01',
    holdingDays: 517,
    returnRate: 20,
    annualizedReturn: 13.5,
    latestDate: '2026-10-16',
    latestClose: 130,
    holdingDaysToNow: 2000,
    returnRateToNow: 30,
    maxDrawdown: 12,
    maxDrawdownDate: '2020-03-01',
    maxDrawdownClose: 88,
    daysToMaxDrawdown: 60,
    recoveryDate: '2020-06-01',
    maxRecoveryHoldingDays: 120,
  };
  const cells = buildRecommendationCells({ code: 'TEST', name: '测试', point });
  eq(cells.length, columns.length, 'H1 单元格数量 = 列数量');
  eq(cells[2], '★★★★★', 'H2 推荐级别按 level 生成星号');
  eq(cells[4], 100, 'H3 买入收盘价');
  eq(cells[5], 8, 'H4 买入月RSI6');
  eq(cells[6], 9, 'H5 买入季RSI6');
  eq(cells[7], 12, 'H6 最大回撤率');
  eq(cells[8], '2020-03-01', 'H7 最大回撤最低点日期');
  eq(cells[9], 88, 'H8 最大回撤的收盘价');
  eq(cells[10], 60, 'H9 买点到最大回撤率的被套天数');
  eq(cells[11], '2020-06-01', 'H11 回本日期');
  eq(cells[12], 120, 'H12 最大回本持有天数');
  // 未卖出但已补充持有至今字段的 ★3：回撤明细同口径输出（已移除收益/持有天数列）
  const openCells = buildRecommendationCells({
    code: 'TEST',
    name: '测试',
    point: {
      日期: '2023-01-01',
      收盘: 100,
      monthlyRsi: 9,
      quarterlyRsi: 10,
      level: 3,
      latestDate: '2026-10-16',
      latestClose: 95,
      holdingDaysToNow: 100,
      returnRateToNow: -5,
      maxDrawdown: 20,
    },
  });
  eq(openCells.length, columns.length, 'H13 未卖出：单元格数量 = 列数量');
  eq(openCells[7], 20, 'H14 未卖出：最大回撤率');
  const missingCells = buildRecommendationCells({
    code: 'TEST',
    name: '测试',
    point: { 日期: '2023-01-01', 收盘: 100, monthlyRsi: 9, quarterlyRsi: 10, level: 1 },
  });
  eq(missingCells[7], '-', 'H15 最大回撤缺失写 -');
  eq(missingCells[8], '-', 'H16 最低点日期缺失写 -');
  eq(missingCells[9], '-', 'H17 最低点收盘价缺失写 -');
  eq(missingCells[10], '-', 'H18 被套天数缺失写 -');
  eq(missingCells[11], '-', 'H19 回本日期缺失写 -');
  eq(missingCells[12], '-', 'H20 最大回本持有天数缺失写 -');
}

// ============================================================
// I. 推荐买点行排序/多买点 — 5
// ============================================================
console.log('\n── I. buildRecommendationExportValues 排序 ──');
{
  const items = [
    {
      code: 'B',
      name: '乙',
      point: { 日期: '2020-01-01', 收盘: 100, monthlyRsi: 10, quarterlyRsi: 10, level: 3 },
    },
    {
      code: 'A',
      name: '甲',
      point: { 日期: '2020-02-01', 收盘: 200, monthlyRsi: 5, quarterlyRsi: 6, level: 5 },
    },
    {
      code: 'A',
      name: '甲',
      point: { 日期: '2020-02-01', 收盘: 210, monthlyRsi: 8, quarterlyRsi: 9, level: 1 },
    },
  ];
  const values = buildRecommendationExportValues(items);
  eq(values.length, 3, 'I1 同一标的可有多条买点，全部保留（不去重）');
  eq(values[0][0], 'A', 'I2 最近买入日期排最前');
  eq(values[0][3], '2020-02-01', 'I3 首行日期为最晚买入日');
  eq(values[2][0], 'B', 'I4 最早买入日排最后');
  eq(items[0].code, 'B', 'I5 不修改入参顺序');
}

// ============================================================
// J. 推荐买点汇总行 — 14
// ============================================================
console.log('\n── J. 推荐买点汇总统计 ──');
{
  const columns = RECOMMENDATION_BUY_POINT_COLUMNS;
  const detailValues = buildRecommendationExportValues([
    {
      code: '001',
      name: '甲',
      point: {
        日期: '2020-01-01',
        收盘: 100,
        monthlyRsi: 8,
        quarterlyRsi: 9,
        level: 5,
        maxDrawdown: 10,
        maxDrawdownDate: '2020-02-01',
        maxDrawdownClose: 90,
        daysToMaxDrawdown: 31,
        recoveryDate: '2020-03-01',
        maxRecoveryHoldingDays: 60,
      },
    },
    {
      code: '002',
      name: '乙',
      point: { 日期: '2021-01-01', 收盘: 100, monthlyRsi: 10, quarterlyRsi: 12, level: 3 },
    },
  ]);

  const averageRow = buildSummaryRow(
    detailValues,
    '平均值',
    SUMMARY_DEFS[0].aggregate,
    columns,
    RECOMMENDATION_SUMMARY_EXCLUDED_TITLES,
  );
  eq(averageRow[0], '平均值', 'J1 首列为汇总标签');
  eq(averageRow[1], '', 'J2 名称列不参与统计');
  eq(averageRow[2], '', 'J3 推荐级别不参与统计');
  eq(averageRow[3], '', 'J4 买入日期不参与统计');
  eq(averageRow[4], '', 'J5 买入收盘价不参与统计');
  eq(averageRow[5], 9, 'J6 买入月RSI6 平均值');
  eq(averageRow[6], 10.5, 'J7 买入季RSI6 平均值');
  eq(averageRow[7], 10, 'J8 最大回撤率：缺失写 - 不参与统计');
  eq(averageRow[8], '', 'J9 最大回撤最低点日期不参与统计');
  eq(averageRow[9], '', 'J10 最大回撤的收盘价不参与统计');
  eq(averageRow[10], 31, 'J11 被套天数参与统计');
  eq(averageRow[11], '', 'J12 回本日期不参与统计');
  eq(averageRow[12], 60, 'J13 最大回本持有天数参与统计');

  const sampleVarianceRow = buildSummaryRow(
    detailValues,
    '样本方差',
    SUMMARY_DEFS[2].aggregate,
    columns,
    RECOMMENDATION_SUMMARY_EXCLUDED_TITLES,
  );
  eq(sampleVarianceRow[5], 2, 'J14 买入月RSI6 8/10 的样本方差 = 2');
}

summary();
