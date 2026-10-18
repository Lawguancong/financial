import moment from 'moment';
import { message } from 'antd';
import { runRecommendationBatchCalculation } from './recommendationBatch';
import { downloadXlsx } from './xlsxExport';
import type { XlsxCellValue, XlsxColumn } from './xlsxExport';
import type { MonthlyQuarterlyPercentileBuyPoint } from './stockUtils';

/**
 * 「买入&卖出报告」/「买入计划」导出公共逻辑
 *
 * 各页面（个股 / 指数 / 大宗商品 / 外盘期货 / 基金）仅需提供「取数 + 计算月&季 RSI6 明细」
 * 的方法，其余筛选、排序、单元格映射、平均值汇总行、文件下载与提示统一在此实现，
 * 保证各页面导出功能与格式完全一致。
 */

/** 导出列：参考 RsiFilterMark「月&季 RSI6 百分位策略」表格列 */
export const BUY_SELL_REPORT_COLUMNS: XlsxColumn[] = [
  { title: '代码' },
  { title: '名称' },
  { title: '推荐级别' },
  { title: '买入日期' },
  { title: '买入收盘价' },
  { title: '买入月RSI6' },
  { title: '买入季RSI6' },
  { title: '卖出日期' },
  { title: '卖出收盘价' },
  { title: '卖出月RSI6' },
  { title: '卖出季RSI6' },
  { title: '持有天数' },
  { title: '收益率' },
  { title: '年化收益率' },
  { title: '最大回撤率' },
  { title: '最大回撤的日期' },
  { title: '最大回撤的收盘价' },
  { title: '买点到最大回撤率的被套天数' },
  { title: 'Calmar比率（年化收益 / 最大回撤）' },
];

/** 报告行：所属标的 + 单条 ★5 月&季 RSI6 共振买卖点 */
export interface BuySellReportItem {
  code: string;
  name: string;
  point: MonthlyQuarterlyPercentileBuyPoint;
}

/**
 * 批量导出并发数：单只耗时主要在 HTTP 取数（数千根日线），
 * 提高到 8 个在途取数以缩短导出等待；RSI 计算仍由 4 个 Worker 排队处理，不额外占 CPU
 */
export const REPORT_BATCH_CONCURRENCY = 8;

/** 日期格式化为 YYYY-MM-DD（空值返回空串） */
const formatReportDate = (date?: string): string => (date ? moment(date).format('YYYY-MM-DD') : '');

/** 「买入&卖出报告」筛选：仅已完成买卖配对的 ★5 买点（★1 / ★3 不计入） */
export const pickPairedFiveStarBuys = (
  points: MonthlyQuarterlyPercentileBuyPoint[],
): MonthlyQuarterlyPercentileBuyPoint[] =>
  points.filter(point => point.level === 5 && point.sellDate != null);

/**
 * 「买入计划」筛选：最近一次 ★5 配对卖出之后、尚未卖出的 ★5 买入（可有多条），
 * 即当前持仓周期内出现的所有 ★5 买入信号。
 *
 * 明细按日期升序，日期与卖出日期为同一口径，直接按字符串比较。
 */
export const pickOpenFiveStarBuys = (
  points: MonthlyQuarterlyPercentileBuyPoint[],
): MonthlyQuarterlyPercentileBuyPoint[] => {
  // 最近一次 ★5 配对卖出的卖出日期；无配对卖出时视为从最早开始（空串小于任何日期）
  const lastSellDate = points.reduce(
    (latest, point) =>
      point.level === 5 && point.sellDate && point.sellDate > latest ? point.sellDate : latest,
    '',
  );
  return points.filter(
    point => point.level === 5 && point.sellDate == null && point.日期 > lastSellDate,
  );
};

/** 单条 ★5 买卖点 -> 导出单元格行（数值列写数字，缺失列留空） */
const toReportCells = ({ code, name, point }: BuySellReportItem): XlsxCellValue[] => [
  code,
  name,
  '★'.repeat(point.level),
  formatReportDate(point.日期),
  Number(point.收盘.toFixed(2)),
  Number(point.monthlyRsi.toFixed(2)),
  Number(point.quarterlyRsi.toFixed(2)),
  formatReportDate(point.sellDate),
  // 与 BUY_SELL_REPORT_COLUMNS 表头严格对齐：卖出日期 -> 卖出收盘价 -> 卖出月RSI6 -> 卖出季RSI6
  point.sellPrice != null ? point.sellPrice : '',
  point.sellMonthlyRsi != null ? Number(point.sellMonthlyRsi.toFixed(2)) : '',
  point.sellQuarterlyRsi != null ? Number(point.sellQuarterlyRsi.toFixed(2)) : '',
  point.holdingDays != null ? point.holdingDays : '',
  point.returnRate != null ? Number(point.returnRate.toFixed(2)) : '',
  // 持有天数不足 1 年（无法年化）时，年化收益率直接展示与「收益率」相同的数值
  point.annualizedReturn != null
    ? Number(point.annualizedReturn.toFixed(2))
    : point.returnRate != null
      ? Number(point.returnRate.toFixed(2))
      : '-',
  point.maxDrawdown != null ? point.maxDrawdown : '-',
  point.maxDrawdownDate ?? '-',
  point.maxDrawdownClose != null ? point.maxDrawdownClose : '-',
  point.daysToMaxDrawdown != null ? point.daysToMaxDrawdown : '-',
  point.calmarRatio != null
    ? point.calmarRatio
    : // 持有天数不足 1 年时 Calmar 无法计算，直接展示与「收益率」相同的数值
      point.holdingDays != null && point.holdingDays < 365 && point.returnRate != null
      ? Number(point.returnRate.toFixed(2))
      : '-',
];

/** 汇总行不参与平均值计算的列：文本/日期列，以及买入、卖出收盘价与最大回撤的收盘价（价格类列不取均值） */
const REPORT_AVERAGE_EXCLUDED_TITLES = new Set([
  '代码',
  '名称',
  '推荐级别',
  '买入日期',
  '卖出日期',
  '最大回撤的日期',
  '买入收盘价',
  '卖出收盘价',
  '最大回撤的收盘价',
]);

/**
 * 生成表格底部的平均值汇总行：
 * 数值列取均值（保留两位小数），文本/日期列与价格类列（买入/卖出/最大回撤的收盘价）留空
 */
const buildAverageRow = (rows: XlsxCellValue[][]): XlsxCellValue[] =>
  BUY_SELL_REPORT_COLUMNS.map((column, index) => {
    if (index === 0) return '平均值';
    if (REPORT_AVERAGE_EXCLUDED_TITLES.has(column.title)) return '';
    const numbers = rows
      .map(row => row[index])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numbers.length === 0) return '';
    const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    return Number(average.toFixed(2));
  });

export interface BuyPointExportOptions<T> {
  /** 待导出的目标列表（调用方已按勾选过滤） */
  targets: T[];
  /** 导出「代码」列取值 */
  getCode: (item: T) => string;
  /** 导出「名称」列取值 */
  getName: (item: T) => string;
  /** 唯一标识（异常日志用） */
  getKey?: (item: T) => string;
  /** 取该标的的月&季 RSI6 明细（含 ★5 配对卖出信息） */
  fetchPoints: (item: T) => Promise<MonthlyQuarterlyPercentileBuyPoint[]>;
  /** 未勾选任何标的时的提示文案 */
  emptyWarn: string;
  /** 标的名词，用于「无信号」提示（如「股票」「指数」「基金」「品种」） */
  itemLabel: string;
  /** 导出文件名前缀（标的类型），用于区分不同页面下载的报表，如「A股个股」「港股指数」 */
  filePrefix: string;
  /** 并发取数数量，默认 REPORT_BATCH_CONCURRENCY */
  concurrency?: number;
}

/** 按买入日期倒序（最近信号在前）、同日按代码升序排列导出明细 */
const sortReportItems = (items: BuySellReportItem[]): BuySellReportItem[] =>
  items.sort((a, b) => {
    const dateCompare = b.point.日期.localeCompare(a.point.日期);
    return dateCompare !== 0 ? dateCompare : a.code.localeCompare(b.code);
  });

/** 批量取数 + 过滤 -> 明细行 -> 下载 xlsx（两个导出功能共用主流程） */
const runReportExport = async <T>(
  options: BuyPointExportOptions<T>,
  pickPoints: (points: MonthlyQuarterlyPercentileBuyPoint[]) => MonthlyQuarterlyPercentileBuyPoint[],
  output: { fileName: string; sheetName: string; emptyMessage: string; successMessage: (count: number) => string },
): Promise<void> => {
  const { targets, getCode, getName, getKey, fetchPoints, emptyWarn, itemLabel } = options;

  const reportItems: BuySellReportItem[] = [];
  await runRecommendationBatchCalculation<
    T,
    { code: string; name: string; points: MonthlyQuarterlyPercentileBuyPoint[] }
  >({
    targets,
    getKey,
    getName,
    emptyWarn,
    concurrency: options.concurrency ?? REPORT_BATCH_CONCURRENCY,
    fetchBuyPoints: async item => {
      const points = pickPoints(await fetchPoints(item));
      return { code: getCode(item), name: getName(item), points };
    },
    onItemDone: (_item, { code, name, points }) => {
      points.forEach(point => reportItems.push({ code, name, point }));
    },
  });

  if (reportItems.length === 0) {
    message.info(output.emptyMessage.replace('{label}', itemLabel));
    return;
  }

  sortReportItems(reportItems);

  // 明细行 + 底部每列平均值汇总行
  const rows = reportItems.map(toReportCells);
  rows.push(buildAverageRow(rows));
  downloadXlsx(output.fileName, output.sheetName, BUY_SELL_REPORT_COLUMNS, rows);
  message.success(output.successMessage(reportItems.length));
};

/**
 * 导出「买入&卖出报告」：对勾选标的计算「月&季 RSI6 百分位策略」，
 * 仅保留 ★5 且已完成买卖配对的信号，汇总后生成 Excel 文件下载。
 */
export const exportBuySellReport = async <T>(options: BuyPointExportOptions<T>): Promise<void> => {
  await runReportExport(options, pickPairedFiveStarBuys, {
    fileName: `${options.filePrefix}_买入卖出报告_${moment().format('YYYYMMDD_HHmm')}.xlsx`,
    sheetName: '月季RSI6五星买卖',
    emptyMessage: '所选{label}未发现「月&季 RSI6 百分位策略」已配对的 ★5 买卖信号',
    successMessage: count => `「买入&卖出报告」已导出（共 ${count} 条 ★5 信号）`,
  });
};

/**
 * 导出「买入计划」：对勾选标的计算「月&季 RSI6 百分位策略」，
 * 仅保留最近一次 ★5 配对卖出之后、尚未卖出的 ★5 买入（同一只可有多条），
 * 汇总后生成 Excel 文件下载。
 */
export const exportBuyPlan = async <T>(options: BuyPointExportOptions<T>): Promise<void> => {
  await runReportExport(options, pickOpenFiveStarBuys, {
    fileName: `${options.filePrefix}_买入计划_${moment().format('YYYYMMDD_HHmm')}.xlsx`,
    sheetName: '月季RSI6五星买入计划',
    emptyMessage: '所选{label}暂无「月&季 RSI6 百分位策略」尚未卖出的 ★5 买入信号',
    successMessage: count => `「买入计划」已导出（共 ${count} 条 ★5 买入信号）`,
  });
};
