import React, { useMemo, memo } from 'react';
import { Line } from '@ant-design/plots';
import { Card, Space, Table } from 'antd';
import moment from 'moment';
import type { KLineData } from '@/utils/stockUtils';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations } from '@/utils/stockUtils';
import { pick, isNumber } from 'lodash-es';

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

// MA 周期 -> 字段名
const MA_FIELD_KEYS: Record<string, string> = {
  '5日均线': '__MA5__',
  '10日均线': '__MA10__',
  '20日均线': '__MA20__',
  '30日均线': '__MA30__',
  '60日均线': '__MA60__',
  '90日均线': '__MA90__',
  '250日均线': '__MA250__',
  '500日均线': '__MA500__',
  '750日均线': '__MA750__',
  '1000日均线': '__MA1000__',
  '1250日均线': '__MA1250__',
  '1500日均线': '__MA1500__',
};

const MA_OPTIONS = [
  '5日均线',
  '10日均线',
  '20日均线',
  '30日均线',
  '60日均线',
  '90日均线',
  '250日均线',
  '500日均线',
  '750日均线',
  '1000日均线',
  '1250日均线',
  '1500日均线',
];



// 各均线颜色（顺序与 MA_OPTIONS 对应）
// const MA_COLORS: Record<string, string> = {
//   '5日均线': '#ff7f0e',
//   '10日均线': '#2ca02c',
//   '20日均线': '#d62728',
//   '30日均线': '#9467bd',
//   '60日均线': '#8c564b',
//   '90日均线': '#e377c2',
//   '250日均线': '#17becf',
//   '500日均线': '#7f7f7f',
//   '750日均线': '#7f7f7f',
//   '1000日均线': '#7f7f7f',
//   '1250日均线': '#7f7f7f',
//   '1500日均线': '#7f7f7f',
// };

/**
 * 按 N 日窗口计算简单移动平均线（SMA）
 * 入参：data 为 [{ 日期, 收盘, ... }]，日期升序
 * 返回：在每行上挂 __MA{n}__ 字段，窗口不足时为 null
 */
const computeMovingAverages = (
  data: { 收盘: number; 日期: string }[],
): Record<string, number | null>[] => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const windows = MA_OPTIONS.map((label) => ({
    label,
    n: Number(label.replace(/[^0-9]/g, '')) || 0,
  }));
  return data.map((_row, i) => {
    const enriched: Record<string, number | null> = {};
    windows.forEach(({ label, n }) => {
      const key = MA_FIELD_KEYS[label];
      if (!key) return;
      if (i + 1 < n) {
        enriched[key] = null;
        return;
      }
      let sum = 0;
      for (let k = 0; k < n; k += 1) {
        sum += Number(data[i - k].收盘) || 0;
      }
      enriched[key] = sum / n;
    });
    return enriched;
  });
};

const PriceLineAvgMark: React.FC<RsiFilterMarkProps> = ({ data }) => {
    console.log('1111 均线 data', data);
  const {
    buyPointList,
    mainChartConfig,
  } = useMemo(() => {
    const emptyResult = {
      buyPointList: [] as BuyPointRow[],
      mainChartConfig: {} as Record<string, unknown>,
    };

    if (!data?.length) {
      return emptyResult;
    }

    // 0) 计算 MA_OPTIONS 简单移动平均线，挂在每行上
    const maRows = computeMovingAverages(data);
    const chartData = data.map((row, i) => {
        const mergeData = {
            ...row,
            ...maRows[i],
        }
        return { 
            ...mergeData,
            //  __recommendationLevel__   todo 准确性
        // __recommendationLevel__: (mergeData.收盘 <= mergeData.__MA5__ && mergeData.收盘 <= mergeData.__MA10__ && mergeData.收盘 <= mergeData.__MA20__ && mergeData.收盘 <= mergeData.__MA30__ && mergeData.收盘 >= mergeData.__MA60__ && mergeData.收盘 >= mergeData.__MA90__ && mergeData.收盘 >= mergeData.__MA250__ && mergeData.收盘 >= mergeData.__MA500__ && mergeData.收盘 >= mergeData.__MA750__) ? 1 : null,
        __recommendationLevel__: isNumber(mergeData.__MA1250__) && mergeData.收盘 >= mergeData.__MA1250__ ? 1 : null,

    }
    });


    console.log('1111 均线 maRows', maRows);
    console.log('1111 均线 chartData', chartData);


    // 2) 合并为带推荐级别的图表数据

    // 3) 过滤出推荐买点
    const buyPointList = chartData.filter(
      (row): row is BuyPointRow => row.__recommendationLevel__ != null,
    );

    console.log('1111 均线 buyPointList', buyPointList);

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

    return { buyPointList, mainChartConfig };
  }, [data]);

  if (!data?.length) {
    return <div>暂无数据</div>;
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card
        size="small"
        variant="outlined"
        title="推荐买点"
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

    
    </Space>
  );
};

export default memo(PriceLineAvgMark);
