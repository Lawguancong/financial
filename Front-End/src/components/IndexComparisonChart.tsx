import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import { DualAxes } from '@ant-design/plots';
import moment from 'moment';
import { filterByFrequency } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';

/**
 * 双指数比值对比通用组件（4 个「双指数比值对比」tab 共用）。
 * 左轴：左右两条指数折线；右轴：二者比值面积图（按分位分区高亮）。
 * 月度采样、按月对齐取交集、分位统计、分区拆段等公共逻辑统一在此实现；
 * 各 tab 仅通过 props 提供数据源 fetch 与展示配置（指数名/折线色/右轴标题与色/右轴区间/说明文案）。
 */

/** 单条指数序列（未采样）：date 为交易日字符串，close 为收盘点位 */
export interface NormalizedPoint {
  date: string;
  close: number;
}

export interface IndexComparisonChartProps {
  chartName: string;
  subtitle?: string;
  /** 左路指数：名称、折线色、左轴标题色（可选，不传则不设），以及数据源 fetch */
  left: {
    name: string;
    color: string;
    axisTitleColor?: string;
    fetch: () => Promise<NormalizedPoint[]>;
  };
  /** 右路指数：名称、折线色，以及数据源 fetch */
  right: {
    name: string;
    color: string;
    fetch: () => Promise<NormalizedPoint[]>;
  };
  /** 右轴标题，如 '沪深300/债券基金' */
  ratioAxisTitle: string;
  /** 图例/tooltip 行名，如 '沪深300/债券基金(比值)' */
  ratioLegend: string;
  /** 比值线色（纯色 hex）：右轴标题色 + 中区填充基色 */
  ratioColor: string;
  /** 右轴固定区间，不传则自适应 */
  ratioDomain?: [number, number];
  /** 左轴标题，默认 '收盘点位' */
  leftAxisTitle?: string;
  /** 右轴派生指标口径：ratio=左右比值（默认）；diff=左右差值（百分点，用于年化收益率差） */
  derivedMode?: 'ratio' | 'diff';
  /** 右轴派生指标保留小数位（默认 4；差值建议 2） */
  derivedDigits?: number;
  /** 顶部「当前派生指标」标题，默认 '当前比值' */
  derivedCurrentLabel?: string;
  /** 顶部卡片是否展示左右两条曲线的最新值（默认 false） */
  showLatestValues?: boolean;
  /** 顶部卡片数值单位后缀（默认空，如 '%'） */
  valueSuffix?: string;
  /** 是否允许负值（年化收益率等指标可为负）；默认 false，仅保留 >0 的点（指数点位口径） */
  allowNegative?: boolean;
  /** 各 tab 独有的起始对齐说明（分位高亮规则由组件统一追加） */
  note: React.ReactNode;
}

type ChartItem = { date: string; key: string; label: string; value: number };

/** 分区阈值与配色（配置见 appConfig.chart.indexComparison） */
const {
  lowPercentile: RATIO_LOW_PERCENTILE,
  highPercentile: RATIO_HIGH_PERCENTILE,
  lowColor: LOW_ZONE_COLOR,
  highColor: HIGH_ZONE_COLOR,
} = appConfig.chart.indexComparison;
/** 分区高亮图例名 */
const RATIO_ZONE_LEGEND = {
  low: `低于${RATIO_LOW_PERCENTILE}%分位`,
  high: `高于${RATIO_HIGH_PERCENTILE}%分位`,
};

/**
 * 顶部卡片展示的分位点：固定 5%/95% 参考 + 配置的低/高分区阈值，去重后升序。
 * 配置为 10/90 时展示 5/10/90/95 四行；配置为 5/95 时去重为两行，避免标签与取值错位。
 */
const RATIO_CARD_PERCENTILES = [...new Set([5, RATIO_LOW_PERCENTILE, RATIO_HIGH_PERCENTILE, 95])].sort(
  (a, b) => a - b,
);

/** 把 #rrggbb 转成 rgba(r,g,b,alpha)：中间区填充 = 比值线色加 0.25 透明度（等价于各 tab 原先手写的 rgba 值） */
const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const IndexComparisonChart: React.FC<IndexComparisonChartProps> = (props) => {
  const { left, right, ratioLegend } = props;
  const [data, setData] = useState<{ leftData: ChartItem[]; rightData: ChartItem[] }>({ leftData: [], rightData: [] });
  const [loading, setLoading] = useState(false);
  /** 右轴派生指标口径与精度：ratio=比值（4 位）；diff=差值（默认 2 位） */
  const derivedIsDiff = props.derivedMode === 'diff';
  const derivedDigits = props.derivedDigits ?? (derivedIsDiff ? 2 : 4);
  const derivedNoun = derivedIsDiff ? '差值' : '比值';
  /** 负值是否合法：指数点位必须 >0，年化收益率等指标可为负（含 0） */
  const allowNegative = props.allowNegative === true;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leftRes, rightRes] = await Promise.all([left.fetch(), right.fetch()]);
      // 月度采样：每月只取最后一条；左右两路按「YYYY-MM」对齐，
      // 避免两指数月末交易日不同（停牌/交易日历差异）导致整月被丢弃
      const leftList = filterByFrequency(leftRes, 'date', 'monthly');
      const rightList = filterByFrequency(rightRes, 'date', 'monthly');
      const toMonthMap = (list: NormalizedPoint[]) => new Map(
        list
          .filter((item) => Number.isFinite(Number(item.close)) && (allowNegative || Number(item.close) > 0))
          .map((item) => [moment(item.date).format('YYYY-MM'), Number(item.close)]),
      );
      const leftMap = toMonthMap(leftList);
      const rightMap = toMonthMap(rightList);
      const merged = [...leftMap.keys()]
        .filter((month) => rightMap.has(month))
        .sort()
        .map((month) => ({
          date: month,
          left: leftMap.get(month) as number,
          right: rightMap.get(month) as number,
        }));

      setData({
        leftData: merged.flatMap((item) => [
          { date: item.date, key: 'left', label: left.name, value: item.left },
          { date: item.date, key: 'right', label: right.name, value: item.right },
        ]),
        rightData: merged.map((item) => ({
          date: item.date,
          key: 'ratio',
          label: ratioLegend,
          value: Number((derivedIsDiff ? item.left - item.right : item.left / item.right).toFixed(derivedDigits)),
        })),
      });
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [left, right, ratioLegend, derivedIsDiff, derivedDigits, allowNegative]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  console.log(`${props.chartName} -> data`, data);

  /** 左右两条曲线的最新值（仅在 showLatestValues 时展示到顶部卡片） */
  const latestValues = useMemo(() => {
    if (!props.showLatestValues) return null;
    const last = data.leftData[data.leftData.length - 1];
    if (!last) return null;
    const leftItem = data.leftData.find((item) => item.key === 'left' && item.date === last.date);
    const rightItem = data.leftData.find((item) => item.key === 'right' && item.date === last.date);
    if (!leftItem || !rightItem) return null;
    return { left: leftItem.value, right: rightItem.value };
  }, [data.leftData, props.showLatestValues]);

  // 比值统计：当前值 + 全历史 5%/10%/90%/95% 分位值 + 近十年 5%/10%/90%/95% 分位值
  const ratioStats = useMemo(() => {
    const items = data.rightData.filter((d) => Number.isFinite(d.value));
    if (!items.length) return null;
    const pct = (list: number[], p: number) => {
      const sorted = [...list].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
      return sorted[idx];
    };
    const all = items.map((d) => d.value);
    // 近十年：以最新日期往前推 10 年作为起算点
    const latestDate = new Date(items[items.length - 1].date);
    const cutoff = new Date(latestDate.getFullYear() - 10, latestDate.getMonth(), latestDate.getDate());
    const recent10y = items
      .filter((d) => new Date(d.date) >= cutoff)
      .map((d) => d.value);
    return {
      current: all[all.length - 1],
      /** 分区着色边界：低区/高区阈值（配置驱动） */
      lowAll: pct(all, RATIO_LOW_PERCENTILE),
      highAll: pct(all, RATIO_HIGH_PERCENTILE),
      lowRecent: pct(recent10y, RATIO_LOW_PERCENTILE),
      highRecent: pct(recent10y, RATIO_HIGH_PERCENTILE),
      /** 顶部卡片分位行：按配置生成，已去重 */
      fullPercentiles: RATIO_CARD_PERCENTILES.map((percentile) => ({ percentile, value: pct(all, percentile) })),
      recentPercentiles: RATIO_CARD_PERCENTILES.map((percentile) => ({
        percentile,
        value: pct(recent10y, percentile),
      })),
      has10y: recent10y.length > 0,
      /** 近十年起算时间戳：>= 该值属于近十年，< 该值属于 10 年前 */
      cutoffTime: cutoff.getTime(),
    };
  }, [data.rightData]);

  /**
   * G2 面积图一条 series 只能有一个填充色，且同一 series 会跨段连线。
   * 因此把比值序列按“分位分区”的连续段拆成独立 series（seriesField=runKey，避免跨段连线），
   * 再按分区取色（colorField=label）；分区边界点同时归入相邻两段，保证不断缝。
   */
  const ratioZoneArea = useMemo(() => {
    type ZoneKey = 'low' | 'mid' | 'high';
    const items = data.rightData.filter((d) => Number.isFinite(d.value));
    if (!items.length) return { rows: [] as (ChartItem & { runKey: string })[] };
    // 分区阈值按时间切换：近十年(>= cutoffTime) 用“近十年分位”，10 年前(< cutoffTime) 用“全历史分位”；
    // 两种情况颜色完全一致（绿=低区、红=高区），仅阈值口径不同。
    const p10All = ratioStats?.lowAll ?? -Infinity;
    const p90All = ratioStats?.highAll ?? Infinity;
    const p10Recent = ratioStats?.has10y ? ratioStats.lowRecent : p10All;
    const p90Recent = ratioStats?.has10y ? ratioStats.highRecent : p90All;
    const cutoffTime = ratioStats?.cutoffTime ?? Infinity;
    const zoneOf = (date: string, value: number): ZoneKey => {
      const isRecent = new Date(date).getTime() >= cutoffTime;
      const p10 = isRecent ? p10Recent : p10All;
      const p90 = isRecent ? p90Recent : p90All;
      return value < p10 ? 'low' : value > p90 ? 'high' : 'mid';
    };
    const zoneLabel: Record<ZoneKey, string> = {
      low: RATIO_ZONE_LEGEND.low,
      mid: ratioLegend,
      high: RATIO_ZONE_LEGEND.high,
    };
    const rows: (ChartItem & { runKey: string })[] = [];
    const push = (runKey: string, zone: ZoneKey, item: ChartItem) => {
      rows.push({ ...item, runKey, label: zoneLabel[zone] });
    };
    let prevZone = zoneOf(items[0].date, items[0].value);
    let prevKey = `r0-${prevZone}`;
    items.forEach((item, i) => {
      const zone = zoneOf(item.date, item.value);
      if (i === 0) {
        push(prevKey, zone, item);
      } else if (zone !== prevZone) {
        push(prevKey, prevZone, item); // 边界点先收口上一段
        prevKey = `r${i}-${zone}`;
        push(prevKey, zone, item); // 新段从边界点开始
        prevZone = zone;
      } else {
        push(prevKey, zone, item);
      }
    });
    return { rows };
  }, [data.rightData, ratioStats, ratioLegend]);

  /** 中间区填充色：由比值线色加透明度得到 */
  const midFill = withAlpha(props.ratioColor, 0.25);

  const config = {
    title: {
      title: props.chartName,
      subtitle: props.subtitle,
    },
    xField: (d: { date: string }) => new Date(d.date),
    legend: true,
    scale: {
      color: {
        domain: [left.name, right.name, ratioLegend, RATIO_ZONE_LEGEND.low, RATIO_ZONE_LEGEND.high],
        range: [left.color, right.color, midFill, LOW_ZONE_COLOR, HIGH_ZONE_COLOR],
      },
    },
    children: [
      {
        data: data.leftData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: { lineWidth: 2 },
        axis: {
          y: {
            title: props.leftAxisTitle ?? '收盘点位',
            ...(left.axisTitleColor ? { style: { titleFill: left.axisTitleColor } } : {}),
          },
        },
      },
      {
        data: ratioZoneArea.rows,
        type: 'area',
        yField: 'value',
        colorField: 'label',
        seriesField: 'runKey',
        shapeField: 'smooth',
        scale: { y: { id: 'ratioY', ...(props.ratioDomain ? { domain: props.ratioDomain } : {}) } },
        axis: { y: { position: 'right', title: props.ratioAxisTitle, style: { titleFill: props.ratioColor } } },
        // 面积图按分区拆段后 seriesField=runKey，G2 默认用 series 名（如 r67-mid）当 tooltip 行名；
        // 用回调形式的 items 显式指定展示名，规避内部 runKey 泄漏；颜色沿用该段面积色（绿/紫/红）
        tooltip: {
          items: [
            (d: ChartItem) => ({ name: ratioLegend, value: d.value }),
          ],
        },
      },
    ],
  };

  return (
    <Spin spinning={loading}>
      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)',
          borderRadius: 8,
          border: '1px solid #ffd591',
          boxShadow: '0 2px 8px rgba(250, 140, 22, 0.15)',
        }}
      >
        <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.6, marginBottom: 10 }}>
          <strong>说明：</strong>{props.note}
          <br />
          右轴面积图按分位分区高亮：<strong>近十年</strong>的{derivedNoun}低于近十年 <strong>{RATIO_LOW_PERCENTILE}% 分位</strong>、或高于近十年 <strong>{RATIO_HIGH_PERCENTILE}% 分位</strong>时改变填充色；
          <strong>10 年前</strong>的{derivedNoun}低于全历史 <strong>{RATIO_LOW_PERCENTILE}% 分位</strong>、或高于全历史 <strong>{RATIO_HIGH_PERCENTILE}% 分位</strong>时同样改变填充色；
          低区为绿色、高区为红色（两种口径颜色一致），其余区间为淡紫色。
        </div>
        {ratioStats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* 当前派生指标 —— 大数字块 */}
            <div
              style={{
                minWidth: 120,
                flex: '1 1 120px',
                background: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid #ffd591',
                borderRadius: 8,
                padding: '8px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 12, color: '#8c5d1f' }}>{props.derivedCurrentLabel ?? '当前比值'}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d46b08', lineHeight: 1.3 }}>
                {ratioStats.current.toFixed(derivedDigits)}
              </div>
            </div>
            {/* 左右两路最新值（仅年化收益率差等需要展示原始数值的图开启） */}
            {latestValues && (
              <>
                <div
                  style={{
                    minWidth: 120,
                    flex: '1 1 120px',
                    background: 'rgba(255, 255, 255, 0.65)',
                    border: '1px solid #ffe0b0',
                    borderRadius: 8,
                    padding: '8px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#8c5d1f' }}>{left.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: left.color, lineHeight: 1.3 }}>
                    {latestValues.left.toFixed(derivedDigits)}{props.valueSuffix}
                  </div>
                </div>
                <div
                  style={{
                    minWidth: 120,
                    flex: '1 1 120px',
                    background: 'rgba(255, 255, 255, 0.65)',
                    border: '1px solid #ffe0b0',
                    borderRadius: 8,
                    padding: '8px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#8c5d1f' }}>{right.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: right.color, lineHeight: 1.3 }}>
                    {latestValues.right.toFixed(derivedDigits)}{props.valueSuffix}
                  </div>
                </div>
              </>
            )}
            {/* 全历史分位组 */}
            <div
              style={{
                minWidth: 150,
                flex: '1 1 150px',
                background: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid #ffe0b0',
                borderRadius: 8,
                padding: '8px 14px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ad6800', marginBottom: 4 }}>全历史分位</div>
              {ratioStats.fullPercentiles.map((item) => (
                <div key={item.percentile} style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                  {item.percentile}%：<b style={{ color: '#ad6800' }}>{item.value.toFixed(derivedDigits)}</b>
                </div>
              ))}
            </div>
            {/* 近十年分位组 */}
            {ratioStats.has10y && (
              <div
                style={{
                  minWidth: 150,
                  flex: '1 1 150px',
                  background: 'rgba(255, 255, 255, 0.65)',
                  border: '1px solid #ffe0b0',
                  borderRadius: 8,
                  padding: '8px 14px',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ad6800', marginBottom: 4 }}>近十年分位</div>
                {ratioStats.recentPercentiles.map((item) => (
                  <div key={item.percentile} style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                    {item.percentile}%：<b style={{ color: '#ad6800' }}>{item.value.toFixed(derivedDigits)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <DualAxes {...config} />
    </Spin>
  );
};

export default IndexComparisonChart;
