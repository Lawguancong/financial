import moment from 'moment';
import { message } from 'antd';
import { appConfig } from '@/config/appConfig';
import {
  aggregateKLineByPeriod,
  calculateAnnualizedReturn,
  calculateHoldingReturnRate,
  calculateMACD,
  filterMacdBarMarksByMinIndex,
  findMacdBarReboundMarks,
} from './stockUtils';
import type { KLineData } from './stockUtils';
import { computeHoldingDrawdown } from './buyPointCompute';
import type { BuyPointKLineItem } from './buyPointCompute';
import { runRecommendationBatchCalculation } from './recommendationBatch';
import { downloadXlsx } from './xlsxExport';
import type { XlsxCell, XlsxCellValue, XlsxColumn, XlsxRow } from './xlsxExport';
import {
  DETAIL_ROW_HEIGHT,
  HEADER_ROW_HEIGHT,
  HEADER_STYLE,
  SUMMARY_DEFS,
  SUMMARY_ROW_HEIGHT,
  ZEBRA_BACKGROUND,
  buildSummaryRow,
  detailCellStyle,
  summaryCellStyle,
} from './reportExportStyle';

/**
 * 「最低 MACD 柱月K标记（下一周期买入）」导出
 *
 * 与详情页 MacdFilterMark 的月K标记口径一致：
 * - 先由日K聚合为月K，再按 appConfig.chart.macd.macdParams 计算 MACD；
 * - 连续为负区间长度 ≥ peakWindows.monthly 时，取区间最低 MACD 柱（金色标记）；
 * - 图表标记：该柱下一周期 MACD 高于最低柱时确认，下一周期即青色标记（事后展示）；
 * - 每段连续负值区间最多一条标记，导出全部标的的全部标记。
 *
 * 指标口径：
 * - 最低柱仍按连续负值区间的最小值识别（事后标记）；
 * - **买入日期 = 最低柱下一周期（确认柱）日期，买入价 = 该周期收盘价/累计收益率**；
 *   同一负值区间后续出现更低柱时，最低柱与确认柱会整体后移（事后口径，不是实时信号）；
 * - 持有天数、持有至今收益率、年化收益率全部从买入日期起算；
 * - 被套最大回撤、回本日期、最大回本持有天数沿用 ★5 报告的「相对买入价」口径（computeHoldingDrawdown）；
 * - Calmar = 年化收益率 / 最大回撤率（被套口径）；
 * - 买入后最大浮盈率（MFE）= 买入日 → 最新交易日内的最高收益率；
 * - 价格口径剔除 0/负值异常；月K样本不足 minMonthlyBars 或最低柱处于预热期时不产生标记。
 */

const {
  fastPeriod: MACD_FAST_PERIOD,
  slowPeriod: MACD_SLOW_PERIOD,
  signalPeriod: MACD_SIGNAL_PERIOD,
} = appConfig.chart.macd.macdParams;
/** 月K连续负值区间最小长度（与详情页月K标记一致） */
const MACD_MONTHLY_WINDOW = appConfig.chart.macd.peakWindows.monthly;
/** 月K标记最小样本数（MACD 预热：慢线 26 + 信号线 9） */
const MACD_MIN_MONTHLY_BARS = appConfig.chart.macd.minMonthlyBars;
/** 年化口径分界（天）：持有满该天数按年化收益率展示，不足按区间收益率 */
const ANNUALIZE_MIN_HOLDING_DAYS = appConfig.rsi.annualizeMinHoldingDays;
const REPORT_CONCURRENCY = appConfig.batch.reportConcurrency;

/** 收盘值语义：价格（股票/指数/商品/期货）或累计收益率（基金） */
export type MacdCloseValueType = 'price' | 'cumulativeReturn';

/** 单条月K最低 MACD 柱标记 + 下一周期买入的持有/回撤指标 */
export interface MacdBarMarkerExportRow {
  /** 最低 MACD 柱日期（金色标记） */
  minDate: string;
  /** 最低 MACD 柱值 */
  minBar: number;
  /** 最低柱当日收盘价/累计收益率 */
  minClose: number;
  /** 最低柱出现前，连续负值柱的根数（区间起点 → 最低柱前一周期，不含最低柱） */
  barsBeforeMin: number;
  /** 整个连续负值区间的总柱数 */
  runLength: number;
  /** 买入日期：最低柱下一周期（确认柱）日期 */
  buyDate: string;
  /** 买入价：下一周期收盘价/累计收益率 */
  buyClose: number;
  /** 下一周期 MACD 柱值 */
  buyBar: number;
  /** 最新交易日日期 */
  latestDate: string;
  /** 最新交易日收盘价/累计收益率 */
  latestClose: number;
  /** 持有天数（买入日 → 最新交易日，至少 1 天） */
  holdingDays: number;
  /** 持有至今收益率（%，可正可负） */
  returnRateToNow: number;
  /** 持有至今年化收益率（%），无法计算时为 null */
  annualizedReturn: number | null;
  /** 买入后最大浮盈率（%）：仅当买入日 → 最新交易日的最高收益率 > 0 时提供；否则 undefined（导出为空） */
  maxFavorableReturn?: number;
  /** 被套最大回撤率（%，正值）：相对买入价的最大跌幅；全程未跌破买入价时无值 */
  maxDrawdown?: number;
  /** 被套最大回撤最低点日期 */
  maxDrawdownDate?: string;
  /** 被套最大回撤最低点收盘价/累计收益率 */
  maxDrawdownClose?: number;
  /** 买点到被套最大回撤最低点的天数（日历天） */
  daysToMaxDrawdown?: number;
  /** 回本日期：被套最大回撤最低点之后首个 ≥ 买入值的交易日 */
  recoveryDate?: string;
  /** 最大回本持有天数（日历天） */
  maxRecoveryHoldingDays?: number;
  /** 被套最大回撤修复天数：回撤最低点 → 回本日的日历天 */
  drawdownRepairDays?: number;
  /** Calmar 比率 = 年化收益率 / 最大回撤率 */
  calmarRatio?: number;
}

/** 日期统一格式化为 YYYY-MM-DD */
const formatDate = (date: string): string => moment(date).format('YYYY-MM-DD');

/** 仅含日期的收盘序列补全为 KLineData，供月度聚合复用（其余字段不参与 MACD 计算） */
const toKLineData = (items: BuyPointKLineItem[]): KLineData[] =>
  items.map(item => {
    const close = Number(item.收盘);
    return {
      日期: item.日期,
      收盘: close,
      开盘: close,
      最高: close,
      最低: close,
      成交量: 0,
      成交额: 0,
    };
  });

/** 买入后最大浮盈率：买入日 → 最新交易日内的最高收益率；≤ 0 时返回 null（不计算/展示空） */
const computeMaxFavorableReturn = (
  dailyData: BuyPointKLineItem[],
  buyDate: string,
  buyClose: number,
  closeValueType: MacdCloseValueType,
): number | null => {
  const buyDateNorm = formatDate(buyDate);
  const maxReturn = dailyData.reduce((max, item) => {
    if (formatDate(item.日期) < buyDateNorm) return max;
    const close = Number(item.收盘);
    if (!Number.isFinite(close)) return max;
    const returnRate = calculateHoldingReturnRate(buyClose, close, closeValueType);
    return returnRate > max ? returnRate : max;
  }, 0);
  return maxReturn > 0 ? maxReturn : null;
};

/**
 * 计算单个标的的月K最低 MACD 柱标记及持有/回撤指标（纯计算、无 IO）
 *
 * @param dailyData 日K「日期 + 收盘」序列；基金传入累计收益率序列（收盘列 = 累计收益率）
 * @param closeValueType price=价格；cumulativeReturn=累计收益率（回撤按净值口径折算）
 */
export const buildMacdBarMarkerRows = (
  dailyData: BuyPointKLineItem[],
  closeValueType: MacdCloseValueType = 'price',
): MacdBarMarkerExportRow[] => {
  const sorted = dailyData
    .filter(item => {
      if (!item.日期 || !moment(item.日期).isValid()) return false;
      const close = Number(item.收盘);
      if (!Number.isFinite(close)) return false;
      // 价格口径剔除 0 / 负值异常；累计收益率允许 0 与负值
      return closeValueType === 'cumulativeReturn' || close > 0;
    })
    .map(item => ({ 日期: item.日期, 收盘: Number(item.收盘) }))
    .sort((a, b) => moment(a.日期).valueOf() - moment(b.日期).valueOf());
  if (sorted.length === 0) return [];

  // 月K：每月最后一个交易日；与详情页 MacdFilterMark 的聚合口径一致
  const monthlyData = aggregateKLineByPeriod({ dailyData: toKLineData(sorted), period: 'monthly' });
  // 至少要有 1 根最低柱 + 1 根确认柱；另需满足 MACD 预热门槛，避免早期 EMA 未收敛的噪声信号
  const minMonthlyBars = Math.max(MACD_MONTHLY_WINDOW + 2, MACD_MIN_MONTHLY_BARS);
  if (monthlyData.length < minMonthlyBars) return [];

  const macdRows = calculateMACD({
    data: monthlyData,
    fastPeriod: MACD_FAST_PERIOD,
    slowPeriod: MACD_SLOW_PERIOD,
    signalPeriod: MACD_SIGNAL_PERIOD,
  }) as (KLineData & {
    __MACD_BAR__: number;
    __MACD_DIF__: number;
    __MACD_DEA__: number;
  })[];
  /** 月K最低柱必须出现在 MACD 预热门槛之后（第 minMonthlyBars 根起） */
  const minMarkerIndex = Math.max(0, MACD_MIN_MONTHLY_BARS - 1);
  const marks = filterMacdBarMarksByMinIndex(
    findMacdBarReboundMarks(macdRows, MACD_MONTHLY_WINDOW),
    minMarkerIndex,
  );

  const latest = sorted[sorted.length - 1];
  const latestDate = formatDate(latest.日期);
  const latestClose = Number(latest.收盘);

  return marks.flatMap(mark => {
    const minRow = monthlyData[mark.index];
    const minDate = formatDate(minRow.日期);

    // 最低柱前连续负值根数：从所在连续负值区间起点扫到最低柱前一周期（不含最低柱）
    let runStart = mark.index;
    while (runStart > 0 && macdRows[runStart - 1].__MACD_BAR__ < 0) {
      runStart -= 1;
    }
    const barsBeforeMin = mark.index - runStart;

    // 买入日期 = 最低柱下一周期（确认柱）
    const buyRow = monthlyData[mark.confirmIndex];
    const buyDate = formatDate(buyRow.日期);
    const buyClose = Number(buyRow.收盘);
    const buyBarValue = mark.confirmBar;
    const holdingDays = Math.max(1, moment(latestDate).diff(moment(buyDate), 'days'));
    const returnRateToNow = calculateHoldingReturnRate(buyClose, latestClose, closeValueType);
    const annualizedReturn =
      holdingDays < ANNUALIZE_MIN_HOLDING_DAYS
        ? returnRateToNow
        : calculateAnnualizedReturn(returnRateToNow, holdingDays);

    const maxFavorableReturn = computeMaxFavorableReturn(
      sorted,
      buyDate,
      buyClose,
      closeValueType,
    );

    const row: MacdBarMarkerExportRow = {
      minDate,
      minBar: Number(mark.minBar.toFixed(2)),
      minClose: Number(Number(minRow.收盘).toFixed(2)),
      barsBeforeMin,
      runLength: mark.runLength,
      buyDate,
      buyClose: Number(buyClose.toFixed(2)),
      buyBar: Number(buyBarValue.toFixed(2)),
      latestDate,
      latestClose: Number(latestClose.toFixed(2)),
      holdingDays,
      returnRateToNow: Number(returnRateToNow.toFixed(2)),
      annualizedReturn: annualizedReturn == null ? null : Number(annualizedReturn.toFixed(2)),
      maxFavorableReturn:
        maxFavorableReturn != null ? Number(maxFavorableReturn.toFixed(2)) : undefined,
    };

    const drawdown = computeHoldingDrawdown(
      sorted,
      buyDate,
      buyClose,
      undefined,
      closeValueType,
    );
    if (drawdown) {
      row.maxDrawdown = drawdown.maxDrawdown;
      row.maxDrawdownDate = drawdown.troughDate;
      row.maxDrawdownClose = drawdown.troughClose;
      row.daysToMaxDrawdown = Math.max(
        0,
        moment(drawdown.troughDate).diff(moment(buyDate), 'days'),
      );
      row.recoveryDate = drawdown.recoveryDate ?? undefined;
      row.maxRecoveryHoldingDays = drawdown.maxRecoveryHoldingDays ?? undefined;
      row.drawdownRepairDays = drawdown.recoveryDate
        ? Math.max(0, moment(drawdown.recoveryDate).diff(moment(drawdown.troughDate), 'days'))
        : undefined;
    }

    // Calmar = 年化收益率 / 最大回撤率（被套口径）
    if (row.maxDrawdown != null && row.maxDrawdown > 0) {
      // 年化缺失（持有不足分界天数）时退化为「区间收益率 / 最大回撤率」，与买入计划导出口径一致
      const calmarBase =
        annualizedReturn != null
          ? annualizedReturn
          : holdingDays < ANNUALIZE_MIN_HOLDING_DAYS
            ? returnRateToNow
            : null;
      if (calmarBase != null) {
        row.calmarRatio = Number((calmarBase / row.maxDrawdown).toFixed(2));
      }
    }

    return [row];
  });
};

/** 构建导出列（列顺序必须与 toExportCells 严格对齐） */
export const buildMacdBarMarkerColumns = (
  priceLineName: string,
  currentPriceTitle: string,
): XlsxColumn[] => [
  { title: '代码' },
  { title: '名称' },
  { title: '最低MACD柱日期' },
  { title: '最低MACD柱' },
  { title: `最低柱${priceLineName}` },
  { title: '最低柱前连续负值柱数' },
  { title: '负值区间总柱数' },
  { title: '买入日期' },
  { title: `买入${priceLineName}` },
  { title: '买入MACD' },
  { title: currentPriceTitle },
  { title: '持有天数' },
  { title: '持有至今收益率' },
  { title: '持有至今年化收益率' },
  { title: '买入后最大浮盈率' },
  { title: '被套最大回撤率' },
  { title: '被套最大回撤最低点日期' },
  { title: '被套最大回撤的收盘价' },
  { title: '买点到被套最大回撤的天数' },
  { title: '回本日期' },
  { title: '最大回本持有天数' },
  { title: '被套回撤修复天数' },
  { title: 'Calmar比率（年化收益 / 最大回撤）' },
];

export interface MacdBarMarkerReportItem extends MacdBarMarkerExportRow {
  code: string;
  name: string;
}

/** 单条记录 -> 导出单元格（数值列写数字，缺失列留 '-'） */
export const buildMacdBarMarkerCells = (row: MacdBarMarkerReportItem): XlsxCellValue[] => [
  row.code,
  row.name,
  row.minDate,
  row.minBar,
  row.minClose,
  row.barsBeforeMin,
  row.runLength,
  row.buyDate,
  row.buyClose,
  row.buyBar,
  row.latestClose,
  row.holdingDays,
  row.returnRateToNow,
  row.annualizedReturn != null ? row.annualizedReturn : '-',
  row.maxFavorableReturn != null ? row.maxFavorableReturn : '',
  row.maxDrawdown != null ? row.maxDrawdown : '-',
  row.maxDrawdownDate ?? '-',
  row.maxDrawdownClose != null ? row.maxDrawdownClose : '-',
  row.daysToMaxDrawdown != null ? row.daysToMaxDrawdown : '-',
  row.recoveryDate ?? '-',
  row.maxRecoveryHoldingDays != null ? row.maxRecoveryHoldingDays : '-',
  row.drawdownRepairDays != null ? row.drawdownRepairDays : '-',
  row.calmarRatio != null ? row.calmarRatio : '-',
];

/**
 * 「当前价格」表头：所有导出行的 latestDate 完全一致时才带日期；否则回退固定「当前价格」，
 * 避免某行价格与表头日期错配。
 */
export const resolveCurrentPriceTitle = (latestDates: string[]): string => {
  const uniqueDates = new Set(latestDates);
  const latest = latestDates.reduce((max, date) => (date > max ? date : max), '');
  return uniqueDates.size === 1 && latest ? `当前${latest}价格` : '当前价格';
};

/** 汇总行不参与统计的列：文本/日期/价格类列 */
export const buildMacdBarMarkerSummaryExcludedTitles = (
  priceLineName: string,
  currentPriceTitle: string,
): Set<string> => new Set([
  '代码',
  '名称',
  '最低MACD柱日期',
  '买入日期',
  '被套最大回撤最低点日期',
  '回本日期',
  `最低柱${priceLineName}`,
  `买入${priceLineName}`,
  currentPriceTitle,
  '被套最大回撤的收盘价',
]);

export interface MacdBarMarkerExportOptions<T> {
  /** 待导出的目标列表（调用方已按勾选过滤） */
  targets: T[];
  /** 导出「代码」列取值 */
  getCode: (item: T) => string;
  /** 导出「名称」列取值 */
  getName: (item: T) => string;
  /** 唯一标识（异常日志用） */
  getKey?: (item: T) => string;
  /** 取该标的日K「日期 + 收盘」序列（基金为累计收益率序列） */
  fetchDailyData: (item: T) => Promise<BuyPointKLineItem[]>;
  /** 收盘值语义，默认 price */
  closeValueType?: MacdCloseValueType;
  /** 未勾选任何标的时的提示文案 */
  emptyWarn: string;
  /** 标的名词，用于提示文案（如「股票」「指数」「基金」「品种」） */
  itemLabel: string;
  /** 导出文件名前缀（标的类型） */
  filePrefix: string;
  /** 并发取数数量，默认 appConfig.batch.reportConcurrency */
  concurrency?: number;
}

/**
 * 导出「最低 MACD 柱月K标记（下一周期买入）」：
 * 对勾选标的批量取数 -> 月度 MACD 标记 + 持有/回撤指标 -> 汇总 Excel 下载。
 */
export const exportMacdBarMarker = async <T>(
  options: MacdBarMarkerExportOptions<T>,
): Promise<void> => {
  const closeValueType = options.closeValueType ?? 'price';
  const priceLineName = closeValueType === 'cumulativeReturn' ? '累计收益率' : '收盘价';
  const reportItems: MacdBarMarkerReportItem[] = [];

  const batchResult = await runRecommendationBatchCalculation<T, MacdBarMarkerExportRow[]>({
    targets: options.targets,
    getKey: options.getKey,
    getName: options.getName,
    emptyWarn: options.emptyWarn,
    taskLabel: 'MACD 月K标记',
    concurrency: options.concurrency ?? REPORT_CONCURRENCY,
    fetchBuyPoints: async item =>
      buildMacdBarMarkerRows(await options.fetchDailyData(item), closeValueType),
    onItemDone: (item, rows) => {
      rows.forEach(row => {
        reportItems.push({
          code: options.getCode(item),
          name: options.getName(item),
          ...row,
        });
      });
    },
  });

  if (reportItems.length === 0) {
    // 存在接口异常时已由批量编排弹出失败汇总 Modal，不再追加「无标记」提示
    if (batchResult.failures.length === 0) {
      message.info(`所选${options.itemLabel}未发现「月K MACD 最低柱下一周期」标记`);
    }
    return;
  }

  // 最近买入的标记在前，同日按代码升序
  reportItems.sort((a, b) => {
    const dateCompare = b.buyDate.localeCompare(a.buyDate);
    return dateCompare !== 0 ? dateCompare : a.code.localeCompare(b.code);
  });

  // 「当前价格」表头：所有行最新交易日一致时才带日期；混合时回退「当前价格」
  const currentPriceTitle = resolveCurrentPriceTitle(reportItems.map(item => item.latestDate));
  const columns = buildMacdBarMarkerColumns(priceLineName, currentPriceTitle);

  const excludedTitles = buildMacdBarMarkerSummaryExcludedTitles(
    priceLineName,
    currentPriceTitle,
  );

  const detailValues = reportItems.map(buildMacdBarMarkerCells);
  const rows: XlsxRow[] = detailValues.map((values, rowIndex) => ({
    cells: values.map((value, colIndex): XlsxCell => ({
      value,
      style: detailCellStyle(columns[colIndex].title, value),
    })),
    style: rowIndex % 2 === 1 ? { backgroundColor: ZEBRA_BACKGROUND } : undefined,
    height: DETAIL_ROW_HEIGHT,
  }));

  SUMMARY_DEFS.forEach(({ label, aggregate }, summaryIndex) => {
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

  downloadXlsx(
    `${options.filePrefix}_最低MACD柱月K标记_${moment().format('YYYYMMDD_HHmm')}.xlsx`,
    '月K最低MACD柱标记',
    columns,
    rows,
    {
      headerStyle: HEADER_STYLE,
      headerHeight: HEADER_ROW_HEIGHT,
      rowHeight: DETAIL_ROW_HEIGHT,
      freezeHeader: true,
      autoFilterRowCount: detailValues.length,
    },
  );
  message.success(`「最低 MACD 柱月K标记（下一周期买入）」已导出（共 ${reportItems.length} 条）`);
};
