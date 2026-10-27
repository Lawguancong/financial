import React, { useMemo, useState } from 'react';
import { DualAxes, Line } from '@ant-design/plots';
import { Card, Col, Empty, Row, Space, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import moment from 'moment';
import type { KLineData } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';

interface DailyReturnAnalysisProps {
  data: KLineData[]; // 至少包含「日期」「收盘」字段的 K 线数据
}

interface DailyReturnRecord {
  date: string;
  close: number;
  changePct: number;
}

interface RankRow extends DailyReturnRecord {
  rank: number;
}

interface BinRow {
  bin: string; // 分箱序号（字符串，作为分类轴 key，保证顺序）
  range: string; // 涨跌幅区间展示文案
  centerLabel: string; // 分箱中心（用于坐标轴刻度）
  count: number; // 实际落在该箱的交易日数
  expected: number; // 按正态分布拟合得到的理论频数
}

// 涨红跌绿（A 股 / 中文习惯）
const UP_COLOR = '#cf1322';
const DOWN_COLOR = '#389e0d';
// 直方图与正态曲线配色
const HIST_FILL = '#91caff';
const HIST_STROKE = '#1677ff';
const NORMAL_COLOR = '#fa541c';

const BIN_COUNT = appConfig.chart.dailyReturn.binCount; // 正态分布直方图分箱数量
const RANK_SIZE = appConfig.chart.dailyReturn.rankSize; // 涨幅榜 / 跌幅榜各取前 N 个交易日

const formatPct = (value: number) => `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}%`;

// 涨幅 / 跌幅榜前 N 次累乘值的高亮文案块样式
const cumulativeNoteStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid rgba(22, 119, 255, 0.25)',
  background: 'linear-gradient(90deg, rgba(22, 119, 255, 0.08) 0%, rgba(22, 119, 255, 0.02) 100%)',
  lineHeight: 2,
  fontSize: 13,
  color: '#46536b',
};

const cumulativeSepStyle: React.CSSProperties = {
  margin: '0 12px',
  color: '#d9d9d9',
};

const cumulativeValueStyle = (color: string): React.CSSProperties => ({
  color,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
});

const rankColumns: TableColumnsType<RankRow> = [
  { title: '排名', dataIndex: 'rank', width: 56, align: 'center' },
  { title: '日期', dataIndex: 'date', width: 120, render: (value: string) => moment(value).format('YYYY/MM/DD') },
  {
    title: '涨跌幅',
    dataIndex: 'changePct',
    align: 'right',
    render: (value: number) => (
      <span
        style={{ color: value >= 0 ? UP_COLOR : DOWN_COLOR, fontVariantNumeric: 'tabular-nums' }}
      >
        {formatPct(value)}
      </span>
    ),
  },
  {
    title: '收盘',
    dataIndex: 'close',
    align: 'right',
    render: (value: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span>,
  },
];

/**
 * 可折叠 Card 组件（默认展开）
 * 折叠状态由组件内部 useState 自管，避免触发父组件重渲染；点击标题栏切换，箭头 0.2s 旋转动画。
 */
interface CollapsibleCardProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  cardStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  defaultOpen = true,
  cardStyle,
  headerStyle,
  bodyStyle,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      size="small"
      variant="outlined"
      style={{ borderRadius: 8, ...cardStyle }}
      styles={{ header: headerStyle, body: bodyStyle }}
      title={
        <div
          onClick={() => setOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
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
      }
    >
      {open ? children : null}
    </Card>
  );
};

const DailyReturnAnalysis: React.FC<DailyReturnAnalysisProps> = ({ data }) => {
  const { records, topGainers, topLosers, cumulativeGain, cumulativeLoss, mean, std, maxChange, minChange, binData } = useMemo(() => {
    const sorted = [...(data || [])]
      .filter((item) => item && Number.isFinite(Number(item.收盘)))
      .sort((a, b) => moment(a.日期).valueOf() - moment(b.日期).valueOf());

    // 逐个交易日计算涨跌幅（相对上一交易日收盘）
    const records: DailyReturnRecord[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = Number(sorted[i - 1].收盘);
      const cur = Number(sorted[i].收盘);
      if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) continue;
      records.push({
        date: sorted[i].日期,
        close: cur,
        changePct: Number((((cur - prev) / prev) * 100).toFixed(4)),
      });
    }

    // 涨幅榜（前 30）/ 跌幅榜（后 30）
    const topGainers: RankRow[] = [...records]
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, RANK_SIZE)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    const topLosers: RankRow[] = [...records]
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, RANK_SIZE)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // 涨幅 / 跌幅榜前 N 次（10/20/30）的累乘收益（复利）：「若只在这些交易日持有」的累计涨跌幅
    const cumulativeReturn = (list: RankRow[], n: number) => {
      const slice = list.slice(0, n);
      if (!slice.length) return 0;
      const product = slice.reduce((acc, item) => acc * (1 + item.changePct / 100), 1);
      return Number(((product - 1) * 100).toFixed(2));
    };
    const cumulativeGain = {
      10: cumulativeReturn(topGainers, 10),
      20: cumulativeReturn(topGainers, 20),
      30: cumulativeReturn(topGainers, 30),
    };
    const cumulativeLoss = {
      10: cumulativeReturn(topLosers, 10),
      20: cumulativeReturn(topLosers, 20),
      30: cumulativeReturn(topLosers, 30),
    };

    // 全样本统计量
    const n = records.length;
    const values = records.map((item) => item.changePct);
    const mean = n ? values.reduce((sum, v) => sum + v, 0) / n : 0;
    const variance = n ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n : 0;
    const std = Math.sqrt(variance);
    const maxChange = n ? Math.max(...values) : 0;
    const minChange = n ? Math.min(...values) : 0;

    // 正态分布直方图分箱 + 拟合曲线（曲线按 n×箱宽×概率密度缩放到「频数」量纲，便于与直方图同轴对比）
    let binData: BinRow[] = [];
    if (n > 1 && std > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const width = (max - min) / BIN_COUNT || 1;
      const counts = new Array<number>(BIN_COUNT).fill(0);
      values.forEach((v) => {
        let idx = Math.floor((v - min) / width);
        if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
        if (idx < 0) idx = 0;
        counts[idx] += 1;
      });
      const normConst = 1 / (std * Math.sqrt(2 * Math.PI));
      binData = counts.map((count, i) => {
        const lo = min + i * width;
        const hi = lo + width;
        const center = lo + width / 2;
        const pdf = normConst * Math.exp(-((center - mean) ** 2) / (2 * std * std));
        return {
          bin: `${i}`,
          range: `${lo.toFixed(2)}% ~ ${hi.toFixed(2)}%`,
          centerLabel: center.toFixed(1),
          count,
          expected: Number((n * width * pdf).toFixed(2)),
        };
      });
    }

    return {
      records,
      topGainers,
      topLosers,
      cumulativeGain,
      cumulativeLoss,
      mean,
      std,
      maxChange,
      minChange,
      binData,
    };
  }, [data]);

  if (!records.length) {
    return <Empty description="暂无足够数据计算日涨跌幅" style={{ margin: '24px 0' }} />;
  }

  const lineData = records.map((item) => ({
    date: moment(item.date).format('YYYY-MM-DD'),
    changePct: item.changePct,
  }));

  const binLabels = binData.map((item) => item.bin);
  // x 轴刻度抽样步长：控制显示的刻度数量（约 10 个）
  const labelStep = Math.max(1, Math.ceil(binData.length / 10));

  const distConfig = {
    height: 360,
    autoFit: true,
    xField: 'bin',
    legend: false,
    axis: {
      x: {
        title: '日涨跌幅(%)',
        labelFormatter: (value: string) => {
          const idx = Number(value);
          return idx % labelStep === 0 ? binData[idx]?.centerLabel ?? '' : '';
        },
      },
    },
    tooltip: {
      items: [
        { field: 'range', name: '区间' },
        { field: 'count', name: '实际频数' },
        { field: 'expected', name: '正态分布(理论频数)', valueFormatter: (v: number) => Number(v).toFixed(1) },
      ],
    },
    children: [
      {
        data: binData,
        type: 'interval' as const,
        yField: 'count',
        scale: { x: { domain: binLabels } },
        style: { fill: HIST_FILL, stroke: HIST_STROKE, lineWidth: 1, maxWidth: 16 },
        axis: {
          y: { title: '频数(交易日数)', style: { titleFill: HIST_STROKE } },
        },
      },
      {
        data: binData,
        type: 'line' as const,
        yField: 'expected',
        shapeField: 'smooth' as const,
        scale: { x: { domain: binLabels }, y: { key: 'dist' } },
        style: { lineWidth: 2, stroke: NORMAL_COLOR },
        axis: false,
      },
    ],
  };

  return (
    <CollapsibleCard
      title="日涨跌幅分析 · 极值交易日 · 正态分布"
      defaultOpen
      cardStyle={{
        marginTop: 16,
        border: '1px solid #bae0ff',
        background: 'linear-gradient(135deg, #f0f8ff 0%, #e6f4ff 100%)',
      }}
      headerStyle={{
        background: 'linear-gradient(90deg, #e6f4ff 0%, #f0f8ff 100%)',
        borderBottom: '1px solid #bae0ff',
      }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>每个交易日的涨跌幅（%）</div>
          <Line
            {...{
              data: lineData,
              xField: 'date',
              yField: 'changePct',
              height: 300,
              autoFit: true,
              axis: {
                x: { title: '日期' },
                y: { title: '涨跌幅(%)' },
              },
              style: { lineWidth: 1, stroke: HIST_STROKE },
              tooltip: {
                items: [
                  {
                    field: 'changePct',
                    name: '涨跌幅',
                    valueFormatter: (value: number) => formatPct(value),
                  },
                ],
              },
            }}
          />
        </div>

        <div>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 8, color: UP_COLOR, fontSize: 13, fontWeight: 600 }}>
                涨幅榜 · 前 {RANK_SIZE} 个交易日
              </div>
              <Table<RankRow>
                rowKey="date"
                size="small"
                columns={rankColumns}
                dataSource={topGainers}
                pagination={false}
                scroll={{ y: 320 }}
              />
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 8, color: DOWN_COLOR, fontSize: 13, fontWeight: 600 }}>
                跌幅榜 · 后 {RANK_SIZE} 个交易日
              </div>
              <Table<RankRow>
                rowKey="date"
                size="small"
                columns={rankColumns}
                dataSource={topLosers}
                pagination={false}
                scroll={{ y: 320 }}
              />
            </Col>
          </Row>
        </div>

        <div style={cumulativeNoteStyle}>
          <div>
            <span style={{ color: UP_COLOR, fontWeight: 600 }}>涨幅前 10 / 20 / 30 次累乘</span>
            <span style={{ color: '#8c8c8c', marginLeft: 8 }}>（复利，仅统计排名靠前的这些交易日）</span>
          </div>
          <div>
            <span>前10次：<b style={cumulativeValueStyle(UP_COLOR)}>{formatPct(cumulativeGain[10])}</b></span>
            <span style={cumulativeSepStyle}>|</span>
            <span>前20次：<b style={cumulativeValueStyle(UP_COLOR)}>{formatPct(cumulativeGain[20])}</b></span>
            <span style={cumulativeSepStyle}>|</span>
            <span>前30次：<b style={cumulativeValueStyle(UP_COLOR)}>{formatPct(cumulativeGain[30])}</b></span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: DOWN_COLOR, fontWeight: 600 }}>跌幅前 10 / 20 / 30 次累乘</span>
            <span style={{ color: '#8c8c8c', marginLeft: 8 }}>（复利，仅统计排名靠后的这些交易日）</span>
          </div>
          <div>
            <span>前10次：<b style={cumulativeValueStyle(DOWN_COLOR)}>{formatPct(cumulativeLoss[10])}</b></span>
            <span style={cumulativeSepStyle}>|</span>
            <span>前20次：<b style={cumulativeValueStyle(DOWN_COLOR)}>{formatPct(cumulativeLoss[20])}</b></span>
            <span style={cumulativeSepStyle}>|</span>
            <span>前30次：<b style={cumulativeValueStyle(DOWN_COLOR)}>{formatPct(cumulativeLoss[30])}</b></span>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>
            所有交易日涨跌幅的正态分布（直方图 + 正态拟合曲线）
          </div>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}>
              <Statistic title="交易日数" value={records.length} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="平均涨跌幅" value={mean.toFixed(3)} suffix="%" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="标准差" value={std.toFixed(3)} suffix="%" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="最大 / 最小单日涨跌幅"
                value={`${formatPct(maxChange)} / ${formatPct(minChange)}`}
                styles={{ content: { fontSize: 16 } }}
              />
            </Col>
          </Row>
          <DualAxes {...distConfig} />
        </div>
      </Space>
    </CollapsibleCard>
  );
};

export default DailyReturnAnalysis;
