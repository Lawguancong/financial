import type { ReactNode } from 'react';
import { Alert, Card, Col, Collapse, Divider, Rate, Row, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  BarChartOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

/** 适合使用的品种特征 */
interface FeatureRow {
  key: string;
  feature: string;
  reason: string;
}

/** RSI6 指标周期 */
interface PeriodRow {
  key: string;
  period: string;
  span: string;
  oversold: string;
  scene: string;
  desc: string;
  color: string;
}

/** 具体适合的标的类型 */
interface AssetType {
  key: string;
  name: string;
  icon: string;
  examples: string;
  reason: string;
  noteLabel: string;
  note: string;
}

/** 不适合使用的品种 */
interface UnsuitableRow {
  key: string;
  type: string;
  reason: string;
}

/** 判定清单 */
interface ChecklistRow {
  key: string;
  item: string;
  meaning: string;
  impact: 'suitable' | 'unsuitable';
}

/** 使用技巧 */
interface TipItem {
  title: string;
  desc: string;
}

/** 常见误区 */
interface Misconception {
  key: string;
  question: string;
  answer: string;
}

/** 适合度汇总 */
interface RatingRow {
  key: string;
  stars: number;
  items: string;
  color: string;
}

const PERIODS: PeriodRow[] = [
  {
    key: '1',
    period: '日线 RSI6',
    span: '6 个交易日',
    oversold: '< 20',
    scene: '短线 / 波段',
    desc: '最灵敏，信号频繁但噪音大，适合捕捉急跌反弹，需快进快出并严格止损。',
    color: '#2f54eb',
  },
  {
    key: '2',
    period: '周线 RSI6',
    span: '6 个交易周',
    oversold: '< 25',
    scene: '中线',
    desc: '过滤日内噪音，信号更可靠，< 25 常对应中期回调的低点区域。',
    color: '#722ed1',
  },
  {
    key: '3',
    period: '月线 RSI6',
    span: '6 个交易月',
    oversold: '< 30',
    scene: '长线布局',
    desc: '半年维度，信号稀少但胜率更高，多对应大级别底部区域。',
    color: '#13c2c2',
  },
  {
    key: '4',
    period: '季线 RSI6',
    span: '6 个季度',
    oversold: '< 30',
    scene: '战略配置',
    desc: '约 1.5 年维度，极难触发，一旦出现多为历史级别的机会。',
    color: '#fa8c16',
  },
];

const FEATURES: FeatureRow[] = [
  { key: '1', feature: '高流动性', reason: '买卖价差小，超卖后反弹容易成交' },
  { key: '2', feature: '波动性较大', reason: 'RSI6 容易进入超卖区，信号频繁且有效' },
  { key: '3', feature: '趋势性较强', reason: '在上升趋势中，超卖往往是回调买点' },
  { key: '4', feature: '有基本面支撑', reason: '避免因基本面恶化导致“超卖再超卖”' },
  { key: '5', feature: '市场关注度高', reason: '情绪化抛售后容易修复' },
];

const ASSET_TYPES: AssetType[] = [
  {
    key: '1',
    name: '宽基指数 / 指数 ETF',
    icon: '📈',
    examples: '沪深300、中证500、创业板指、科创50、恒生指数、纳斯达克100',
    reason: '指数不会退市，流动性极好，急跌后常有均值回归。RSI6 < 20 常出现在恐慌性抛售末端。',
    noteLabel: '用法',
    note: '在上升趋势中，RSI6 < 25 可分批买入；若趋势走坏，需等待企稳。',
  },
  {
    key: '2',
    name: '行业 ETF / 主题 ETF',
    icon: '🏭',
    examples: '券商ETF、半导体ETF、新能源ETF、医药ETF、军工ETF',
    reason: '行业轮动明显，短期超卖后容易反弹，且不会个股暴雷。',
    noteLabel: '注意',
    note: '需选择处于长期逻辑向上的行业。',
  },
  {
    key: '3',
    name: '高波动优质个股',
    icon: '🏆',
    examples: '各行业龙头，如宁德时代、比亚迪、贵州茅台、腾讯、美团',
    reason: '流动性好，机构关注度高，短期超卖后容易吸引资金回流。',
    noteLabel: '筛选',
    note: '市值 > 200 亿，日均成交额 > 5 亿，基本面稳健。',
  },
];

const UNSUITABLE: UnsuitableRow[] = [
  { key: '1', type: '低波动大盘股、低波红利', reason: 'RSI6 很少进入超卖，信号少且弱' },
  { key: '2', type: '流动性差的个股', reason: '买卖困难，超卖后可能继续阴跌' },
  { key: '3', type: '基本面恶化的公司', reason: '超卖可能持续，越买越亏' },
  { key: '4', type: '退市风险股 / ST 股', reason: '风险极高，不适合技术指标抄底' },
  { key: '5', type: '长期下跌趋势的品种', reason: '超卖后反弹无力，容易二次探底' },
  { key: '6', type: '连板 / 妖股 / 强题材炒作股', reason: '情绪与资金主导，RSI 严重钝化，指标失效' },
  { key: '7', type: '有强事件驱动的品种', reason: '如临期期权、转债强赎，价格由条款与事件主导' },
];

const CHECKLIST: ChecklistRow[] = [
  { key: '1', item: '是否处于明确的长期下跌趋势', meaning: '趋势向下时超卖会反复出现，越跌信号越假', impact: 'unsuitable' },
  { key: '2', item: '市值是否偏小且成交低迷', meaning: '样本集中、易被操纵，指标参考价值低', impact: 'unsuitable' },
  { key: '3', item: '近期是否出现连板或暴涨暴跌', meaning: '情绪与资金主导，RSI 容易钝化', impact: 'unsuitable' },
  { key: '4', item: '是否存在基本面利空 / 退市风险', meaning: '基本面崩塌，技术指标失效', impact: 'unsuitable' },
  { key: '5', item: '是否属于宽基指数或大市值蓝筹', meaning: '成分分散、流动性好，均值回归更有效', impact: 'suitable' },
  { key: '6', item: '价格是否位于长期均线上方', meaning: '趋势向上时超卖反弹胜率更高', impact: 'suitable' },
];

const TIPS: TipItem[] = [
  { title: '结合趋势', desc: '只在上升趋势或震荡市中使用，下降趋势中慎用。' },
  { title: '多指标共振', desc: '配合 MACD 底背离、成交量放大、支撑位等确认。' },
  { title: '分批建仓', desc: 'RSI6 < 20 先买一部分，< 15 再买，避免一次性抄底。' },
  { title: '设置止损', desc: '跌破前低，或 RSI6 持续低于 20 且无反弹，应止损。' },
  { title: '周期选择', desc: '日线 RSI6 适合短线，周线适合中线，月线 / 季线适合长线战略布局。' },
  { title: '顺势而为', desc: '价格在 250 日均线上方时，超卖反弹胜率显著更高。' },
];

const MISCONCEPTIONS: Misconception[] = [
  {
    key: '1',
    question: '误区一：超卖就等于见底',
    answer:
      '超卖只说明“跌得比较急”，并不代表已经跌到位。真正的底部还需要量能、支撑位与基本面的配合确认。',
  },
  {
    key: '2',
    question: '误区二：RSI6 越低越应该买',
    answer:
      '在趋势性下跌中 RSI6 可以长期低于 10。数值低不是买入理由，趋势与基本面才是前提。',
  },
  {
    key: '3',
    question: '误区三：所有标的都适用',
    answer:
      '均值回归只在“会被拉回”的标的上成立。小盘妖股、退市风险股、单边趋势品种都不适用。',
  },
  {
    key: '4',
    question: '误区四：只看 RSI6 一个指标',
    answer:
      '应结合趋势（均线）、量能、支撑位与基本面共同判断。单一指标容易给出假信号。',
  },
];

const RATINGS: RatingRow[] = [
  { key: '1', stars: 5, items: '宽基指数 ETF、主流行业 ETF、优质龙头股、可转债', color: '#52c41a' },
  { key: '2', stars: 4, items: '高波动', color: '#73d13d' },
  { key: '3', stars: 3, items: '小盘题材股', color: '#faad14' },
  { key: '4', stars: 2, items: '低波动股', color: '#fa8c16' },
  { key: '5', stars: 1, items: 'ST 股、退市风险股、流动性极差个股', color: '#ff4d4f' },
];

const periodColumns: TableColumnsType<PeriodRow> = [
  {
    title: '周期',
    dataIndex: 'period',
    key: 'period',
    width: '16%',
    render: (value: string, record) => <Text strong style={{ color: record.color }}>{value}</Text>,
  },
  { title: '对应时长', dataIndex: 'span', key: 'span', width: '16%' },
  {
    title: '超卖参考',
    dataIndex: 'oversold',
    key: 'oversold',
    width: '14%',
    render: (value: string) => <Tag color="error">{value}</Tag>,
  },
  {
    title: '适用场景',
    dataIndex: 'scene',
    key: 'scene',
    width: '16%',
    render: (value: string) => <Tag color="processing">{value}</Tag>,
  },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
];

const featureColumns: TableColumnsType<FeatureRow> = [
  {
    title: '特征',
    dataIndex: 'feature',
    key: 'feature',
    width: '32%',
    render: (value: string) => (
      <Space size={8}>
        <CheckCircleFilled style={{ color: '#52c41a' }} />
        <Text strong>{value}</Text>
      </Space>
    ),
  },
  { title: '原因', dataIndex: 'reason', key: 'reason' },
];

const unsuitableColumns: TableColumnsType<UnsuitableRow> = [
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '32%',
    render: (value: string) => (
      <Space size={8}>
        <CloseCircleFilled style={{ color: '#ff4d4f' }} />
        <Text strong>{value}</Text>
      </Space>
    ),
  },
  { title: '原因', dataIndex: 'reason', key: 'reason' },
];

const checklistColumns: TableColumnsType<ChecklistRow> = [
  {
    title: '判定项',
    dataIndex: 'item',
    key: 'item',
    width: '38%',
    render: (value: string) => <Text strong>{value}</Text>,
  },
  {
    title: '命中含义',
    dataIndex: 'meaning',
    key: 'meaning',
  },
  {
    title: '倾向',
    dataIndex: 'impact',
    key: 'impact',
    width: 130,
    render: (impact: ChecklistRow['impact']) =>
      impact === 'suitable' ? <Tag color="success">更适合</Tag> : <Tag color="error">需回避</Tag>,
  },
];

const ratingColumns: TableColumnsType<RatingRow> = [
  {
    title: '适合度',
    dataIndex: 'stars',
    key: 'stars',
    width: 190,
    render: (stars: number) => <Rate disabled count={5} value={stars} style={{ fontSize: 16 }} />,
  },
  {
    title: '品种',
    dataIndex: 'items',
    key: 'items',
    render: (value: string, record) => <Text style={{ color: record.color }}>{value}</Text>,
  },
];

const SectionTitle = ({ icon, title, desc }: { icon: ReactNode; title: string; desc?: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
    <div
      style={{
        flex: '0 0 auto',
        width: 4,
        height: 38,
        borderRadius: 4,
        background: 'linear-gradient(180deg, #2f54eb 0%, #722ed1 100%)',
      }}
    />
    <div>
      <Title level={4} style={{ margin: 0 }}>
        <Space size={8}>
          {icon}
          {title}
        </Space>
      </Title>
      {desc ? (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {desc}
        </Text>
      ) : null}
    </div>
  </div>
);

const AssetTypeCard = ({ item }: { item: AssetType }) => (
  <Card
    variant="borderless"
    hoverable
    style={{ height: '100%', borderTop: '3px solid #2f54eb', background: '#fbfcff' }}
    styles={{ body: { padding: 20 } }}
  >
    <Space align="center" size={10} style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 22 }}>{item.icon}</span>
      <Title level={5} style={{ margin: 0 }}>
        {item.name}
      </Title>
    </Space>
    <div style={{ marginBottom: 10 }}>
      <Tag color="processing" style={{ marginBottom: 6 }}>
        代表
      </Tag>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
        {item.examples}
      </Paragraph>
    </div>
    <div style={{ marginBottom: 10 }}>
      <Tag color="blue" style={{ marginBottom: 6 }}>
        理由
      </Tag>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
        {item.reason}
      </Paragraph>
    </div>
    <div>
      <Tag color="gold" style={{ marginBottom: 6 }}>
        {item.noteLabel}
      </Tag>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
        {item.note}
      </Paragraph>
    </div>
  </Card>
);

const RsiKnowledgePage = () => {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      {/* Hero */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          padding: '36px 40px',
          color: '#fff',
          background: 'linear-gradient(135deg, #1d39c4 0%, #2f54eb 42%, #722ed1 100%)',
          boxShadow: '0 12px 32px rgba(47, 84, 235, 0.25)',
        }}
      >
        <Tag color="rgba(255,255,255,0.22)" style={{ color: '#fff', border: 'none', marginBottom: 16 }}>
          量化基础知识
        </Tag>
        <Title level={2} style={{ color: '#fff', margin: 0 }}>
          RSI6 超卖指标适用指南
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, margin: '12px 0 20px', maxWidth: 760 }}>
          RSI6（6 日相对强弱指标）属于短期超卖指标，对价格变化非常敏感，适合捕捉急跌后的反弹机会。
          但它并非万能：只有会“均值回归”的标的才适合，趋势与情绪主导的标的上，超卖信号往往会持续失效。
          本文帮你快速分清——哪些品种适合，哪些应该回避。
        </Paragraph>
        <Space size={8} wrap>
          <Tag color="rgba(255,255,255,0.16)" style={{ color: '#fff', border: 'none' }}>
            均值回归
          </Tag>
          <Tag color="rgba(255,255,255,0.16)" style={{ color: '#fff', border: 'none' }}>
            短线超跌
          </Tag>
          <Tag color="rgba(255,255,255,0.16)" style={{ color: '#fff', border: 'none' }}>
            需配合趋势与止损
          </Tag>
        </Space>
      </div>

      {/* 速览 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {[
          { label: '指标周期', value: '6', hint: '日线/周线/月线/季线', icon: <ThunderboltOutlined /> },
          { label: '超卖参考', value: '< 20', hint: 'RSI6 常用阈值', icon: <LineChartOutlined /> },
          { label: '超买参考', value: '> 80', hint: '周期越短阈值越极端', icon: <BarChartOutlined /> },
          { label: '核心前提', value: '长生不老，长期上涨', hint: '均值回归', icon: <SafetyCertificateOutlined /> },
        ].map((item) => (
          <Col xs={24} sm={12} md={6} key={item.label}>
            <Card variant="borderless" style={{ background: '#f7f8fc', height: '100%' }}>
              <Space orientation="vertical" size={2}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <Space size={6}>
                    {item.icon}
                    {item.label}
                  </Space>
                </Text>
                <Title level={3} style={{ margin: 0, color: '#2f54eb' }}>
                  {item.value}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.hint}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* RSI6 指标周期 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<LineChartOutlined style={{ color: '#2f54eb' }} />}
          title="RSI6 指标周期"
          desc="RSI6 可应用于不同 K 线周期：周期越长，信号越少但越可靠，适合更长的持有级别。"
        />
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {PERIODS.map((item) => (
            <Col xs={12} sm={6} key={item.key}>
              <Card
                variant="borderless"
                style={{ background: '#f7f8fc', height: '100%', textAlign: 'center' }}
                styles={{ body: { padding: 16 } }}
              >
                <Text strong style={{ color: item.color, fontSize: 15 }}>
                  {item.period}
                </Text>
                <Title level={4} style={{ margin: '6px 0 2px' }}>
                  {item.span}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  超卖参考 {item.oversold}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
        <Table
          rowKey="key"
          columns={periodColumns}
          dataSource={PERIODS}
          pagination={false}
          size="middle"
        />
      </div>

      {/* 适合使用的品种特征 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<BulbOutlined style={{ color: '#2f54eb' }} />}
          title="适合使用 RSI6 超卖的品种特征"
          desc="具备以下特征越多，超卖信号的均值回归越有效。"
        />
        <Table
          rowKey="key"
          columns={featureColumns}
          dataSource={FEATURES}
          pagination={false}
          size="middle"
        />
      </div>

      {/* 具体适合的标的类型 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
          title="具体适合的标的类型"
          desc="六大类适合使用 RSI6 超卖信号的品种，附代表标的、理由与使用要点。"
        />
        <Row gutter={[16, 16]}>
          {ASSET_TYPES.map((item) => (
            <Col xs={24} sm={12} lg={8} key={item.key}>
              <AssetTypeCard item={item} />
            </Col>
          ))}
        </Row>
      </div>

      {/* 不适合的品种 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<CloseCircleFilled style={{ color: '#ff4d4f' }} />}
          title="不适合使用 RSI6 超卖的品种"
          desc="这些品种上超卖信号容易失效，盲目抄底风险高。"
        />
        <Table
          rowKey="key"
          columns={unsuitableColumns}
          dataSource={UNSUITABLE}
          pagination={false}
          size="middle"
        />
      </div>

      {/* 判定清单 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<ExperimentOutlined style={{ color: '#2f54eb' }} />}
          title="快速判定清单"
          desc="逐条自查，命中“需回避”越多，越不适合用 RSI6 超卖抄底。"
        />
        <Table
          rowKey="key"
          columns={checklistColumns}
          dataSource={CHECKLIST}
          pagination={false}
          size="middle"
        />
      </div>

      {/* 使用技巧 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
          title="使用 RSI6 超卖的关键技巧"
          desc="把指标放进一套可执行的流程里，胜率才会稳定。"
        />
        <Row gutter={[16, 16]}>
          {TIPS.map((tip, index) => (
            <Col xs={24} sm={12} md={8} key={tip.title}>
              <Card
                variant="borderless"
                style={{ background: '#f7f8fc', height: '100%', transition: 'transform 0.2s, box-shadow 0.2s' }}
                styles={{ body: { padding: 18 } }}
                hoverable
              >
                <Tag color="processing" style={{ marginBottom: 10 }}>
                  要点 {index + 1}
                </Tag>
                <Title level={5} style={{ marginTop: 0 }}>
                  {tip.title}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {tip.desc}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 常见误区 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<WarningOutlined style={{ color: '#faad14' }} />}
          title="常见误区"
          desc="这四句话，几乎每个新手都踩过。"
        />
        <Collapse
          accordion
          defaultActiveKey={['1']}
          items={MISCONCEPTIONS.map((item) => ({
            key: item.key,
            label: <Text strong>{item.question}</Text>,
            children: <Paragraph style={{ margin: 0 }}>{item.answer}</Paragraph>,
          }))}
        />
      </div>

      {/* 适合度总结 */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle
          icon={<StarFilled style={{ color: '#faad14' }} />}
          title="适合度总结"
          desc="按品种对 RSI6 超卖信号的适配程度排序，星级越高越适合。"
        />
        <Table
          rowKey="key"
          columns={ratingColumns}
          dataSource={RATINGS}
          pagination={false}
          size="middle"
        />
        <Alert
          style={{ marginTop: 16 }}
          type="success"
          showIcon
          title="一句话总结"
          description="RSI6 超卖最适合流动性好、波动大、有基本面支撑的指数、ETF 和行业龙头；不适合垃圾股和长期下跌的品种。使用时务必结合趋势和止损。"
        />
      </div>

      <Divider style={{ marginTop: 36 }} />

      <Alert
        type="info"
        showIcon
        title="免责声明"
        description="本文为量化基础知识科普，仅用于学习与研究，不构成任何投资建议。指标需结合自身策略与风险承受能力使用。"
      />
    </div>
  );
};

export default RsiKnowledgePage;
