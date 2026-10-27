import React, { memo, useEffect, useMemo, useState, useTransition } from 'react';
import { Button, DatePicker, Empty, Space, Spin, Table, Tag } from 'antd';
import { CalendarOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/plots';
import moment from 'moment';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  aggregateKLineByPeriod,
  calculateMACD,
  findConfirmedPeaks,
  mapConfirmedPeakRows,
} from '@/utils/stockUtils';
import type { KLineData } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';

type MacdType = 'stock' | 'index' | 'fund' | 'commodity';

interface MacdFilterMarkProps {
  /** 日 K 数据（只需 日期 + 收盘；基金场景下 收盘 为累计收益率） */
  data: KLineData[];
  /**
   * 标的类型：股票 / 指数 / 基金 / 大宗商品。
   * MACD 计算口径一致，仅影响价格/收益率文案（基金为「累计收益率」）。
   */
  type?: MacdType;
  /**
   * 可见周期，默认展示全部四周期（日/周/月/季）。
   * 基金等场景仅有月/季数据时，可传 ['monthly', 'quarterly']。
   */
  visiblePeriods?: MacdPeriodKey[];
}

type MacdPeriodKey = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface MacdPeriodMeta {
  key: MacdPeriodKey;
  /** 周期中文名，如「日K」 */
  label: string;
  /** 周期主题色（概览圆点） */
  color: string;
}

interface MacdRow extends KLineData {
  __MACD_DIF__: number;
  __MACD_DEA__: number;
  __MACD_BAR__: number;
  /** DEA − DIF（= −MACD柱 / 2） */
  __MACD_DEA_MINUS_DIF__: number;
  /** DEA ÷ DIF；DIF = 0 时为 null */
  __MACD_DEA_DIV_DIF__: number | null;
}

interface MacdPeriodResult {
  meta: MacdPeriodMeta;
  /** 当前（最后一根）DIF / DEA / MACD 柱 */
  latest: { dif: number; dea: number; bar: number; date: string } | null;
  /** 是否存在有效比值（DIF ≠ 0），无有效比值时不展示比值图例 */
  hasRatio: boolean;
  /** 峰值检测窗口；null 表示该周期不标记峰值（日K） */
  peakWindow: number | null;
  /** 峰值确认滞后（根）；null 表示该周期不标记峰值（日K） */
  peakConfirmLag: number | null;
  /** 红色峰值圆点对应的买点记录 */
  peakRows: MacdPeakRow[];
  /** 图表配置 */
  chartConfig: Record<string, unknown>;
}

/** DEA÷DIF 峰值买点行（峰值列取峰值日数据；买入列取峰值后第 N 根确认日数据） */
interface MacdPeakRow {
  /** 峰值日期（图中红点位置） */
  peakDate: string;
  /** 峰值收盘价（基金为累计收益率） */
  peakClose: number;
  /** 峰值 DEA÷DIF */
  peakRatio: number;
  /** 峰值日 MACD 柱值 */
  macd: number;
  /** 峰值日 DEA */
  dea: number;
  /** 峰值日 DIFF */
  dif: number;
  /** 买入/确认日期（峰值后第 N 根） */
  buyDate: string;
  /** 买入收盘价（基金为累计收益率；确认日数据） */
  buyClose: number;
}

/** 可点击图例对应的数据系列键（MACD 柱的正/负两个图例共用 bar） */
type MacdLegendKey = 'bar' | 'dif' | 'dea' | 'deaMinusDif' | 'ratio';

/** 图例项定义 */
interface MacdLegendItem {
  key: MacdLegendKey;
  label: string;
  color: string;
  symbol: string;
}

/** MACD 默认参数：快线 12、慢线 26、信号线 9 */
const MACD_PARAMS = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } as const;
/** 图表标题统一展示的参数口径 */
const MACD_TITLE = 'MACD(12,26,9)';

/** 图表配色：DIF / DEA / DEA−DIF / DEA÷DIF 折线，以及 MACD 柱正负色（A 股习惯：红涨绿跌） */
const DIF_COLOR = '#fa8c16';
const DEA_COLOR = '#1890ff';
const DEA_MINUS_DIF_COLOR = '#722ed1';
const DEA_DIV_DIF_COLOR = '#eb2f96';
const MACD_BAR_UP_COLOR = '#cf1322';
const MACD_BAR_DOWN_COLOR = '#3f8600';

/** 图例排列：颜色块 + 线型符号 + 名称；每个周期图独立过滤 */
const MACD_LEGEND_ITEMS: MacdLegendItem[] = [
  { key: 'bar', label: 'MACD柱为正', color: MACD_BAR_UP_COLOR, symbol: '■' },
  { key: 'bar', label: 'MACD柱为负', color: MACD_BAR_DOWN_COLOR, symbol: '■' },
  { key: 'dif', label: 'DIFF', color: DIF_COLOR, symbol: '━' },
  { key: 'dea', label: 'DEA', color: DEA_COLOR, symbol: '━' },
  { key: 'deaMinusDif', label: 'DEA-DIF', color: DEA_MINUS_DIF_COLOR, symbol: '━' },
  { key: 'ratio', label: 'DEA÷DIF（右轴）', color: DEA_DIV_DIF_COLOR, symbol: '━' },
];

const MACD_PERIODS: MacdPeriodMeta[] = [
  { key: 'daily', label: '日K', color: '#80a02f' },
  { key: 'weekly', label: '周K', color: '#52c41a' },
  { key: 'monthly', label: '月K', color: '#1890ff' },
  { key: 'quarterly', label: '季K', color: '#7014fa' },
];

/**
 * DEA÷DIF 峰值检测参数统一取自 appConfig.chart.macd：
 * - peakWindows：回看窗口（周52 / 月12 / 季4，约 1 年）
 * - peakConfirmLags：峰值确认滞后（默认 1，即峰值后的第 1 根确认买点）
 * 日K数据点过密，不标记峰值。
 */
const {
  peakWindows: RATIO_PEAK_WINDOWS,
  peakConfirmLags: RATIO_PEAK_CONFIRM_LAGS,
} = appConfig.chart.macd;

/** 峰值标记配色 */
const RATIO_PEAK_COLOR = '#ff4d4f';

/** 峰值判定允许的最高比值 = 右轴上限 × 该倍数（过滤 DIF≈0 的极端值，保留略超 98% 分位的有效峰值） */
const RATIO_PEAK_CAP_MULTIPLIER = 2;

/** 构建红色峰值买点表格列（买入价格列标题随标的类型切换） */
const buildPeakTableColumns = (priceLabel: string) => [
  {
    title: '峰值日期',
    dataIndex: 'peakDate',
    key: 'peakDate',
    width: 110,
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: `峰值${priceLabel}`,
    dataIndex: 'peakClose',
    key: 'peakClose',
    align: 'right' as const,
    width: 120,
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: `买入${priceLabel}（N根后）`,
    dataIndex: 'buyClose',
    key: 'buyClose',
    align: 'right' as const,
    width: 170,
    render: (value: number, row: MacdPeakRow) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          lineHeight: 1.4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ fontWeight: 600 }}>{value?.toFixed(2)}</span>
        <span style={{ fontSize: 10, color: '#8c8c8c' }}>
          {moment(row.buyDate).format('YYYY-MM-DD')}
        </span>
      </div>
    ),
  },
  {
    title: 'DEA÷DIF',
    dataIndex: 'peakRatio',
    key: 'peakRatio',
    align: 'right' as const,
    width: 110,
    render: (value: number) => (
      <span style={{ color: RATIO_PEAK_COLOR, fontWeight: 600 }}>{value.toFixed(2)}</span>
    ),
  },
  {
    title: 'MACD',
    dataIndex: 'macd',
    key: 'macd',
    align: 'right' as const,
    width: 100,
    render: (value: number) => (
      <span
        style={{
          color: value >= 0 ? MACD_BAR_UP_COLOR : MACD_BAR_DOWN_COLOR,
          fontWeight: 500,
        }}
      >
        {value.toFixed(2)}
      </span>
    ),
  },
  {
    title: 'DEA',
    dataIndex: 'dea',
    key: 'dea',
    align: 'right' as const,
    width: 100,
    render: (value: number) => (
      <span style={{ color: DEA_COLOR, fontWeight: 500 }}>{value.toFixed(2)}</span>
    ),
  },
  {
    title: 'DIFF',
    dataIndex: 'dif',
    key: 'dif',
    align: 'right' as const,
    width: 100,
    render: (value: number) => (
      <span style={{ color: DIF_COLOR, fontWeight: 500 }}>{value.toFixed(2)}</span>
    ),
  },
];

/** 样式常量：与 RsiFilterMark 的图表容器保持一致，保证同一详情页视觉统一 */
const chartContainerStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
  border: '1px solid #e8e8e8',
  borderRadius: 8,
  padding: '12px 16px',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
};
const chartLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
  color: '#262626',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
const sectionAccentStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 4,
  height: 16,
  borderRadius: 2,
  background: color,
});
const sectionSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8c8c8c',
  fontWeight: 400,
  marginLeft: 4,
};

/** 可折叠 Card（默认展开），折叠状态组件内部自管，避免父组件重渲染 */
const CollapsibleCard: React.FC<{
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: '#fafafa',
          borderBottom: open ? '1px solid #f0f0f0' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <RightOutlined
          style={{
            fontSize: 12,
            color: '#8c8c8c',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
        {title}
      </div>
      {open ? <div style={{ padding: '12px 14px' }}>{children}</div> : null}
    </div>
  );
};

/** 数值格式化：保留两位小数，空值显示 -- */
const formatValue = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '--';

/**
 * 构建单个周期的 MACD 图表配置。
 *
 * 使用 DualAxes 叠加三个同 X 视图：
 * - 主视图：DIF / DEA / DEA-DIF 三条折线，并优先负责 shared tooltip；
 * - 柱状视图：MACD 柱（以 0 为基准，正红负绿）；
 * - 比值视图：DEA/DIF 折线（实线），使用右侧独立 y 轴；DIF=0 时无定义，显示为断点。
 *
 * `hidden` 为当前周期被图例过滤掉的数据系列：对应折线/柱/比值不再绘制，
 * tooltip 优先挂在仍可见的主视图上（主视图全隐藏时依次回退到柱、比值）。
 *
 * 主视图与柱状视图使用相同的 y domain（包含 0），因此折线和柱状图的 0 轴严格对齐；
 * 比值视图不显示网格，避免与左轴网格重叠。
 */
const buildMacdChartConfig = (
  rows: MacdRow[],
  periodLabel: string,
  hidden: Set<MacdLegendKey>,
  peakWindow: number | null,
  peakConfirmLag: number,
) => {
  const chartData = rows.map((row) => ({
    date: moment(row.日期).format('YYYY-MM-DD'),
    dif: row.__MACD_DIF__,
    dea: row.__MACD_DEA__,
    bar: row.__MACD_BAR__,
    deaMinusDif: row.__MACD_DEA_MINUS_DIF__,
    deaDivDif: row.__MACD_DEA_DIV_DIF__,
  }));

  // tooltip 按日期查表：hover 到任意一条折线时都能同时展示柱/DIFF/DEA/DEA-DIF/DEA÷DIF
  const barByDate = new Map(chartData.map((row) => [row.date, row.bar]));
  const difByDate = new Map(chartData.map((row) => [row.date, row.dif]));
  const deaByDate = new Map(chartData.map((row) => [row.date, row.dea]));
  const deaMinusDifByDate = new Map(chartData.map((row) => [row.date, row.deaMinusDif]));
  const deaDivDifByDate = new Map(chartData.map((row) => [row.date, row.deaDivDif]));

  // 折线数据转为长表：series=DIFF/DEA/DEA-DIF，value=对应数值；被图例过滤的系列不参与绘制
  const lineData = chartData.flatMap((row) => {
    const series: { date: string; series: string; value: number }[] = [];
    if (!hidden.has('dif')) series.push({ date: row.date, series: 'DIFF', value: row.dif });
    if (!hidden.has('dea')) series.push({ date: row.date, series: 'DEA', value: row.dea });
    if (!hidden.has('deaMinusDif')) {
      series.push({ date: row.date, series: 'DEA-DIF', value: row.deaMinusDif });
    }
    return series;
  });
  const lineVisible = lineData.length > 0;
  const barVisible = !hidden.has('bar');

  // 柱和折线共用同一 y domain（必须包含 0，柱才有正确的基准线）
  let yMin = 0;
  let yMax = 0;
  chartData.forEach((row) => {
    yMin = Math.min(yMin, row.bar, row.dif, row.dea, row.deaMinusDif);
    yMax = Math.max(yMax, row.bar, row.dif, row.dea, row.deaMinusDif);
  });
  // 单点或全 0 时补一个可用区间，避免零高度 domain
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yDomain = [yMin, yMax];

  // 比值使用右侧独立 y 轴：忽略 DIF=0 的 null 点。
  // DIF 接近 0 时比值会急剧放大，若用全量 min/max 会把正常区间压成一条直线，
  // 因此右轴取 2%~98% 分位作为显示范围（tooltip 仍展示真实值），并开启 clip 裁剪越界尖峰。
  const ratios = chartData
    .map((row) => row.deaDivDif)
    .filter((value): value is number => value != null && Number.isFinite(value));
  let ratioMin = 0;
  let ratioMax = 0;
  if (ratios.length > 0) {
    const sortedRatios = [...ratios].sort((a, b) => a - b);
    const low = sortedRatios[Math.floor((sortedRatios.length - 1) * 0.02)];
    const high = sortedRatios[Math.ceil((sortedRatios.length - 1) * 0.98)];
    ratioMin = Math.min(0, low);
    ratioMax = Math.max(0, high);
    const padding = (ratioMax - ratioMin) * 0.05 || 1;
    ratioMin -= padding;
    ratioMax += padding;
  }
  const ratioDomain = [ratioMin, ratioMax];

  // 超出右轴显示范围的比值钳制到上下边界（不置空），保证 DEA÷DIF 线在极端时段也连续可见；
  // tooltip 仍展示真实比值。
  const ratioPlotData = chartData.map((row) => ({
    date: row.date,
    ratioPlot:
      row.deaDivDif == null
        ? null
        : Math.min(ratioMax, Math.max(ratioMin, row.deaDivDif)),
  }));

  const ratioVisible = ratios.length > 0 && !hidden.has('ratio');

  // 峰值检测只用“可参与买点判定”的比值：
  // - 低于右轴下限或高于上限×2 的极端值（DIF≈0 时可达成百上千）不参与，避免压制正常峰值；
  // - 略超 98% 分位的有效峰值（如季K 2024-06 的 1.91）仍可参与。
  const peakCap = Math.max(ratioMax, ratioMax * RATIO_PEAK_CAP_MULTIPLIER);
  const trueRatios = chartData.map((row) => row.deaDivDif);
  const peakSource = trueRatios.map((ratio) =>
    ratio != null && ratio >= ratioMin && ratio <= peakCap ? ratio : null,
  );
  const confirmedPeaks =
    peakWindow != null
      ? findConfirmedPeaks(peakSource, peakWindow, peakConfirmLag, {
        requirePositive: true,
        // 确认回落用真实比值：显示裁剪产生的 null 不应阻止有效峰值确认
        confirmValues: trueRatios,
      })
      : [];
  const peakData = confirmedPeaks.map(({ peakIndex }) => {
    const trueRatio = peakSource[peakIndex] as number;
    const clampedRatio = Math.min(ratioMax, Math.max(ratioMin, trueRatio));
    return {
      date: chartData[peakIndex].date,
      ratioPeak: clampedRatio,
      label: trueRatio.toFixed(2),
      atTop: clampedRatio >= ratioMax - 1e-9,
    };
  });
  const peakRows: MacdPeakRow[] = mapConfirmedPeakRows(rows, confirmedPeaks).map(
    ({ peakIndex, confirmIndex, peakRow, confirmRow }) => ({
      // 峰值列：图中红点位置的真实数据
      peakDate: chartData[peakIndex].date,
      peakClose: peakRow.收盘,
      peakRatio: peakSource[peakIndex] as number,
      macd: chartData[peakIndex].bar,
      dea: chartData[peakIndex].dea,
      dif: chartData[peakIndex].dif,
      // 买入列：峰值后第 N 根确认日的数据（as-of）
      buyDate: chartData[confirmIndex].date,
      buyClose: confirmRow.收盘,
    }),
  );

  // shared tooltip：优先主折线，其次柱，最后比值；确保任意过滤组合下仍可查看数值
  const tooltipHost: 'line' | 'bar' | 'ratio' | null = lineVisible
    ? 'line'
    : barVisible
      ? 'bar'
      : ratioVisible
        ? 'ratio'
        : null;
  const tooltipConfig = {
    title: (datum: { date: string }) => moment(datum.date).format('YYYY-MM-DD'),
    items: [
      (datum: { date: string }) => ({
        name: 'MACD柱',
        color:
          (barByDate.get(datum.date) ?? 0) >= 0 ? MACD_BAR_UP_COLOR : MACD_BAR_DOWN_COLOR,
        value: formatValue(barByDate.get(datum.date)),
      }),
      (datum: { date: string }) => ({
        name: 'DIFF',
        color: DIF_COLOR,
        value: formatValue(difByDate.get(datum.date)),
      }),
      (datum: { date: string }) => ({
        name: 'DEA',
        color: DEA_COLOR,
        value: formatValue(deaByDate.get(datum.date)),
      }),
      (datum: { date: string }) => ({
        name: 'DEA-DIF',
        color: DEA_MINUS_DIF_COLOR,
        value: formatValue(deaMinusDifByDate.get(datum.date)),
      }),
      (datum: { date: string }) => ({
        name: 'DEA÷DIF',
        color: DEA_DIV_DIF_COLOR,
        value: formatValue(deaDivDifByDate.get(datum.date)),
      }),
    ],
  };

  /** 左轴配置：主折线可见时由主折线承担；主折线全隐藏时由柱状图承担，避免只剩柱时没有 y 轴 */
  const leftAxisConfig = {
    y: {
      title: `${periodLabel} · ${MACD_TITLE}`,
      grid: { line: { style: { stroke: '#e8e8e8', lineDash: [3, 3] } } },
      label: { style: { fill: '#595959', fontSize: 11 } },
    },
  };

  const children: Record<string, unknown>[] = [];

  // 比值线放在最前面：先绘制（位于底层），避免密集实线遮挡柱和 DIFF/DEA
  if (ratioVisible) {
    children.push({
      data: ratioPlotData,
      type: 'line' as const,
      yField: 'ratioPlot',
      style: {
        stroke: DEA_DIV_DIF_COLOR,
        lineWidth: 1,
        opacity: 0.35,
      },
      scale: { y: { key: 'ratioY', independent: false, domain: ratioDomain } },
      axis: {
        y: {
          position: 'right' as const,
          title: 'DEA÷DIF',
          grid: false,
          label: { style: { fill: DEA_DIV_DIF_COLOR, fontSize: 10 } },
        },
      },
      tooltip: tooltipHost === 'ratio' ? tooltipConfig : false,
    });
  }

  if (lineVisible) {
    children.push({
      data: lineData,
      type: 'line' as const,
      yField: 'value',
      colorField: 'series',
      style: { lineWidth: 1.5 },
      scale: {
        y: { domain: yDomain },
        color: {
          domain: ['DIFF', 'DEA', 'DEA-DIF'],
          range: [DIF_COLOR, DEA_COLOR, DEA_MINUS_DIF_COLOR],
        },
      },
      axis: leftAxisConfig,
      tooltip: tooltipHost === 'line' ? tooltipConfig : false,
    });
  }

  if (barVisible) {
    children.push({
      data: chartData,
      type: 'interval' as const,
      yField: 'bar',
      style: {
        fill: (datum: { bar: number }) =>
          datum.bar >= 0 ? MACD_BAR_UP_COLOR : MACD_BAR_DOWN_COLOR,
        maxWidth: 12,
      },
      scale: { y: { domain: yDomain } },
      // 主折线全部隐藏时，由柱状图承担左 y 轴，避免只剩柱时没有刻度
      axis: lineVisible ? { y: false } : leftAxisConfig,
      tooltip: tooltipHost === 'bar' ? tooltipConfig : false,
    });
  }

  // 峰值标记放在最后（最上层）：红圈 + 峰值数值，与比值线共用右侧 y 轴
  if (ratioVisible && peakData.length > 0) {
    children.push({
      data: peakData,
      type: 'point' as const,
      yField: 'ratioPeak',
      style: {
        fill: '#ffffff',
        stroke: RATIO_PEAK_COLOR,
        lineWidth: 2,
        r: 4,
      },
      scale: { y: { key: 'ratioY', independent: false, domain: ratioDomain } },
      axis: false,
      tooltip: false,
    });
    children.push({
      data: peakData,
      type: 'text' as const,
      yField: 'ratioPeak',
      textField: 'label',
      style: {
        fill: RATIO_PEAK_COLOR,
        fontSize: 10,
        fontWeight: 600,
        textAlign: 'center',
        // 峰值达到右轴顶部时把数值放到圆点下方，避免被画布上边缘裁掉
        textBaseline: (datum: { atTop: boolean }) => (datum.atTop ? 'top' : 'bottom'),
        dy: (datum: { atTop: boolean }) => (datum.atTop ? 12 : -8),
      },
      scale: { y: { key: 'ratioY', independent: false, domain: ratioDomain } },
      axis: false,
      tooltip: false,
    });
  }

  return {
    chartConfig: {
      xField: 'date',
      height: 300,
      autoFit: true,
      clip: true,
      // 区间切换需要频繁重绘，关闭入场动画以减少卡顿
      animate: false,
      legend: false,
      tooltip: { showCrosshairs: true, shared: true },
      // x 轴配置放在顶层，确保各 mark 的 x guide 一致（否则后面 mark 的 axis 配置会覆盖/关闭 x 轴）
      axis: {
        x: {
          labelFormatter: (value: string) => moment(value).format('YYYYMMDD'),
          label: { style: { fill: '#595959', fontSize: 11 } },
        },
      },
      children,
    },
    peakRows,
  };
};

/**
 * MACD 技术指标（日/周/月/季）。
 *
 * 计算口径：DIF = EMA(收盘,12) − EMA(收盘,26)，DEA = EMA(DIF,9)，MACD 柱 = 2 × (DIF − DEA)。
 * 图表额外展示两条派生线：DEA-DIF（= −MACD柱/2）与 DEA÷DIF（右轴，DIF=0 时为断点）。
 * 周/月/季 MACD 均先由日 K 聚合为对应周期收盘价，再按同一参数独立计算。
 */
const MacdFilterMark: React.FC<MacdFilterMarkProps> = ({
  data,
  type = 'stock',
  visiblePeriods,
}) => {
  /** 价格/收益率文案：基金为累计收益率 */
  const priceLabel = type === 'fund' ? '累计收益率' : '收盘价';

  /** 可见周期：默认全部四周期（日/周/月/季） */
  // 用签名作为依赖，避免父组件传入内联数组时每次渲染都重建周期列表、触发 MACD 重算
  const visiblePeriodsSignature =
    visiblePeriods === undefined ? '__all__' : visiblePeriods.join(',');
  const visibleMacdPeriods = useMemo(
    () =>
      visiblePeriods === undefined
        ? MACD_PERIODS
        : MACD_PERIODS.filter((meta) => visiblePeriods.includes(meta.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePeriodsSignature],
  );

  /** 各周期被图例隐藏的数据系列（每个周期图独立过滤） */
  const [hiddenByPeriod, setHiddenByPeriod] = useState<Record<MacdPeriodKey, MacdLegendKey[]>>({
    daily: [],
    weekly: [],
    monthly: [],
    quarterly: [],
  });

  /** 点击图例切换某周期某个系列的显示/隐藏 */
  const toggleLegend = (periodKey: MacdPeriodKey, key: MacdLegendKey) => {
    setHiddenByPeriod((prev) => {
      const current = prev[periodKey];
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      return { ...prev, [periodKey]: next };
    });
  };

  /** 样本区间（受控，null = 全部数据）；先裁剪样本，再重算 MACD/峰值 */
  const [sampleRange, setSampleRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const hasSampleRange = Boolean(sampleRange?.[0] || sampleRange?.[1]);

  /**
   * 实际参与计算的区间：选择日期后先让选择器立即响应，再把重算放到 transition 中，
   * 避免 G2 图表重绘阻塞日期面板交互（与 RsiFilterMark 的 loading 体验一致）。
   */
  const [appliedRange, setAppliedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (sampleRange === appliedRange) return;
    const timer = setTimeout(() => {
      startTransition(() => setAppliedRange(sampleRange));
    }, 0);
    return () => clearTimeout(timer);
  }, [sampleRange, appliedRange]);

  /** 区间已变更但图表尚未重算完成 */
  const isComputing = sampleRange !== appliedRange;

  /** 数据自身日期边界：开始不得早于最早日期，结束不得晚于最晚日期 */
  const dataDateBounds = useMemo(() => {
    if (!data?.length) return null;
    let min = Infinity;
    let max = -Infinity;
    data.forEach((item) => {
      const time = moment(item.日期).valueOf();
      if (!Number.isFinite(time)) return;
      if (time < min) min = time;
      if (time > max) max = time;
    });
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }, [data]);

  /** 区间内的样本数据（含首尾两日）；后续 MACD/峰值均基于该数据重算 */
  const filteredData = useMemo(() => {
    const start = appliedRange?.[0];
    const end = appliedRange?.[1];
    if (!data?.length || (!start && !end)) return data;
    const startMs = start ? start.startOf('day').valueOf() : -Infinity;
    const endMs = end ? end.endOf('day').valueOf() : Infinity;
    return data.filter((item) => {
      const time = moment(item.日期).valueOf();
      return time >= startMs && time <= endMs;
    });
  }, [data, appliedRange]);

  /** 区间内样本摘要：样本点数与首尾日期 */
  const sampleRangeStats = useMemo(() => {
    if (!filteredData?.length) return null;
    const first = filteredData[0]?.日期;
    const last = filteredData[filteredData.length - 1]?.日期;
    const format = (value?: string) =>
      value && moment(value).isValid() ? moment(value).format('YYYY-MM-DD') : '--';
    return { count: filteredData.length, first: format(first), last: format(last) };
  }, [filteredData]);

  /** 只清除开始日期，保留结束日期（变为「结束日期及之前」的单边区间） */
  const clearSampleStart = () => {
    setSampleRange((prev) => (prev?.[1] ? [null, prev[1]] : null));
  };

  /** 只清除结束日期，保留开始日期（变为「开始日期及之后」的单边区间） */
  const clearSampleEnd = () => {
    setSampleRange((prev) => (prev?.[0] ? [prev[0], null] : null));
  };

  /** MACD 计算只依赖裁剪后的样本：切换图例时无需重算指标 */
  const macdRowsByPeriod = useMemo<Partial<Record<MacdPeriodKey, MacdRow[]>> | null>(() => {
    if (!filteredData?.length || !visibleMacdPeriods.length) return null;

    const result: Partial<Record<MacdPeriodKey, MacdRow[]>> = {};
    visibleMacdPeriods.forEach((meta) => {
      const periodData =
        meta.key === 'daily'
          ? filteredData
          : aggregateKLineByPeriod({ dailyData: filteredData, period: meta.key });
      result[meta.key] = calculateMACD({ data: periodData, ...MACD_PARAMS }) as MacdRow[];
    });
    return result;
  }, [filteredData, visibleMacdPeriods]);

  const periodResults = useMemo<MacdPeriodResult[]>(() => {
    if (!macdRowsByPeriod) return [];

    return visibleMacdPeriods.flatMap((meta) => {
      const rows = macdRowsByPeriod[meta.key];
      if (!rows?.length) return [];
      const last = rows[rows.length - 1];
      const peakWindow = meta.key === 'daily' ? null : RATIO_PEAK_WINDOWS[meta.key];
      const peakConfirmLag = meta.key === 'daily' ? null : RATIO_PEAK_CONFIRM_LAGS[meta.key];
      const { chartConfig, peakRows } = buildMacdChartConfig(
        rows,
        meta.label,
        new Set(hiddenByPeriod[meta.key]),
        peakWindow,
        peakConfirmLag ?? 1,
      );
      return [
        {
          meta,
          latest: {
            date: moment(last.日期).format('YYYY-MM-DD'),
            dif: last.__MACD_DIF__,
            dea: last.__MACD_DEA__,
            bar: last.__MACD_BAR__,
          },
          hasRatio: rows.some((row) => row.__MACD_DEA_DIV_DIF__ != null),
          peakWindow,
          peakConfirmLag,
          peakRows,
          chartConfig,
        },
      ];
    });
  }, [macdRowsByPeriod, visibleMacdPeriods, hiddenByPeriod]);

  /** 买点表列：买入价格列标题随 type 切换 */
  const peakTableColumns = useMemo(() => buildPeakTableColumns(priceLabel), [priceLabel]);

  /** 样本区间控件：空数据/空区间时也保留，便于重新选择 */
  const sampleRangeControl = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        background: hasSampleRange
          ? 'linear-gradient(90deg, rgba(114, 46, 209, 0.08) 0%, rgba(24, 144, 255, 0.04) 100%)'
          : 'linear-gradient(90deg, #fafbfc 0%, #f2f5f9 100%)',
        border: `1px solid ${hasSampleRange ? 'rgba(114, 46, 209, 0.3)' : '#e6eaf1'}`,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              fontSize: 14,
              color: hasSampleRange ? '#fff' : '#8c8c8c',
              background: hasSampleRange
                ? 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)'
                : '#eceff4',
            }}
          >
            <CalendarOutlined />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#262626',
              }}
            >
              样本区间
              <Tag
                color={hasSampleRange ? 'purple' : undefined}
                style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px' }}
              >
                {hasSampleRange ? '已启用' : '全部数据'}
              </Tag>
            </span>
            <span style={{ fontSize: 11.5, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
              {isComputing
                ? '计算中…'
                : sampleRangeStats
                  ? `${sampleRangeStats.count.toLocaleString()} 个样本点 · ${sampleRangeStats.first} ~ ${sampleRangeStats.last}`
                  : '暂无可用样本'}
            </span>
          </div>
        </div>
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <DatePicker.RangePicker
            allowClear
            allowEmpty={[true, true]}
            size="small"
            value={sampleRange}
            placeholder={['开始日期', '结束日期']}
            style={{ width: 280 }}
            onChange={(dates) => setSampleRange(dates ?? null)}
            disabledDate={(current) => {
              if (!current || !dataDateBounds) return false;
              return (
                current.isBefore(dayjs(dataDateBounds.min), 'day') ||
                current.isAfter(dayjs(dataDateBounds.max), 'day')
              );
            }}
          />
          <Button
            type="link"
            size="small"
            disabled={!sampleRange?.[0]}
            onClick={clearSampleStart}
            style={{ padding: 0, fontSize: 12 }}
          >
            清除开始
          </Button>
          <Button
            type="link"
            size="small"
            disabled={!sampleRange?.[1]}
            onClick={clearSampleEnd}
            style={{ padding: 0, fontSize: 12 }}
          >
            清除结束
          </Button>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          paddingTop: 8,
          borderTop: '1px dashed rgba(114, 46, 209, 0.18)',
          fontSize: 12,
          lineHeight: 1.7,
          color: '#5c6b82',
        }}
      >
        <InfoCircleOutlined style={{ color: '#722ed1', marginTop: 3 }} />
        <span>
          选择区间后先裁剪样本，再基于样本重算 MACD 与峰值；买点按「峰值后第 N 根确认」的
          <span style={{ color: '#262626', fontWeight: 600 }}> as-of 口径</span>
          生成，不使用区间外数据，也不使用确认日之后的数据。
        </span>
      </div>
    </div>
  );

  if (!data?.length) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {sampleRangeControl}
        <Empty description="暂无数据" style={{ margin: '24px 0' }} />
      </Space>
    );
  }

  if (!filteredData.length) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {sampleRangeControl}
        <div style={{ fontSize: 13, color: '#8c8c8c' }}>所选样本区间内暂无数据，请调整日期范围</div>
      </Space>
    );
  }

  if (!periodResults.length) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {sampleRangeControl}
        <Empty description="暂无可见周期" style={{ margin: '24px 0' }} />
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {sampleRangeControl}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '11px 16px',
          borderRadius: 8,
          background: 'linear-gradient(90deg, rgba(24, 144, 255, 0.08) 0%, rgba(24, 144, 255, 0.02) 100%)',
          border: '1px solid rgba(24, 144, 255, 0.2)',
          borderLeft: '3px solid #1890ff',
        }}
      >
        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 15, marginTop: 2 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.8, color: '#46536b' }}>
          <span style={{ color: '#262626', fontWeight: 600 }}>{MACD_TITLE}</span>：
          DIF（快线）= <span style={{ color: DIF_COLOR, fontWeight: 600 }}>EMA({priceLabel},12) − EMA({priceLabel},26)</span>，
          DEA（慢线）= <span style={{ color: DEA_COLOR, fontWeight: 600 }}>EMA(DIF,9)</span>，
          MACD 柱 = <span style={{ color: MACD_BAR_UP_COLOR, fontWeight: 600 }}>2 × (DIF − DEA)</span>；
          <span style={{ color: DEA_MINUS_DIF_COLOR, fontWeight: 600 }}>DEA−DIF = −MACD柱/2</span>（紫线）；
          <span style={{ color: DEA_DIV_DIF_COLOR, fontWeight: 600 }}>DEA÷DIF</span>（粉色实线，右侧独立轴，
          DIF=0 时无定义、显示为断点；右轴按 2%~98% 分位显示，超出范围的比值钳制到上下边界以保证曲线连续，
          tooltip 仍为真实值）；
          <span style={{ color: RATIO_PEAK_COLOR, fontWeight: 600 }}>红圈 + 数值</span>
          标记 DEA÷DIF 的顶部峰值：当前值为过去 N 根内最高且为正值（周52 / 月12 / 季4 根，约 1 年），
          峰值后第 M 根确认买点（默认 M=1，as-of）；日K数据过密不标记；
          买点表列出买点日（确认日）的指标值，并附峰值日期与峰值比值；
          DIF 上穿 DEA 为<span style={{ color: MACD_BAR_UP_COLOR, fontWeight: 600 }}>金叉</span>，
          下穿为<span style={{ color: MACD_BAR_DOWN_COLOR, fontWeight: 600 }}>死叉</span>；
          柱由负转正/正转负反映动能切换。周/月/季 MACD 分别按对应周期最后一个交易日的{priceLabel}独立计算。
        </span>
      </div>

      {isComputing ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '48px 0',
            borderRadius: 8,
            background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
            border: '1px solid #e8e8e8',
          }}
        >
          <Spin size="large" />
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>
            MACD 指标与峰值重算中，请稍候…
          </span>
        </div>
      ) : (
        <>
          <CollapsibleCard
            title={
              <>
                <span style={sectionAccentStyle('#1890ff')} />
                <span>概览</span>
                <span style={sectionSubStyle}>各周期 MACD 最新值与更新时间</span>
              </>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {periodResults.map(({ meta, latest }) => (
                <div
                  key={meta.key}
                  style={{
                    minWidth: 0,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: `${meta.color}0f`,
                    border: `1px solid ${meta.color}40`,
                    borderLeft: `3px solid ${meta.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: meta.color,
                        boxShadow: `0 0 6px ${meta.color}80`,
                      }}
                    />
                    <span style={{ fontSize: 14, color: '#595959', fontWeight: 600 }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                      {latest ? latest.date : '--'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      columnGap: 8,
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>
                      <div style={{ color: '#8c8c8c', fontSize: 11 }}>DIF</div>
                      <div style={{ color: DIF_COLOR, fontWeight: 600 }}>{formatValue(latest?.dif)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#8c8c8c', fontSize: 11 }}>DEA</div>
                      <div style={{ color: DEA_COLOR, fontWeight: 600 }}>{formatValue(latest?.dea)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#8c8c8c', fontSize: 11 }}>MACD柱</div>
                      <div
                        style={{
                          color:
                            latest && latest.bar < 0 ? MACD_BAR_DOWN_COLOR : MACD_BAR_UP_COLOR,
                          fontWeight: 600,
                        }}
                      >
                        {formatValue(latest?.bar)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title={
              <>
                <span style={sectionAccentStyle('#8c8c8c')} />
                <span>技术指标详情</span>
                <span style={sectionSubStyle}>日 / 周 / 月 / 季 MACD 走势</span>
              </>
            }
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {periodResults.map(
                ({ meta, chartConfig, hasRatio, peakRows, peakWindow, peakConfirmLag }) => {
                  const hiddenSet = new Set(hiddenByPeriod[meta.key]);
                  const allHidden =
                    (['bar', 'dif', 'dea', 'deaMinusDif'] as MacdLegendKey[]).every((key) =>
                      hiddenSet.has(key),
                    ) && (!hasRatio || hiddenSet.has('ratio'));

                  return (
                    <div key={meta.key} style={chartContainerStyle}>
                      <div style={chartLabelStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: meta.color,
                            boxShadow: `0 0 6px ${meta.color}80`,
                          }}
                        />
                        {meta.label} · {MACD_TITLE}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 8,
                          fontSize: 11,
                          fontWeight: 400,
                          color: '#8c8c8c',
                        }}
                      >
                        {MACD_LEGEND_ITEMS.filter((item) => item.key !== 'ratio' || hasRatio).map(
                          (item, index) => {
                            const isHidden = hiddenSet.has(item.key);
                            return (
                              <span
                                key={`${item.key}-${index}`}
                                role="button"
                                tabIndex={0}
                                title="点击显示/隐藏该系列"
                                onClick={() => toggleLegend(meta.key, item.key)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    toggleLegend(meta.key, item.key);
                                  }
                                }}
                                style={{
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  opacity: isHidden ? 0.35 : 1,
                                  textDecoration: isHidden ? 'line-through' : 'none',
                                  transition: 'opacity 0.15s ease',
                                }}
                              >
                                <span style={{ color: item.color }}>{item.symbol}</span> {item.label}
                              </span>
                            );
                          },
                        )}
                        <span style={{ color: '#bfbfbf' }}>点击图例可显示/隐藏</span>
                      </div>
                      {allHidden ? (
                        <div
                          style={{
                            height: 300,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px dashed #d9d9d9',
                            borderRadius: 6,
                            background: '#ffffff',
                            fontSize: 12,
                            color: '#8c8c8c',
                          }}
                        >
                          已隐藏全部系列，点击上方图例恢复
                        </div>
                      ) : (
                        <DualAxes {...chartConfig} />
                      )}
                      {peakWindow != null && (
                        <div style={{ marginTop: 12 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              flexWrap: 'wrap',
                              gap: 6,
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#595959' }}>
                              红色峰值买点（{meta.label}）
                            </span>
                            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                              过去 {peakWindow} 根内最高且为正值的 DEA÷DIF 峰值；峰值列取红点当日数据，
                              买入列取峰值后第 {peakConfirmLag ?? 1} 根（确认日）数据
                            </span>
                          </div>
                          {peakRows.length > 0 ? (
                            <Table<MacdPeakRow>
                              dataSource={peakRows}
                              columns={peakTableColumns}
                              rowKey={(row) => `${row.peakDate}-${row.buyDate}`}
                              size="small"
                              bordered
                              pagination={false}
                              scroll={{ x: 840 }}
                            />
                          ) : (
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>暂无峰值买点</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </Space>
          </CollapsibleCard>
        </>
      )}
    </Space>
  );
};

export default memo(MacdFilterMark);
