import type { XlsxCellStyle, XlsxCellValue, XlsxColumn } from './xlsxExport';

/**
 * Excel 报告公共样式与汇总统计
 *
 * 「买入&卖出报告 / 买入计划」与「最低 MACD 柱月K标记」导出共用：
 * 表头、明细、汇总行样式，以及平均值 / 中位数 / 方差 / 标准差的计算口径。
 * 本模块只影响展示与统计，不参与任何策略口径。
 */

/** 深蓝表头（白字加粗居中、自动换行） */
export const HEADER_STYLE: XlsxCellStyle = {
  bold: true,
  color: 'FFFFFF',
  backgroundColor: '1F4E79',
  align: 'center',
  wrapText: true,
  border: 'thin',
  borderColor: '163A5C',
};

export const HEADER_ROW_HEIGHT = 45;
export const DETAIL_ROW_HEIGHT = 20;
export const SUMMARY_ROW_HEIGHT = 22;
/** 明细区隔行底色与细边框 */
export const ZEBRA_BACKGROUND = 'F7F9FC';
const DETAIL_BORDER_COLOR = 'DCE3EC';
/** 汇总区暖色底：均值/中位数一档、离散度指标一档，顶部用金色中粗线分隔 */
const SUMMARY_MEAN_BACKGROUND = 'FFF2CC';
const SUMMARY_DISPERSION_BACKGROUND = 'FCE4D6';
const SUMMARY_BORDER_COLOR = 'E3C26B';
const SUMMARY_TOP_BORDER_COLOR = 'BF8F00';
const SUMMARY_LABEL_COLOR = '7F6000';
/** 收益率正负配色（A 股习惯：红涨绿跌） */
const POSITIVE_RETURN_COLOR = 'C00000';
const NEGATIVE_RETURN_COLOR = '008000';
const MUTED_COLOR = 'A6A6A6';

/** 列类型：决定对齐、数字格式与是否按正负着色 */
export type ReportColumnKind =
  | 'code'
  | 'name'
  | 'level'
  | 'date'
  | 'price'
  | 'rsi'
  | 'days'
  | 'count'
  | 'returnRate'
  | 'drawdown'
  | 'ratio'
  | 'text';

/**
 * 按列标题识别列类型：
 * 先判「天数」，避免「买点到最大回撤率的被套天数」被误判为回撤率列；
 * MACD 相关列（最低MACD柱 / 下一周期MACD）按两位小数数值列展示。
 */
export const classifyColumn = (title: string): ReportColumnKind => {
  if (title === '代码') return 'code';
  if (title === '名称') return 'name';
  if (title === '推荐级别') return 'level';
  if (/天数/.test(title)) return 'days';
  if (/柱数|根数|总长/.test(title)) return 'count';
  if (/日期/.test(title)) return 'date';
  if (/收盘价|价格/.test(title)) return 'price';
  if (/RSI6/.test(title)) return 'rsi';
  if (/收益率|浮盈率/.test(title)) return 'returnRate';
  if (/最大回撤率/.test(title)) return 'drawdown';
  if (/MACD|Calmar/.test(title)) return 'ratio';
  return 'text';
};

/** 各类列的默认对齐 */
const columnAlign = (kind: ReportColumnKind): 'left' | 'center' | 'right' => {
  if (kind === 'name') return 'left';
  if (kind === 'code' || kind === 'level' || kind === 'date' || kind === 'text') return 'center';
  return 'right';
};

/** 各类列的数字格式（字符串列不设置） */
const columnNumberFormat = (kind: ReportColumnKind): string | undefined => {
  if (kind === 'returnRate' || kind === 'drawdown') return '0.00"%"';
  if (kind === 'price') return '#,##0.00';
  if (kind === 'days' || kind === 'count') return '0';
  if (kind === 'rsi' || kind === 'ratio') return '0.00';
  return undefined;
};

/** 明细单元格样式：统一细边框 + 隔行底色（行级）+ 收益率红正绿负 + 推荐级别金色 */
export const detailCellStyle = (title: string, value: XlsxCellValue): XlsxCellStyle => {
  const kind = classifyColumn(title);
  const style: XlsxCellStyle = {
    border: 'thin',
    borderColor: DETAIL_BORDER_COLOR,
    align: columnAlign(kind),
    numberFormat: typeof value === 'number' ? columnNumberFormat(kind) : undefined,
  };

  if (kind === 'level') {
    style.bold = true;
    style.color = 'BF8F00';
    // ★ 列浅金底，整列在明细中一眼可见
    style.backgroundColor = 'FFF8E1';
  }

  if (typeof value === 'number' && kind === 'returnRate') {
    if (value > 0) style.color = POSITIVE_RETURN_COLOR;
    else if (value < 0) style.color = NEGATIVE_RETURN_COLOR;
  }

  // 缺失值统一灰字居中，避免 '-' 抢视觉焦点
  if (value == null || value === '' || value === '-') {
    style.align = 'center';
    style.color = MUTED_COLOR;
  }

  return style;
};

/** 汇总行单元格样式：暖色底 + 加粗 + 顶部金色分隔线；收益率均值保留红正绿负 */
export const summaryCellStyle = (
  title: string,
  label: string,
  value: XlsxCellValue,
  isFirstSummaryRow: boolean,
  isLabelColumn: boolean,
): XlsxCellStyle => {
  const kind = classifyColumn(title);
  const isDispersion =
    label === '样本方差' || label === '样本标准差' || label === '总体方差' || label === '总体标准差';
  const style: XlsxCellStyle = {
    bold: true,
    backgroundColor: isDispersion ? SUMMARY_DISPERSION_BACKGROUND : SUMMARY_MEAN_BACKGROUND,
    border: 'thin',
    borderColor: SUMMARY_BORDER_COLOR,
    topBorder: isFirstSummaryRow ? 'medium' : undefined,
    align: columnAlign(kind),
    numberFormat: typeof value === 'number' ? columnNumberFormat(kind) : undefined,
  };
  if (isFirstSummaryRow) style.borderColor = SUMMARY_TOP_BORDER_COLOR;

  if (isLabelColumn) {
    // 第一列汇总标签
    style.align = 'left';
    style.color = SUMMARY_LABEL_COLOR;
  } else if (typeof value === 'number' && kind === 'returnRate' && !isDispersion) {
    // 方差/标准差恒为非负，按正负着色会全红，故只给均值/中位数着色
    if (value > 0) style.color = POSITIVE_RETURN_COLOR;
    else if (value < 0) style.color = NEGATIVE_RETURN_COLOR;
  }

  return style;
};

/** 平均值：抗不了极值，作为常规参考 */
const averageOf = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** 中位数：样本量小且存在极值（如个别数倍收益）时更能代表典型水平 */
const medianOf = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * 方差：衡量各笔收益率偏离平均值的离散程度，越大代表单笔结果波动越大、稳定性越差。
 * sample = true 为样本方差（除以 n−1，样本量不足 2 时无法计算）；false 为总体方差（除以 n）。
 */
const varianceOf = (values: number[], sample: boolean): number | null => {
  const count = values.length;
  if (count === 0 || (sample && count < 2)) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const sumOfSquares = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return sumOfSquares / (sample ? count - 1 : count);
};

/** 样本方差（n−1 口径）：把导出的这些交易视为总体中的一个样本 */
const sampleVarianceOf = (values: number[]): number | null => varianceOf(values, true);

/** 总体方差（n 口径）：把导出的这些交易视为全部总体 */
const populationVarianceOf = (values: number[]): number | null => varianceOf(values, false);

/**
 * 标准差 = 方差的算术平方根，与收益率同量纲（%），
 * 便于直观判断单笔收益率的典型波动幅度；越大代表波动越剧烈。
 */
const stdDevOf = (values: number[], sample: boolean): number | null => {
  const variance = varianceOf(values, sample);
  return variance == null ? null : Math.sqrt(variance);
};

/** 样本标准差（n−1 口径） */
const sampleStdDevOf = (values: number[]): number | null => stdDevOf(values, true);

/** 总体标准差（n 口径） */
const populationStdDevOf = (values: number[]): number | null => stdDevOf(values, false);

/** 底部汇总行定义（顺序固定） */
export const SUMMARY_DEFS: {
  label: string;
  aggregate: (values: number[]) => number | null;
}[] = [
  { label: '平均值', aggregate: averageOf },
  { label: '中位数', aggregate: medianOf },
  // 统计学离散度指标：方差/标准差越大，说明各笔收益率的波动越大、结果越不稳定
  { label: '样本方差', aggregate: sampleVarianceOf },
  { label: '样本标准差', aggregate: sampleStdDevOf },
  { label: '总体方差', aggregate: populationVarianceOf },
  { label: '总体标准差', aggregate: populationStdDevOf },
];

/**
 * 生成表格底部的汇总行：
 * 数值列按 aggregate 统计（平均值 / 中位数 / 方差 / 标准差，保留两位小数），
 * 排除列（文本/日期/价格类）留空；缺失值（'-'、空串）不参与统计；无法计算（如样本量不足）时留空
 */
export const buildSummaryRow = (
  rows: XlsxCellValue[][],
  label: string,
  aggregate: (values: number[]) => number | null,
  columns: XlsxColumn[],
  excludedTitles: Set<string>,
): XlsxCellValue[] =>
  columns.map((column, index) => {
    if (index === 0) return label;
    if (excludedTitles.has(column.title)) return '';
    const numbers = rows
      .map(row => row[index])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numbers.length === 0) return '';
    const aggregated = aggregate(numbers);
    return aggregated == null || !Number.isFinite(aggregated) ? '' : Number(aggregated.toFixed(2));
  });
