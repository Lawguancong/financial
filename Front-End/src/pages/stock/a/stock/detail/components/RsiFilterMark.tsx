import React, { useMemo, memo } from 'react';
import { Line } from '@ant-design/plots';
import { Card, Space, Table, Tag } from 'antd';
import moment from 'moment';
import type { KLineData } from '@/utils/stockUtils';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations, calculatePercentile } from '@/utils/stockUtils';

interface RsiFilterMarkProps {
  data: KLineData[]; // data数据格式参考KLineData
}

// 周期 RSI 字段名（与 stockUtils 中返回的字段保持一致）
type RsiFieldKey =
  | '__daily__RSI6__'
  | '__weekly__RSI6__'
  | '__monthly__RSI6__'
  | '__quarterly__RSI6__';

type RsiPeriodKey = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface RsiPeriodMeta {
  /** 周期键 */
  periodKey: RsiPeriodKey;
  /** 表格列字段名 */
  fieldKey: RsiFieldKey;
  /** 中文标签 */
  label: string;
  /** 折线颜色 */
  color: string;
}

// 单行数据：日期 + 收盘价 + 各周期 RSI6 + 推荐级别（null 表示非买点）
type ChartRow = KLineData & {
  __recommendationLevel__: number | null;
} & Record<RsiFieldKey, number | null>;

// 过滤后的买点数据行（推荐级别必不为 null）
type BuyPointRow = ChartRow & { __recommendationLevel__: number };

// 样式常量
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

// RSI 折线图共享配置（静态部分）
const rsiLineBaseConfig = {
  yField: '__RSI6__',
  height: 240,
  autoFit: true,
  smooth: true,
  animation: { appear: { duration: 600 } },
  lineStyle: { lineWidth: 2 },
  xAxis: {
    type: 'time' as const,
    tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
    label: { style: { fill: '#595959', fontSize: 11 } },
  },
  yAxis: {
    min: 0,
    max: 100,
    grid: { line: { style: { stroke: '#e8e8e8', lineDash: [3, 3] } } },
    label: { style: { fill: '#595959', fontSize: 11 } },
  },
  legend: false as const,
  tooltip: {
    showCrosshairs: true,
    shared: true,
    domStyles: {
      'g2-tooltip': { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)' },
    },
    title: (d: { 日期: string }) => moment(d.日期).format('YYYY-MM-DD'),
    items: [{ field: '__RSI6__', name: 'RSI6' }],
  },
};

// 各周期 RSI 元信息：标签、字段名、颜色
const rsiPeriods: RsiPeriodMeta[] = [
  { periodKey: 'daily', fieldKey: '__daily__RSI6__', label: '日RSI6', color: '#80a02f8b' },
  { periodKey: 'weekly', fieldKey: '__weekly__RSI6__', label: '周RSI6', color: '#52c41a' },
  { periodKey: 'monthly', fieldKey: '__monthly__RSI6__', label: '月RSI6', color: '#1890ff' },
  { periodKey: 'quarterly', fieldKey: '__quarterly__RSI6__', label: '季RSI6', color: '#7014faff' },
];

const rsiWarmup = 6; // calculateRSI 前 6 个点为预热值（固定 50），计算分位时剔除

type RsiStatus = 'overbought' | 'oversold' | 'normal';

// 超买 / 超卖 / 中性 状态标签配色（卡片主色统一使用各周期折线色）
const rsiStatusMeta: Record<RsiStatus, { text: string; tagColor: string }> = {
  overbought: { text: '超买', tagColor: 'red' },
  oversold: { text: '超卖', tagColor: 'green' },
  normal: { text: '中性', tagColor: 'default' },
};

// 将 #RRGGBB / #RRGGBBAA 十六进制颜色转为指定透明度的 rgba
const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 单周期 RSI 分位统计
interface RsiStat {
  label: string;
  /** 与该周期折线一致的主题色 */
  color: string;
  current: number | null;
  p10: number | null;
  p90: number | null;
  position: number | null;
  status: RsiStatus;
}

// 将日期字符串转为 Date 对象（用于 xField）
const rowToDate = (row: { 日期: string }) => new Date(row.日期);

// 推荐级别星标渲染
const renderRecommendationStars = (level: number) => (
  <span style={{ color: '#ffd700', letterSpacing: 1 }}>{'★'.repeat(level)}</span>
);

// 表格基础列
const baseTableColumns = [
  {
    title: '推荐级别',
    dataIndex: '__recommendationLevel__',
    key: '__recommendationLevel__',
    align: 'center' as const,
    width: 100,
    render: renderRecommendationStars,
  },
  {
    title: '日期',
    dataIndex: '日期',
    key: '日期',
    width: 120,
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: '收盘价',
    dataIndex: '收盘',
    key: '收盘',
    align: 'right' as const,
    width: 100,
    render: (value: number) => value?.toFixed(2),
  },
];

// 各周期 RSI 表格列
const rsiTableColumns = rsiPeriods.map(({ fieldKey, label, color }) => ({
  title: label,
  dataIndex: fieldKey,
  key: fieldKey,
  align: 'right' as const,
  width: 100,
  render: (value: number) => (
    <span style={{ color: value != null ? color : '#bfbfbf', fontWeight: 500 }}>
      {value?.toFixed(2)}
    </span>
  ),
}));

const buyPointsColumns = [...baseTableColumns, ...rsiTableColumns];

/**
 * 构建单周期 RSI 折线图配置
 */
const buildRsiLineConfig = (periodMeta: RsiPeriodMeta, data: KLineData[]) => ({
  ...rsiLineBaseConfig,
  data,
  xField: rowToDate,
  yAxis: {
    ...rsiLineBaseConfig.yAxis,
    title: { text: `${periodMeta.label.replace('RSI', 'K RSI')}` },
  },
  style: { stroke: periodMeta.color },
});

/**
 * 周期元信息 -> 周期 RSI 数据键（periodRSIMap 中字段命名规则：${periodKey}RSI）
 */
const rsiDataKeyOf = (periodKey: RsiPeriodKey) => `${periodKey}RSI` as const;

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data }) => {
  const {
    buyPointList,
    mainChartConfig,
    rsiLineConfigs,
    rsiStats,
  } = useMemo(() => {
    const emptyResult = {
      buyPointList: [] as BuyPointRow[],
      mainChartConfig: {} as Record<string, unknown>,
      rsiLineConfigs: {} as Record<RsiPeriodKey, Record<string, unknown>>,
      rsiStats: [] as RsiStat[],
    };

    if (!data?.length) {
      return emptyResult;
    }

    // 1) 计算日/周/月/季 K 线的 RSI6 值
    const periodRSIMap = calculatePeriodRSI(data);

    // 2) 合并为带推荐级别的图表数据
    const chartData = computeRSIRecommendations(periodRSIMap) as ChartRow[];

    // 3) 过滤出推荐买点
    const buyPointList = chartData.filter(
      (row): row is BuyPointRow => row.__recommendationLevel__ != null,
    );

    // 4) 生成买点标注
    const annotations = createRecommendationAnnotations(buyPointList);

    // 5) 构造主图（收盘价折线 + 买点标注）
    const mainChartConfig = {
      data: chartData,
      xField: rowToDate,
      yField: '收盘',
      smooth: true,
      autoFit: true,
      height: 420,
      animation: { appear: { duration: 800 } },
      appendPadding: [8, 0, 8, 0],
      yAxis: { title: { text: '收盘价', style: { fill: '#262626' } } },
      xAxis: {
        label: { style: { fill: '#595959', fontSize: 11 } },
      },
      style: { stroke: '#ff0033ff', lineWidth: 2 },
      lineStyle: { lineWidth: 2 },
      annotations,
      tooltip: {
        showCrosshairs: true,
        shared: true,
        domStyles: {
          'g2-tooltip': { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)' },
        },
        title: (d: { 日期: string }) => moment(d.日期).format('YYYY-MM-DD'),
        items: [
          { field: '收盘', name: '收盘价', color: '#ff0033ff' },
          ...rsiPeriods.map(({ fieldKey, label, color }) => ({
            field: fieldKey,
            name: label,
            color,
          })),
        ],
      },
    };

    // 6) 构造各周期 RSI 折线图配置
    const rsiLineConfigs = rsiPeriods.reduce((configs, periodMeta) => {
      const rsiData = periodRSIMap[rsiDataKeyOf(periodMeta.periodKey)];
      configs[periodMeta.periodKey] = buildRsiLineConfig(periodMeta, rsiData);
      return configs;
    }, {} as Record<RsiPeriodKey, Record<string, unknown>>);

    // 7) 各周期 RSI6 当前值、历史 10%/90% 分位、超买超卖状态
    const rsiStats: RsiStat[] = rsiPeriods.map(({ label, color, periodKey }) => {
      // 剔除前 rsiWarmup 个预热点（固定值 50），避免干扰分位
      const values = periodRSIMap[rsiDataKeyOf(periodKey)]
        .slice(rsiWarmup)
        .map((item) => item.__RSI6__)
        .filter((value): value is number => typeof value === 'number');

      if (!values.length) {
        return { label, color, current: null, p10: null, p90: null, position: null, status: 'normal' };
      }

      const current = Number(values[values.length - 1].toFixed(2));
      const p10 = Number(calculatePercentile(values, 10).toFixed(2));
      const p90 = Number(calculatePercentile(values, 90).toFixed(2));
      // 当前值在历史序列中的分位位置（0~100）
      const position = Number(((values.filter((v) => v <= current).length / values.length) * 100).toFixed(1));
      const status: RsiStatus = current >= p90 ? 'overbought' : current <= p10 ? 'oversold' : 'normal';

      return { label, color, current, p10, p90, position, status };
    });

    return { buyPointList, mainChartConfig, rsiLineConfigs, rsiStats };
  }, [data]);

  if (!data?.length) {
    return <div>暂无数据</div>;
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card
        size="small"
        variant="outlined"
        title="各周期 RSI6 · 历史分位参考"
        style={{ borderRadius: 8 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rsiStats.map((stat) => {
            const meta = rsiStatusMeta[stat.status];
            return (
              <div
                key={stat.label}
                style={{
                  flex: '1 1 150px',
                  minWidth: 150,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: withAlpha(stat.color, 0.06),
                  border: `1px solid ${withAlpha(stat.color, 0.25)}`,
                  borderLeft: `3px solid ${stat.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: stat.color,
                        boxShadow: `0 0 6px ${withAlpha(stat.color, 0.5)}`,
                      }}
                    />
                    {stat.label.replace('RSI', 'K · RSI')}
                  </span>
                  <Tag color={meta.tagColor} style={{ marginInlineEnd: 0 }}>
                    {meta.text}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: stat.color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stat.current ?? '--'}
                  </span>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                    当前{stat.position != null ? ` · 位置 ${stat.position}%` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                  <span>
                    10%分位 <b style={{ color: '#595959', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{stat.p10 ?? '--'}</b>
                  </span>
                  <span style={{ marginLeft: 12 }}>
                    90%分位 <b style={{ color: '#595959', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{stat.p90 ?? '--'}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        size="small"
        variant="outlined"
        title="RSI指标-推荐买点"
        style={{ borderRadius: 8 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={buyPointList}
          columns={buyPointsColumns}
          rowKey="日期"
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 720 }}
        />
      </Card>

      <Card
        size="small"
        variant="outlined"
        title={
          <span style={{ fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 14,
                background: '#ff0033ff',
                marginRight: 8,
                borderRadius: 2,
                verticalAlign: 'middle',
              }}
            />
            收盘价 · 买点标注
          </span>
        }
        style={{ 
          borderRadius: 8,
          background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)',
        }}
      >
        <Line {...mainChartConfig} />
      </Card>

      <Card
        size="small"
        variant="outlined"
        title={
          <span style={{ fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 14,
                background: '#1890ff',
                marginRight: 8,
                borderRadius: 2,
                verticalAlign: 'middle',
              }}
            />
            RSI6 技术指标
          </span>
        }
        style={{ borderRadius: 8 }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {rsiPeriods.map(({ periodKey, label, color }) => (
            <div key={periodKey} style={chartContainerStyle}>
              <div style={chartLabelStyle}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }}
                />
                {label.replace('RSI', 'K · RSI')}
              </div>
              <Line {...rsiLineConfigs[periodKey]} />
            </div>
          ))}
        </Space>
      </Card>
    </Space>
  );
};

export default memo(RsiFilterMark);
