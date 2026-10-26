/**
 * MACD 计算与中证指数历史清洗测试
 *
 * 运行：cd Front-End && npm test
 */

import {
  calculateMACD,
  cleanCsindexHistory,
  findConfirmedPeaks,
  findLocalMaxima,
  mapConfirmedPeakRows,
} from '../src/utils/stockUtils';
import type { CsindexHistoryRow, KLineData } from '../src/utils/stockUtils';
import { approx, assert, eq, summary } from './testUtils';

// ============================================================
// A. calculateMACD — MACD(12,26,9) 口径
// ============================================================
console.log('\n── A. calculateMACD ──');
{
  eq(calculateMACD({ data: [] }).length, 0, 'A1 空数据 → 空数组');
}
{
  const data: KLineData[] = [10, 11, 12, 11, 13, 14, 13, 15, 16, 15, 14, 16, 17, 18, 17, 16, 18, 19, 20, 19]
    .map((收盘, index) => ({ 日期: `2024-01-${String(index + 1).padStart(2, '0')}`, 收盘 }));

  const result = calculateMACD({ data });
  eq(result.length, data.length, 'A2 返回与输入等长');
  eq(result[0].__MACD_DIF__, 0, 'A3 首根 DIF = 0');
  eq(result[0].__MACD_DEA__, 0, 'A4 首根 DEA = 0');
  eq(result[0].__MACD_BAR__, 0, 'A5 首根 MACD 柱 = 0');

  const last = result[result.length - 1];
  approx(last.__MACD_DIF__, 2.1299, 'A6 末根 DIF 符合 EMA(12/26) 递推', 0.0001);
  approx(last.__MACD_DEA__, 1.7717, 'A7 末根 DEA 符合 DIF 的 EMA(9)', 0.0001);
  approx(last.__MACD_BAR__, 0.7163, 'A8 末根 MACD 柱 = 2 × (DIF − DEA)', 0.0001);
  approx(last.__MACD_DEA_MINUS_DIF__, -0.3582, 'A9 末根 DEA-DIF = DEA − DIF', 0.0001);
  approx(last.__MACD_DEA_DIV_DIF__ as number, 0.8318, 'A10 末根 DEA÷DIF = DEA / DIF', 0.0001);
}
{
  const data: KLineData[] = Array.from({ length: 10 }, (_, index) => ({
    日期: `2024-02-${String(index + 1).padStart(2, '0')}`,
    收盘: 5,
  }));
  const result = calculateMACD({ data });
  const allZero = result.every((row) => row.__MACD_DIF__ === 0 && row.__MACD_DEA__ === 0 && row.__MACD_BAR__ === 0);
  assert(allZero, 'A11 恒定收盘价 → DIF/DEA/柱 全为 0');
  const ratioAllNull = result.every((row) => row.__MACD_DEA_DIV_DIF__ === null);
  assert(ratioAllNull, 'A12 恒定收盘价（DIF=0）→ DEA÷DIF 全为 null');
}
{
  const data: KLineData[] = [1, 2, 3, 4, 5].map((收盘, index) => ({
    日期: `2024-03-0${index + 1}`,
    收盘,
  }));
  const result = calculateMACD({ data });
  const barMatches = result.every(
    (row) => Math.abs(row.__MACD_BAR__ - 2 * (row.__MACD_DIF__ - row.__MACD_DEA__)) <= 0.0002,
  );
  assert(barMatches, 'A13 每根 MACD 柱 = 2 × (DIF − DEA)');
  const deaMinusDifMatches = result.every(
    (row) => Math.abs(row.__MACD_DEA_MINUS_DIF__ - (row.__MACD_DEA__ - row.__MACD_DIF__)) <= 0.0002,
  );
  assert(deaMinusDifMatches, 'A14 每根 DEA-DIF = DEA − DIF');
  const ratioMatches = result.every((row) => {
    if (row.__MACD_DEA_DIV_DIF__ === null) return row.__MACD_DIF__ === 0;
    if (row.__MACD_DIF__ === 0) return false;
    return Math.abs((row.__MACD_DEA_DIV_DIF__ as number) - row.__MACD_DEA__ / row.__MACD_DIF__) <= 0.0002;
  });
  assert(ratioMatches, 'A15 每根 DEA÷DIF = DEA / DIF（DIF=0 时为 null）');
}

// ============================================================
// B. cleanCsindexHistory — 起始日占位行清洗
// ============================================================
console.log('\n── B. cleanCsindexHistory ──');

type IndexRow = CsindexHistoryRow & { 开盘?: number | null };

const baseRows: IndexRow[] = [
  // 接口在 1990-12-19 补的占位行：数值与下一条真实数据完全相同
  { 日期: '1990-12-19T00:00:00.000', 收盘: 1000, 成交量: 0, 成交金额: 0, 开盘: null },
  { 日期: '2004-12-31T00:00:00.000', 收盘: 1000, 成交量: 0, 成交金额: 0, 开盘: null },
  { 日期: '2005-01-04T00:00:00.000', 收盘: 984.4, 成交量: 1106523350, 成交金额: 64.29, 开盘: 995.34 },
];

{
  const cleaned = cleanCsindexHistory(baseRows, '19901219');
  eq(cleaned.length, 2, 'B1 剔除起始日占位行');
  eq(cleaned[0].日期, '2004-12-31T00:00:00.000', 'B2 保留指数基日真实记录');
  eq(cleaned[1].收盘, 984.4, 'B3 保留后续真实行情');
}
{
  // 真实数据恰好从起始日开始：首条与第二条数值不同，不应被误删
  const rows: IndexRow[] = [
    { 日期: '2005-01-04T00:00:00.000', 收盘: 984.4, 成交量: 1106523350, 成交金额: 64.29 },
    { 日期: '2005-01-05T00:00:00.000', 收盘: 997.13, 成交量: 1276698961, 成交金额: 75.32 },
  ];
  eq(cleanCsindexHistory(rows, '20050104').length, 2, 'B4 真实数据从起始日开始时不剔除');
}
{
  const rows: IndexRow[] = [
    { 日期: '1980-01-01T00:00:00.000', 收盘: 1316.46, 成交量: 157946023, 成交金额: 15.89 },
    { 日期: '2002-01-04T00:00:00.000', 收盘: 1316.46, 成交量: 157946023, 成交金额: 15.89 },
    { 日期: '2002-01-07T00:00:00.000', 收盘: 1302.08, 成交量: 159786501, 成交金额: 15.46 },
  ];
  const cleaned = cleanCsindexHistory(rows, '19800101');
  eq(cleaned.length, 2, 'B5 起始日与下一条重复时剔除');
  eq(cleaned[0].日期, '2002-01-04T00:00:00.000', 'B6 保留首条真实数据');
}
{
  const rows: IndexRow[] = [
    { 日期: '2020-01-02T00:00:00.000', 收盘: NaN, 成交量: 1, 成交金额: 1 },
    { 日期: '2020-01-03T00:00:00.000', 收盘: 0, 成交量: 1, 成交金额: 1 },
    { 日期: '2020-01-06T00:00:00.000', 收盘: 3000, 成交量: 1, 成交金额: 1 },
  ];
  const cleaned = cleanCsindexHistory(rows, '20200101');
  eq(cleaned.length, 1, 'B7 过滤收盘价为空 / 非正的记录');
  eq(cleaned[0].收盘, 3000, 'B8 保留有效收盘价记录');
}
{
  eq(cleanCsindexHistory(undefined, '19901219').length, 0, 'B9 undefined → 空数组');
  eq(cleanCsindexHistory([], '19901219').length, 0, 'B10 空数组 → 空数组');
}

// ============================================================
// C. findLocalMaxima — 滚动窗口峰值检测
// ============================================================
console.log('\n── C. findLocalMaxima ──');
{
  eq(
    JSON.stringify(findLocalMaxima([1, 2, 3, 2, 1], 1)),
    JSON.stringify([2]),
    'C1 window=1 单一波峰',
  );
  eq(
    JSON.stringify(findLocalMaxima([1, 2, 3, 2, 1], 2)),
    JSON.stringify([2]),
    'C2 window=2 单一波峰',
  );
  eq(
    JSON.stringify(findLocalMaxima([1, 3, 3, 1], 1)),
    JSON.stringify([]),
    'C3 平台期不重复标记',
  );
  eq(
    JSON.stringify(findLocalMaxima([5, 1, 2, 1, 5], 1)),
    JSON.stringify([2]),
    'C4 首尾点不标记',
  );
  eq(
    JSON.stringify(findLocalMaxima([1, 2, null, 2, 1], 1)),
    JSON.stringify([]),
    'C5 断点附近不标记',
  );
  eq(
    JSON.stringify(findLocalMaxima([-5, -4, -3, -4, -5], 1, { requirePositive: true })),
    JSON.stringify([]),
    'C6 requirePositive=true 不标记负值峰值',
  );
  eq(
    JSON.stringify(findLocalMaxima([-5, -4, -3, -4, -5], 1)),
    JSON.stringify([2]),
    'C7 requirePositive=false 标记负值局部高点',
  );
  eq(
    JSON.stringify(findLocalMaxima([1, 5, 4, 3, 6, 2], 2)),
    JSON.stringify([1, 4]),
    'C8 窗口内最高才标记，可返回多个峰值',
  );
  eq(findLocalMaxima([1, 2], 1).length, 0, 'C9 少于 3 个点 → 空数组');
  eq(findLocalMaxima([], 1).length, 0, 'C10 空数组 → 空数组');
}

// ============================================================
// D. findConfirmedPeaks — as-of 峰值确认
// ============================================================
console.log('\n── D. findConfirmedPeaks ──');
{
  const peaks = findConfirmedPeaks([1, 2, 3, 2, 1], 3, 1);
  eq(
    JSON.stringify(peaks),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 3 }]),
    'D1 峰值后 1 根确认',
  );
}
{
  eq(
    JSON.stringify(findConfirmedPeaks([1, 2, 3, 4, 5], 3, 1)),
    JSON.stringify([]),
    'D2 持续上涨、尚无回落 → 不确认',
  );
}
{
  const peaks = findConfirmedPeaks([1, 2, 3, 0, 1], 3, 1);
  eq(
    JSON.stringify(peaks),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 3 }]),
    'D3 峰值后明显回落 → 确认',
  );
}
{
  eq(
    JSON.stringify(findConfirmedPeaks([1, 3, 3, 1], 3, 1)),
    JSON.stringify([]),
    'D4 平台期不确认',
  );
}
{
  eq(
    JSON.stringify(findConfirmedPeaks([1, 2, 3, null, 1], 3, 1)),
    JSON.stringify([]),
    'D5 确认根为断点 → 不确认',
  );
}
{
  const peaks = findConfirmedPeaks([1, 2, 3, 2, 1], 2, 2);
  eq(
    JSON.stringify(peaks),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 4 }]),
    'D6 确认滞后 2 根',
  );
}
{
  // 季K 2023-03 ~ 2024-09 的真实比值序列：2024-06 为过去 4 季最高，下一季回落
  const peaks = findConfirmedPeaks([1.3, 1.4, 1.56, 1.7, 1.78, 1.91, 1.78], 4, 1);
  eq(
    JSON.stringify(peaks),
    JSON.stringify([{ peakIndex: 5, confirmIndex: 6 }]),
    'D7 2024-06 峰值在下一季确认',
  );
}
{
  eq(
    JSON.stringify(findConfirmedPeaks([-3, -2, -1, -2], 3, 1, { requirePositive: true })),
    JSON.stringify([]),
    'D8 requirePositive=true 不确认负值峰值',
  );
  eq(
    JSON.stringify(findConfirmedPeaks([-3, -2, -1, -2], 3, 1)),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 3 }]),
    'D9 requirePositive=false 可确认负值局部高点',
  );
}
{
  eq(findConfirmedPeaks([1, 2], 3, 1).length, 0, 'D10 数据不足回看窗口 → 空数组');
  eq(findConfirmedPeaks([], 3, 1).length, 0, 'D11 空数组 → 空数组');
}

// ============================================================
// E. mapConfirmedPeakRows — 峰值行/确认行映射（买点表数据来源）
// ============================================================
console.log('\n── E. mapConfirmedPeakRows ──');
{
  const rows = [
    { 日期: '2024-03-29', 收盘: 100 },
    { 日期: '2024-06-28', 收盘: 110 },
    { 日期: '2024-09-30', 收盘: 120 },
    { 日期: '2024-12-31', 收盘: 130 },
  ];
  const pairs = mapConfirmedPeakRows(rows, [{ peakIndex: 1, confirmIndex: 2 }]);
  eq(pairs.length, 1, 'E1 单条峰值 → 1 组行');
  eq(pairs[0].peakRow.日期, '2024-06-28', 'E2 峰值行取 peakIndex');
  eq(pairs[0].confirmRow.日期, '2024-09-30', 'E3 确认行取 confirmIndex');
  eq(pairs[0].peakRow.收盘, 110, 'E4 峰值收盘价取峰值日');
  eq(pairs[0].confirmRow.收盘, 120, 'E5 买入收盘价取确认日');
}
{
  const rows = [
    { 日期: '2024-03-29', 收盘: 100 },
    { 日期: '2024-06-28', 收盘: 110 },
  ];
  eq(
    mapConfirmedPeakRows(rows, [{ peakIndex: 1, confirmIndex: 2 }]).length,
    0,
    'E6 确认索引越界 → 跳过该条',
  );
  eq(mapConfirmedPeakRows(rows, []).length, 0, 'E7 空峰值 → 空数组');
}
{
  // 用 2024-06 季K真实比值序列串起 findConfirmedPeaks + mapConfirmedPeakRows：
  // 峰值 2024-06-28，确认日（买入日）2024-09-30
  const rows = [
    { 日期: '2023-03-31', 收盘: 100 },
    { 日期: '2023-06-30', 收盘: 105 },
    { 日期: '2023-09-29', 收盘: 110 },
    { 日期: '2023-12-29', 收盘: 115 },
    { 日期: '2024-03-29', 收盘: 120 },
    { 日期: '2024-06-28', 收盘: 125 },
    { 日期: '2024-09-30', 收盘: 130 },
  ];
  const ratios = [1.3, 1.4, 1.56, 1.7, 1.78, 1.91, 1.78];
  const peaks = findConfirmedPeaks(ratios, 4, 1, { requirePositive: true });
  const pairs = mapConfirmedPeakRows(rows, peaks);
  eq(pairs.length, 1, 'E8 2024-06 只产生一条确认峰值');
  eq(pairs[0].peakRow.日期, '2024-06-28', 'E9 峰值日期为 2024-06-28');
  eq(pairs[0].confirmRow.日期, '2024-09-30', 'E10 买入日期为峰值后第 1 根 2024-09-30');
  eq(pairs[0].peakRow.收盘, 125, 'E11 峰值收盘价取 2024-06-28 收盘');
  eq(pairs[0].confirmRow.收盘, 130, 'E12 买入收盘价取 2024-09-30 收盘');
}

// ============================================================
// F. calculateMACD — 边界与参数化
// ============================================================
console.log('\n── F. calculateMACD 边界 ──');
{
  const rows = calculateMACD({ data: [{ 日期: '2024-01-01', 收盘: 5 }] });
  eq(rows.length, 1, 'F1 单根数据返回 1 行');
  eq(rows[0].__MACD_DIF__, 0, 'F2 单根 DIF = 0');
  eq(rows[0].__MACD_DEA__, 0, 'F3 单根 DEA = 0');
  eq(rows[0].__MACD_BAR__, 0, 'F4 单根 MACD 柱 = 0');
  eq(rows[0].__MACD_DEA_DIV_DIF__, null, 'F5 单根 DEA÷DIF = null');
}
{
  const data: KLineData[] = [10, 11, 12, 11, 13].map((收盘, index) => ({
    日期: `2024-01-0${index + 1}`,
    收盘,
  }));
  const rows = calculateMACD({ data });
  const allFinite = rows.every(
    (row) =>
      Number.isFinite(row.__MACD_DIF__) &&
      Number.isFinite(row.__MACD_DEA__) &&
      Number.isFinite(row.__MACD_BAR__) &&
      (row.__MACD_DEA_DIV_DIF__ == null || Number.isFinite(row.__MACD_DEA_DIV_DIF__)),
  );
  assert(allFinite, 'F6 数据少于慢线周期时 DIF/DEA/柱/比值仍为有限值');
}
{
  const data: KLineData[] = [10, 11, 12, 11, 13].map((收盘, index) => ({
    日期: `2024-02-0${index + 1}`,
    收盘,
  }));
  const rows = calculateMACD({ data, fastPeriod: 2, slowPeriod: 3, signalPeriod: 2 });
  const last = rows[rows.length - 1];
  approx(last.__MACD_DIF__, 0.3326, 'F7 自定义周期 (2,3,2) 末根 DIF', 0.0001);
  approx(last.__MACD_DEA__, 0.2618, 'F8 自定义周期 (2,3,2) 末根 DEA', 0.0001);
  approx(last.__MACD_BAR__, 0.1415, 'F9 自定义周期 (2,3,2) 末根 MACD 柱', 0.0001);
}
{
  const data: KLineData[] = [
    { 日期: '2024-03-01', 收盘: 10 },
    { 日期: '2024-03-02', 收盘: Number.NaN },
    { 日期: '2024-03-03', 收盘: 12 },
  ];
  const rows = calculateMACD({ data });
  const allFinite = rows.every(
    (row) =>
      Number.isFinite(row.__MACD_DIF__) &&
      Number.isFinite(row.__MACD_DEA__) &&
      Number.isFinite(row.__MACD_BAR__),
  );
  assert(allFinite, 'F10 收盘价 NaN 按 0 处理，不产生 NaN 扩散');
}
{
  // 基金累计收益率可能为负，MACD 仍需保持有限值
  const data: KLineData[] = [-10, -11, -12, -11, -10, -8].map((收盘, index) => ({
    日期: `2024-04-0${index + 1}`,
    收盘,
  }));
  const rows = calculateMACD({ data });
  const allFinite = rows.every(
    (row) =>
      Number.isFinite(row.__MACD_DIF__) &&
      Number.isFinite(row.__MACD_DEA__) &&
      Number.isFinite(row.__MACD_BAR__) &&
      (row.__MACD_DEA_DIV_DIF__ == null || Number.isFinite(row.__MACD_DEA_DIV_DIF__)),
  );
  assert(allFinite, 'F11 负值收盘序列（基金累计收益率）仍保持有限值');
}

// ============================================================
// G. findConfirmedPeaks — 确认序列与显示裁剪隔离
// ============================================================
console.log('\n── G. findConfirmedPeaks 确认序列 ──');
{
  // 峰值序列在确认根被显示裁剪为 null，但真实比值 0 确实低于峰值 3
  const peaks = findConfirmedPeaks([1, 2, 3, null, 1], 3, 1, {
    confirmValues: [1, 2, 3, 0, 1],
  });
  eq(
    JSON.stringify(peaks),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 3 }]),
    'G1 确认值使用真实比值 → 可确认',
  );
}
{
  eq(
    JSON.stringify(findConfirmedPeaks([1, 2, 3, null, 1], 3, 1)),
    JSON.stringify([]),
    'G2 未提供 confirmValues 时断点 → 不确认',
  );
}
{
  eq(
    JSON.stringify(
      findConfirmedPeaks([1, 2, 3, null, 1], 3, 1, { confirmValues: [1, 2, 3, 4, 1] }),
    ),
    JSON.stringify([]),
    'G3 确认值更高 → 不算回落',
  );
  eq(
    JSON.stringify(
      findConfirmedPeaks([1, 2, 3, null, 1], 3, 1, { confirmValues: [1, 2, 3, null, 1] }),
    ),
    JSON.stringify([]),
    'G4 确认值为 null → 不确认',
  );
  eq(
    JSON.stringify(
      findConfirmedPeaks([1, 2, 3, null, 1], 3, 1, { confirmValues: [1, 2, 3] }),
    ),
    JSON.stringify([]),
    'G5 确认序列长度不足 → 不确认',
  );
  eq(
    JSON.stringify(
      findConfirmedPeaks([1, 2, 3, null, 1], 3, 1, { confirmValues: [1, 2, 3, -50, 1] }),
    ),
    JSON.stringify([{ peakIndex: 2, confirmIndex: 3 }]),
    'G6 真实确认值为负向极端值 → 仍可确认',
  );
  // 上一根被显示裁剪为 null，但真实值 -50 更低：当前 3 仍是有效峰值
  eq(
    JSON.stringify(
      findConfirmedPeaks([null, 3, 2], 2, 1, { confirmValues: [-50, 3, 2] }),
    ),
    JSON.stringify([{ peakIndex: 1, confirmIndex: 2 }]),
    'G7 前一根本身被裁剪时，用真实值判断新高',
  );
  // 上一根真实值 50 更高：当前 3 不是峰值
  eq(
    JSON.stringify(
      findConfirmedPeaks([null, 3, 2], 2, 1, { confirmValues: [50, 3, 2] }),
    ),
    JSON.stringify([]),
    'G8 前一根真实值更高 → 不标记',
  );
}

summary();
