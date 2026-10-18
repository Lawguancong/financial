import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import { DualAxes } from '@ant-design/plots';
import { filterByFrequency } from '@/utils/stockUtils';

/**
 * 双指数比值对比通用组件（4 个「双指数比值对比」tab 共用）。
 * 左轴：左右两条指数折线；右轴：二者比值面积图（按分位分区高亮）。
 * 月度采样、按同一交易日取交集、分位统计、分区拆段等公共逻辑统一在此实现；
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
  /** 各 tab 独有的起始对齐说明（分位高亮规则由组件统一追加） */
  note: React.ReactNode;
}

type ChartItem = { date: string; key: string; label: string; value: number };

/** 分区高亮图例名 */
const RATIO_ZONE_LEGEND = { low: '低于10%分位', high: '高于90%分位' };
/** 低区(低于所属区间10%分位)=绿、高区(高于所属区间90%分位)=红；两种口径颜色一致 */
const LOW_ZONE_COLOR = 'rgba(82, 196, 26, 0.62)';
const HIGH_ZONE_COLOR = 'rgba(113, 8, 14, 1)';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leftRes, rightRes] = await Promise.all([left.fetch(), right.fetch()]);
      // 月度采样：每月只取最后一条，左右两路分别采样后按同一交易日取交集，保证日期严格对齐
      const leftList = filterByFrequency(leftRes, 'date', 'monthly');
      const rightList = filterByFrequency(rightRes, 'date', 'monthly');
      const leftMap = new Map(
        leftList
          .filter((item) => Number.isFinite(Number(item.close)) && Number(item.close) > 0)
          .map((item) => [item.date, Number(item.close)]),
      );
      const rightMap = new Map(
        rightList
          .filter((item) => Number.isFinite(Number(item.close)) && Number(item.close) > 0)
          .map((item) => [item.date, Number(item.close)]),
      );
      const merged = [...leftMap.keys()]
        .filter((date) => rightMap.has(date))
        .sort()
        .map((date) => ({
          date,
          left: leftMap.get(date) as number,
          right: rightMap.get(date) as number,
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
          value: Number((item.left / item.right).toFixed(4)),
        })),
      });
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [left, right, ratioLegend]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  console.log(`${props.chartName} -> data`, data);

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
      p5: pct(all, 5),
      p10: pct(all, 10),
      p90: pct(all, 90),
      p95: pct(all, 95),
      r10P5: pct(recent10y, 5),
      r10P10: pct(recent10y, 10),
      r10P90: pct(recent10y, 90),
      r10P95: pct(recent10y, 95),
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
    const p10All = ratioStats?.p10 ?? -Infinity;
    const p90All = ratioStats?.p90 ?? Infinity;
    const p10Recent = ratioStats?.has10y ? ratioStats.r10P10 : p10All;
    const p90Recent = ratioStats?.has10y ? ratioStats.r10P90 : p90All;
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
          右轴面积图按分位分区高亮：<strong>近十年</strong>的比值低于近十年 <strong>10% 分位</strong>、或高于近十年 <strong>90% 分位</strong>时改变填充色；
          <strong>10 年前</strong>的比值低于全历史 <strong>10% 分位</strong>、或高于全历史 <strong>90% 分位</strong>时同样改变填充色；
          低区为绿色、高区为红色（两种口径颜色一致），其余区间为淡紫色。
        </div>
        {ratioStats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* 当前比值 —— 大数字块 */}
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
              <div style={{ fontSize: 12, color: '#8c5d1f' }}>当前比值</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#d46b08', lineHeight: 1.3 }}>
                {ratioStats.current.toFixed(4)}
              </div>
            </div>
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
              <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                5%：<b style={{ color: '#ad6800' }}>{ratioStats.p5.toFixed(4)}</b>
              </div>
              <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                10%：<b style={{ color: '#ad6800' }}>{ratioStats.p10.toFixed(4)}</b>
              </div>
              <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                90%：<b style={{ color: '#ad6800' }}>{ratioStats.p90.toFixed(4)}</b>
              </div>
              <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                95%：<b style={{ color: '#ad6800' }}>{ratioStats.p95.toFixed(4)}</b>
              </div>
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
                <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                  5%：<b style={{ color: '#ad6800' }}>{ratioStats.r10P5.toFixed(4)}</b>
                </div>
                <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                  10%：<b style={{ color: '#ad6800' }}>{ratioStats.r10P10.toFixed(4)}</b>
                </div>
                <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                  90%：<b style={{ color: '#ad6800' }}>{ratioStats.r10P90.toFixed(4)}</b>
                </div>
                <div style={{ fontSize: 13, color: '#8c5d1f', lineHeight: 1.7 }}>
                  95%：<b style={{ color: '#ad6800' }}>{ratioStats.r10P95.toFixed(4)}</b>
                </div>
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
