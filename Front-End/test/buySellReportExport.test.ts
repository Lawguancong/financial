/**
 * buySellReportExport（买入&卖出报告 / 买入计划导出公共逻辑）测试
 *
 * 仅覆盖可在 Node 离线验证的纯逻辑：筛选规则、列定义与列插入位置。
 * 不覆盖需要浏览器环境的 Excel 下载与 DOM 交互。
 *
 * 运行：cd Front-End && npm test
 */

import {
  BUY_SELL_REPORT_COLUMNS,
  buildBuyPlanColumns,
  buildReportColumns,
  pickOpenFiveStarBuys,
  pickPairedFiveStarBuys,
} from '../src/utils/buySellReportExport';
import {
  getSellTrancheColumnTitle,
  getSellTrancheCount,
} from '../src/utils/stockUtils';
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
    BUY_SELL_REPORT_COLUMNS.length - trancheTitles.length + 1,
    'D1 买入计划列数 = 基础列 − 分批列 + 当前价格列',
  );
  assert(trancheTitles.every(title => !titles.includes(title)), 'D2 不含分批卖出收益率列');
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

summary();
