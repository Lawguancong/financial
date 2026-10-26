import moment from 'moment';
import { message } from 'antd';
import { runRecommendationBatchCalculation } from './recommendationBatch';
import { downloadXlsx } from './xlsxExport';
import type { XlsxCell, XlsxCellStyle, XlsxCellValue, XlsxColumn, XlsxRow } from './xlsxExport';
import { calculateAnnualizedReturn, getSellTrancheColumnTitle, getSellTrancheCount } from './stockUtils';
import type { MonthlyQuarterlyPercentileBuyPoint } from './stockUtils';
import { appConfig } from '@/config/appConfig';

/**
 * 「买入&卖出报告」/「买入计划」导出公共逻辑
 *
 * 各页面（个股 / 指数 / 大宗商品 / 外盘期货 / 基金）仅需提供「取数 + 计算月&季 RSI6 明细」
 * 的方法，其余筛选、排序、单元格映射、平均值汇总行、文件下载与提示统一在此实现，
 * 保证各页面导出功能与格式完全一致。
 */

/** 分批卖出收益率列（批次 = 1 时为空，即一次性卖出不生成分批列） */
const SELL_TRANCHE_COLUMNS: XlsxColumn[] =
  getSellTrancheCount() > 1
    ? Array.from({ length: getSellTrancheCount() }, (_, index) => ({
        title: getSellTrancheColumnTitle(index + 1),
      }))
    : [];

/** 分批卖出列标题集合（「买入计划」导出时剔除） */
const SELL_TRANCHE_TITLES = new Set(SELL_TRANCHE_COLUMNS.map(column => column.title));

/** 导出列（不含「当前价格」列）：参考 RsiFilterMark「月&季 RSI6 百分位策略」表格列 */
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
  { title: '平均收益率' },
  ...SELL_TRANCHE_COLUMNS,
  { title: '年化收益率' },
  { title: '最大回撤率' },
  { title: '最大回撤最低点日期' },
  { title: '最大回撤的收盘价' },
  { title: '买点到最大回撤率的被套天数' },
  { title: '回本日期' },
  { title: '最大回本持有天数' },
  { title: 'Calmar比率（年化收益 / 最大回撤）' },
];

/** 「当前价格」列插入位置：卖出季RSI6 之后 */
const CURRENT_PRICE_INSERT_INDEX =
  BUY_SELL_REPORT_COLUMNS.findIndex(column => column.title === '卖出季RSI6') + 1;

/** 在基础列中插入「当前价格」列（表头带最新交易日，如「当前2026-10-16价格」） */
const insertCurrentPriceColumn = (base: XlsxColumn[], title: string): XlsxColumn[] => [
  ...base.slice(0, CURRENT_PRICE_INSERT_INDEX),
  { title },
  ...base.slice(CURRENT_PRICE_INSERT_INDEX),
];

/** 「买入&卖出报告」列：基础列 + 「当前价格」列 */
export const buildReportColumns = (currentPriceTitle: string): XlsxColumn[] =>
  insertCurrentPriceColumn(BUY_SELL_REPORT_COLUMNS, currentPriceTitle);

/**
 * 「买入计划」列：与「买入&卖出报告」一致，但剔除分批卖出列（无卖出），并作两处改名 ——
 * 「平均收益率」→「持有至今收益率」、「年化收益率」→「持有至今年化收益率」：
 * 买入计划导出的是尚未卖出的持仓，口径为「最新交易日 vs 买入价」（可正可负），非已实现收益。
 */
export const buildBuyPlanColumns = (currentPriceTitle: string): XlsxColumn[] =>
  insertCurrentPriceColumn(
    BUY_SELL_REPORT_COLUMNS.filter(column => !SELL_TRANCHE_TITLES.has(column.title)).map(column => {
      if (column.title === '平均收益率') return { ...column, title: '持有至今收益率' };
      if (column.title === '年化收益率') return { ...column, title: '持有至今年化收益率' };
      return column;
    }),
    currentPriceTitle,
  );

/** 报告行：所属标的 + 单条 ★5 月&季 RSI6 共振买卖点 */
export interface BuySellReportItem {
  code: string;
  name: string;
  point: MonthlyQuarterlyPercentileBuyPoint;
}

/**
 * 批量导出并发数（配置见 appConfig.batch.reportConcurrency）：单只耗时主要在 HTTP 取数（数千根日线），
 * 提高在途取数以缩短导出等待；RSI 计算仍由 appConfig.worker.maxWorkers 个 Worker 排队处理，不额外占 CPU
 */
export const REPORT_BATCH_CONCURRENCY = appConfig.batch.reportConcurrency;

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

/** 单元格口径：paired=已配对卖出（卖出 vs 买入）；open=买入计划（最新交易日 vs 买入，持有至今） */
type ReportCellMode = 'paired' | 'open';

/** 单条 ★5 买卖点 -> 导出单元格行（数值列写数字，缺失列留空） */
const toReportCells = (
  { code, name, point }: BuySellReportItem,
  mode: ReportCellMode,
): XlsxCellValue[] => {
  // 持仓/收益列按导出类型取不同口径：买入计划为「持有至今」，其余为「卖出 vs 买入」已实现值
  const holdingDays = mode === 'open' ? point.holdingDaysToNow : point.holdingDays;
  const returnRate = mode === 'open' ? point.returnRateToNow : point.returnRate;

  // 年化收益率：
  // - 买入计划：持有不足年化分界（appConfig.rsi.annualizeMinHoldingDays，当前 1 天）取区间收益率，否则复利年化（可正可负）
  // - 买入&卖出报告：已实现年化；无年化时直接展示与「平均收益率」相同的数值
  const annualizedReturn: XlsxCellValue =
    mode === 'open'
      ? holdingDays == null || returnRate == null
        ? '-'
        : holdingDays < appConfig.rsi.annualizeMinHoldingDays
          ? Number(returnRate.toFixed(2))
          : (calculateAnnualizedReturn(returnRate, holdingDays) ?? '-')
      : point.annualizedReturn != null
        ? Number(point.annualizedReturn.toFixed(2))
        : point.returnRate != null
          ? Number(point.returnRate.toFixed(2))
          : '-';

  return [
    code,
    name,
    '★'.repeat(point.level),
    formatReportDate(point.日期),
    Number(point.收盘.toFixed(2)),
    Number(point.monthlyRsi.toFixed(2)),
    Number(point.quarterlyRsi.toFixed(2)),
    // 与 BUY_SELL_REPORT_COLUMNS 表头严格对齐：卖出日期 -> 卖出收盘价 -> 卖出月RSI6 -> 卖出季RSI6
    formatReportDate(point.sellDate),
    point.sellPrice != null ? point.sellPrice : '',
    point.sellMonthlyRsi != null ? Number(point.sellMonthlyRsi.toFixed(2)) : '',
    point.sellQuarterlyRsi != null ? Number(point.sellQuarterlyRsi.toFixed(2)) : '',
    // ↓ 当前价格（最新交易日收盘值）：插入位置与「卖出季RSI6」之后对齐
    point.latestClose != null ? point.latestClose : '',
    holdingDays != null ? holdingDays : '',
    returnRate != null ? Number(returnRate.toFixed(2)) : '',
    // ↓ 分批卖出各批收益率（列数由常量决定，且仅「买入&卖出报告」有）：
    //   未执行批次（后续行情未到）导出 '-'
    ...(mode === 'paired'
      ? SELL_TRANCHE_COLUMNS.map((_, index) => {
          const tranche = point.sellTranches?.[index];
          return tranche?.executed && tranche.returnRate != null
            ? Number(tranche.returnRate.toFixed(2))
            : '-';
        })
      : []),
    annualizedReturn,
    point.maxDrawdown != null ? point.maxDrawdown : '-',
    point.maxDrawdownDate ?? '-',
    point.maxDrawdownClose != null ? point.maxDrawdownClose : '-',
    point.daysToMaxDrawdown != null ? point.daysToMaxDrawdown : '-',
    point.recoveryDate ?? '-',
    point.maxRecoveryHoldingDays != null ? point.maxRecoveryHoldingDays : '-',
    point.calmarRatio != null
      ? point.calmarRatio
      : // 持有天数不足年化分界（当前配置 1 天，该分支实际不会命中）时无年化收益率，
        // Calmar 用「平均收益率 / 最大回撤率」计算；无回撤（回撤率为 0）或缺失时无法计算，展示 -
        point.holdingDays != null &&
          point.holdingDays < appConfig.rsi.annualizeMinHoldingDays &&
          point.returnRate != null &&
          point.maxDrawdown != null &&
          point.maxDrawdown > 0
        ? Number((point.returnRate / point.maxDrawdown).toFixed(2))
        : '-',
  ];
};

/** 汇总行（平均值 / 中位数）不参与统计的列：文本/日期列，以及买入、卖出收盘价与最大回撤的收盘价（价格类列不取汇总） */
const REPORT_SUMMARY_EXCLUDED_TITLES = new Set([
  '代码',
  '名称',
  '推荐级别',
  '买入日期',
  '卖出日期',
  '最大回撤最低点日期',
  '回本日期',
  '买入收盘价',
  '卖出收盘价',
  '最大回撤的收盘价',
]);

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

/**
 * 生成表格底部的汇总行：
 * 数值列按 aggregate 统计（平均值 / 中位数 / 方差 / 标准差，保留两位小数），文本/日期列与价格类列留空；
 * 缺失值（'-'、空串）不参与统计；无法计算（如样本量不足）时留空
 */
const buildSummaryRow = (
  rows: XlsxCellValue[][],
  label: string,
  aggregate: (values: number[]) => number | null,
  columns: XlsxColumn[],
  /** 额外的排除列标题（如动态表头的「当前…价格」列） */
  extraExcludedTitles?: Set<string>,
): XlsxCellValue[] =>
  columns.map((column, index) => {
    if (index === 0) return label;
    if (REPORT_SUMMARY_EXCLUDED_TITLES.has(column.title)) return '';
    if (extraExcludedTitles?.has(column.title)) return '';
    const numbers = rows
      .map(row => row[index])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numbers.length === 0) return '';
    const aggregated = aggregate(numbers);
    return aggregated == null || !Number.isFinite(aggregated) ? '' : Number(aggregated.toFixed(2));
  });

// ---------------- 导出表格样式（只影响展示，不影响任何统计口径） ----------------

/** 深蓝表头（白字加粗居中、自动换行） */
const HEADER_STYLE: XlsxCellStyle = {
  bold: true,
  color: 'FFFFFF',
  backgroundColor: '1F4E79',
  align: 'center',
  wrapText: true,
  border: 'thin',
  borderColor: '163A5C',
};

const HEADER_ROW_HEIGHT = 45;
const DETAIL_ROW_HEIGHT = 20;
const SUMMARY_ROW_HEIGHT = 22;
/** 明细区隔行底色与细边框 */
const ZEBRA_BACKGROUND = 'F7F9FC';
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
type ReportColumnKind =
  | 'code'
  | 'name'
  | 'level'
  | 'date'
  | 'price'
  | 'rsi'
  | 'days'
  | 'returnRate'
  | 'drawdown'
  | 'ratio'
  | 'text';

/**
 * 按列标题识别列类型（标题由 buildReportColumns / buildBuyPlanColumns 生成，两种口径共用）：
 * 先判「天数」，避免「买点到最大回撤率的被套天数」被误判为回撤率列。
 */
const classifyColumn = (title: string): ReportColumnKind => {
  if (title === '代码') return 'code';
  if (title === '名称') return 'name';
  if (title === '推荐级别') return 'level';
  if (/天数/.test(title)) return 'days';
  if (/日期/.test(title)) return 'date';
  if (/收盘价|价格/.test(title)) return 'price';
  if (/RSI6/.test(title)) return 'rsi';
  if (/收益率/.test(title)) return 'returnRate';
  if (/最大回撤率/.test(title)) return 'drawdown';
  if (/Calmar/.test(title)) return 'ratio';
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
  if (kind === 'days') return '0';
  if (kind === 'rsi' || kind === 'ratio') return '0.00';
  return undefined;
};

/** 明细单元格样式：统一细边框 + 隔行底色（行级）+ 收益率红正绿负 + 推荐级别金色 */
const detailCellStyle = (title: string, value: XlsxCellValue): XlsxCellStyle => {
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
const summaryCellStyle = (
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
  mode: ReportCellMode,
  output: { fileName: string; sheetName: string; emptyMessage: string; successMessage: (count: number) => string },
): Promise<void> => {
  const { targets, getCode, getName, getKey, fetchPoints, emptyWarn, itemLabel } = options;

  const reportItems: BuySellReportItem[] = [];
  const batchResult = await runRecommendationBatchCalculation<
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
    // 存在接口异常时已由批量编排弹出失败汇总 Modal，不再追加「无信号」提示，避免误导
    if (batchResult.failures.length === 0) {
      message.info(output.emptyMessage.replace('{label}', itemLabel));
    }
    return;
  }

  sortReportItems(reportItems);

  // 「当前价格」列表头带最新交易日（取所有行的最晚交易日），便于确认价格对应的是哪一天
  const latestTradingDate = reportItems.reduce(
    (latest, item) => (item.point.latestDate && item.point.latestDate > latest ? item.point.latestDate : latest),
    '',
  );
  const currentPriceTitle = latestTradingDate ? `当前${latestTradingDate}价格` : '当前价格';

  // 明细行 + 底部汇总行（平均值、中位数、样本/总体方差与标准差，均只基于明细行统计）
  const columns =
    mode === 'open' ? buildBuyPlanColumns(currentPriceTitle) : buildReportColumns(currentPriceTitle);
  const excludedTitles = new Set([currentPriceTitle]);
  // 统计口径保持不变：先算纯值行，再套样式
  const detailValues = reportItems.map(item => toReportCells(item, mode));
  const rows: XlsxRow[] = detailValues.map((values, rowIndex) => ({
    cells: values.map((value, colIndex): XlsxCell => ({
      value,
      style: detailCellStyle(columns[colIndex].title, value),
    })),
    // 隔行浅灰底：行级样式与单元格样式合并，不影响收益率红绿字体
    style: rowIndex % 2 === 1 ? { backgroundColor: ZEBRA_BACKGROUND } : undefined,
    height: DETAIL_ROW_HEIGHT,
  }));

  const summaryDefs: {
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

  summaryDefs.forEach(({ label, aggregate }, summaryIndex) => {
    const values = buildSummaryRow(detailValues, label, aggregate, columns, excludedTitles);
    rows.push({
      cells: values.map((value, colIndex): XlsxCell => ({
        value,
        style: summaryCellStyle(
          columns[colIndex].title,
          label,
          value,
          summaryIndex === 0,
          colIndex === 0,
        ),
      })),
      height: SUMMARY_ROW_HEIGHT,
    });
  });

  downloadXlsx(output.fileName, output.sheetName, columns, rows, {
    headerStyle: HEADER_STYLE,
    headerHeight: HEADER_ROW_HEIGHT,
    rowHeight: DETAIL_ROW_HEIGHT,
    freezeHeader: true,
    // 自动筛选只覆盖表头 + 明细，底部统计行不参与筛选
    autoFilterRowCount: detailValues.length,
  });
  message.success(output.successMessage(reportItems.length));
};

/**
 * 导出「买入&卖出报告」：对勾选标的计算「月&季 RSI6 百分位策略」，
 * 仅保留 ★5 且已完成买卖配对的信号，汇总后生成 Excel 文件下载。
 */
export const exportBuySellReport = async <T>(options: BuyPointExportOptions<T>): Promise<void> => {
  await runReportExport(options, pickPairedFiveStarBuys, 'paired', {
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
  await runReportExport(options, pickOpenFiveStarBuys, 'open', {
    fileName: `${options.filePrefix}_买入计划_${moment().format('YYYYMMDD_HHmm')}.xlsx`,
    sheetName: '月季RSI6五星买入计划',
    emptyMessage: '所选{label}暂无「月&季 RSI6 百分位策略」尚未卖出的 ★5 买入信号',
    successMessage: count => `「买入计划」已导出（共 ${count} 条 ★5 买入信号）`,
  });
};
