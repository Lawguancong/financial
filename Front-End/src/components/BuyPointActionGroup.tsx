import React, { useState } from 'react';
import { Modal, Popover } from 'antd';
import moment from 'moment';
import { CalculatorOutlined, FileExcelOutlined, InfoCircleOutlined, RiseOutlined } from '@ant-design/icons';
import { getSellTrancheCount, getSellTrancheIntervalDays } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';

const {
  asOfWindowMonths: RSI_ASOF_WINDOW_MONTHS,
  minSampleCount: MQ_MIN_SAMPLE_MONTHS,
  sellMinReturnPct: MQ_SELL_MIN_RETURN_PCT,
  monthlyQuarterly: { levelRules: MQ_LEVEL_RULES, sellMinHoldingDays: MQ_SELL_MIN_HOLDING_DAYS },
  singlePeriod: { weekly: WEEKLY_RSI_CONFIG, monthly: MONTHLY_RSI_CONFIG },
} = appConfig.rsi;
const SINGLE_PERIOD_SELL_MIN_RETURN_PCT = appConfig.rsi.sellMinReturnPct;
/** 年化口径分界（天）：持有满该天数按年化收益率判定/展示，不足按区间收益率 */
const RSI_ANNUALIZE_MIN_HOLDING_DAYS = appConfig.rsi.annualizeMinHoldingDays;
const SINGLE_PERIOD_MIN_SAMPLE_COUNT = appConfig.rsi.minSampleCount;
const [MQ_LEVEL_5, MQ_LEVEL_3, MQ_LEVEL_1] = MQ_LEVEL_RULES;
/** 月/季分位相同时展示一个值，不同时展示「月x/季y」 */
const formatMqLevelPct = (rule: { monthlyPercentile: number; quarterlyPercentile: number }): string =>
  rule.monthlyPercentile === rule.quarterlyPercentile
    ? `${rule.monthlyPercentile}%`
    : `月${rule.monthlyPercentile}%/季${rule.quarterlyPercentile}%`;
/** as-of 窗口折算年数（仅用于文案展示，实际口径仍按月数配置） */
const RSI_ASOF_WINDOW_YEARS = RSI_ASOF_WINDOW_MONTHS / 12;


/**
 * 「计算推荐买点 / 导出买入&卖出报告 / 导出买入计划」三按钮 公共组件
 *
 * 三个按钮单行等宽排列；各按钮右侧 info 图标，鼠标悬停（或键盘聚焦）时以浮层展示完整规则文案，
 * 不再常驻占用页面高度。个股 / 指数 / 大宗商品 / 外盘期货 / 基金 各页面统一复用。
 * 各页面只需把三个动作回调传入即可。
 */

/**
 * 操作时间窗口：
 * - 「计算推荐买点」仅周六 / 周日开放（自然日，不区分节假日）
 * - 两个导出仅每月最后 3 个自然日开放（如 31 天月为 29/30/31）
 * 不在窗口内点击时二次确认，确认后照常执行。
 */
const isWeekend = (): boolean => {
  const day = moment().day();
  return day === 0 || day === 6;
};

const isLastThreeDaysOfMonth = (): boolean =>
  moment().date() >= moment().daysInMonth() - 2;

/** 非开放窗口时弹出二次确认 */
const confirmOutOfWindow = (title: string, content: string, onConfirm: () => void) => {
  Modal.confirm({
    title,
    content,
    okText: '继续',
    cancelText: '取消',
    onOk: onConfirm,
  });
};

/** 规则说明浮层：鼠标悬停按钮右侧 info 图标时展示，内容与旧常驻文案一致 */
const RulePopover: React.FC<{
  /** 主色，用于浮层标题与图标 */
  color: string;
  icon: React.ReactNode;
  /** 浮层标题 */
  heading: string;
  children: React.ReactNode;
}> = ({ color, icon, heading, children }) => (
  <Popover
    trigger={['hover', 'focus']}
    placement="top"
    mouseEnterDelay={0.15}
    arrow
    styles={{
      root: { maxWidth: 520 },
      content: { padding: '10px 12px' },
    }}
    content={
      <div style={{ maxWidth: 470, maxHeight: 420, overflowY: 'auto', fontSize: 12, color: '#46536b', lineHeight: 1.75 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', fontSize: 12 }}>{icon}</span>
          {heading}
        </div>
        {children}
      </div>
    }
  >
    <span
      role="button"
      tabIndex={0}
      aria-label="查看功能说明"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      style={{
        flex: '0 0 auto',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.9)',
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        cursor: 'help',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}
    >
      <InfoCircleOutlined />
    </span>
  </Popover>
);

interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** 按钮渐变背景 */
  gradient: string;
  /** 主色调（用于阴影 / 光晕） */
  glow: string;
  /** 图标颜色 */
  iconColor: string;
  /** 悬停右侧 info 图标时展示的规则说明 */
  tip: React.ReactNode;
  /** 规则说明浮层标题 */
  tipHeading: string;
  onClick: () => void;
}

/** 操作按钮：紧凑渐变胶囊（单行三段式）+ hover 抬升 / 按压反馈 + info 图标规则浮层 */
const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  title,
  subtitle,
  gradient,
  glow,
  iconColor,
  tip,
  tipHeading,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        // 三个按钮等高，标题/副标题各占一行且超出省略，保证单行高度稳定
        height: 56,
        boxSizing: 'border-box',
        padding: '8px 12px',
        marginBottom: 0,
        background: gradient,
        borderRadius: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        outline: 'none',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
        transform: pressed ? 'scale(0.985)' : hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `0 8px 18px ${glow}, 0 0 0 2px ${glow}`
          : `0 3px 10px ${glow}`,
      }}
    >
      {/* hover 时高光扫过 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 70%)',
          transform: hovered ? 'translateX(110%)' : 'translateX(-110%)',
          transition: 'transform 0.7s ease',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          flex: '0 0 auto',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          transition: 'transform 0.3s ease',
          transform: hovered ? 'rotate(-8deg) scale(1.06)' : 'none',
          boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
        }}
      >
        {icon}
      </span>
      <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
        <span
          style={{
            fontWeight: 'bold',
            color: '#fff',
            fontSize: 13,
            letterSpacing: 0.3,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={title}
        >
          {title}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,0.86)',
            fontSize: 11,
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={subtitle}
        >
          {subtitle}
        </span>
      </span>
      <RulePopover color={iconColor} icon={icon} heading={tipHeading}>
        {tip}
      </RulePopover>
    </div>
  );
};

export interface BuyPointActionGroupProps {
  /** 计算推荐买点（定量 + 月&季百分位 + 月/周 RSI6 百分位策略） */
  onCalculate: () => void;
  /** 导出「买入&卖出报告」Excel */
  onExportReport: () => void;
  /** 导出「买入计划」Excel */
  onExportPlan: () => void;
  /** 标的名词，用于规则文案（默认「股票」） */
  itemLabel?: string;
  /** 是否包含「周 RSI6 百分位策略」说明（基金无周线数据，传 false） */
  showWeeklyStrategy?: boolean;
}

/**
 * 三个操作按钮 + 各自规则文案：左列按钮、右列说明，三组上下对齐。
 * 文案与 UI 与个股页保持一致。
 */
export const BuyPointActionGroup: React.FC<BuyPointActionGroupProps> = ({
  onCalculate,
  onExportReport,
  onExportPlan,
  itemLabel = '股票',
  showWeeklyStrategy = true,
}) => {
  // 月&季 RSI6 ★5 分批卖出配置（文案随常量自动同步）
  const sellTrancheCount = getSellTrancheCount();
  const sellTrancheIntervalDays = getSellTrancheIntervalDays();
  // 计算入口：周末直接执行，非周末二次确认
  const handleCalculate = () => {
    if (isWeekend()) {
      onCalculate();
      return;
    }
    confirmOutOfWindow(
      '非周末时间',
      '「计算推荐买点」仅在周六、周日开放。当前不是周末，是否仍要继续计算？',
      onCalculate,
    );
  };

  // 导出入口：每月最后 3 个自然日直接执行，否则二次确认
  const handleExport = (action: () => void, functionName: string) => {
    if (isLastThreeDaysOfMonth()) {
      action();
      return;
    }
    confirmOutOfWindow(
      '非月底时间',
      `当前不在每月最后 3 个自然日，${functionName}仅在月底窗口开放。是否仍要继续导出？`,
      action,
    );
  };

  return (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      columnGap: 12,
      marginBottom: 12,
    }}
  >
    <ActionButton
      icon={<CalculatorOutlined />}
      title="计算推荐买点"
      subtitle="启用后将计算RSI指标"
      gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
      glow="rgba(56, 239, 125, 0.45)"
      iconColor="#0f9b8e"
      tipHeading="「计算推荐买点」说明"
      tip={
        <>
          对当前分组已勾选{itemLabel}按 RSI6 多周期计算，回填 {showWeeklyStrategy ? 4 : 3} 类买点列 ——
          <br />
          <b>RSI6 口径</b>：标准 Wilder 平滑（Wilder RSI），与 TA-Lib、通达信等行情软件一致。
          <br />
          ① <b>推荐买点（定量）</b>：
          {showWeeklyStrategy
            ? '按日 / 周 / 月 / 季 RSI6 阈值组合判定推荐级别；'
            : '按月度 / 季度 RSI6 阈值组合判定推荐级别；'}
          ② <b>推荐买点（百分位）</b>：月 RSI6 与季 RSI6 同时跌破「截至当月、近 {RSI_ASOF_WINDOW_MONTHS} 个月（约 {RSI_ASOF_WINDOW_YEARS} 年）」的 as-of 滚动分位（★5 ≤{formatMqLevelPct(MQ_LEVEL_5)} / ★3 ≤{formatMqLevelPct(MQ_LEVEL_3)} / ★1 ≤{formatMqLevelPct(MQ_LEVEL_1)}，只用当月及之前 {RSI_ASOF_WINDOW_YEARS} 年内的样本计算；历史不足 {RSI_ASOF_WINDOW_YEARS} 年但满 {MQ_MIN_SAMPLE_MONTHS} 个月时使用全部历史；月/季样本均满 {MQ_MIN_SAMPLE_MONTHS} 个月后才产生信号）；
          ③ <b>月RSI6百分位策略</b>：月 RSI6 跌破「截至当月、近 {RSI_ASOF_WINDOW_YEARS} 年」的滚动 {MONTHLY_RSI_CONFIG.buyPercentile}% 分位买入，≥{MONTHLY_RSI_CONFIG.sellPercentile}% 分位且收益率达门槛时卖出（满 {SINGLE_PERIOD_MIN_SAMPLE_COUNT} 个有效样本后才产生信号，历史不足 {RSI_ASOF_WINDOW_YEARS} 年时使用全部历史）；
          {showWeeklyStrategy && (
            <>
              ④ <b>周RSI6百分位策略</b>：周 RSI6 跌破「截至当周、近 {RSI_ASOF_WINDOW_YEARS} 年」的滚动 {WEEKLY_RSI_CONFIG.buyPercentile}% 分位买入，≥{WEEKLY_RSI_CONFIG.sellPercentile}% 分位且收益率达门槛时卖出（满 {SINGLE_PERIOD_MIN_SAMPLE_COUNT} 个有效样本后才产生信号，历史不足 {RSI_ASOF_WINDOW_YEARS} 年时使用全部历史）。
            </>
          )}
          <br />
          卖出收益率门槛：持有满 <b>{RSI_ANNUALIZE_MIN_HOLDING_DAYS}</b> 天按<b>年化收益率</b>判定、不足则按<b>区间收益率</b>判定 —— 月&季共振 ≥{MQ_SELL_MIN_RETURN_PCT}%、周/月单周期 ≥{SINGLE_PERIOD_SELL_MIN_RETURN_PCT}%；未达门槛不卖出、继续持有等待下一次信号（阈值可配置）。
          其中<b>月&季共振 ★5 配对的卖出还须持有满 {MQ_SELL_MIN_HOLDING_DAYS} 天</b>（约 1 年，可配置），未满则同样继续持有。
          <br />
          时间窗口：建议仅在<b>周六、周日</b>点击计算；非周末点击会二次确认，确认后照常计算。
        </>
      }
      onClick={handleCalculate}
    />
    <ActionButton
      icon={<FileExcelOutlined />}
      title="导出买入&卖出报告（Excel）"
      subtitle="对勾选导出月&季 RSI6 ★5 买卖配对信号"
      gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      glow="rgba(118, 75, 162, 0.45)"
      iconColor="#5b52d6"
      tipHeading="「导出买入&卖出报告（Excel）」导出规则"
      tip={
        <>
          对勾选{itemLabel}计算月&季 RSI6 百分位策略，仅导出<b>一一配对</b>的 ★5 买入与卖出
          （已完成买卖配对，买、卖各占一行）；
          <b style={{ color: '#fa8c16' }}>★1 / ★3 不计入</b>，持仓中<b>尚未卖出</b>的 ★5 不导出。
          <br />
          卖出需同时满足：持有满 <b style={{ color: '#5b52d6' }}>{MQ_SELL_MIN_HOLDING_DAYS} 天</b>（约 1 年，可配置）
          且收益率达门槛（满该天数后按年化收益率 ≥{MQ_SELL_MIN_RETURN_PCT}%，可配置）才配对卖出；
          任一条件不满足则继续持有、等待下一个同时满足的信号。
          <br />
          <b style={{ color: '#5b52d6' }}>★5 分批卖出</b>：
          {sellTrancheCount > 1
            ? `信号成立后分 ${sellTrancheCount} 批卖出（第 1 批为信号当日，之后每 ${sellTrancheIntervalDays} 天一批，目标日非交易日顺延至下一交易日收盘）；各批分别按「本批卖出价 vs 买入价」计算收益率，取算术平均作为「平均收益率」，并动态生成「第N批卖出收益率（T+X天）」列；后续行情未到的批次显示 '-'`
            : '当前配置为 1 批，即一次性清仓（仅「平均收益率」列）'}
          。持有天数与年化收益率仍按首笔卖出信号日计算。
          <br />
          另含「<b style={{ color: '#5b52d6' }}>当前价格</b>」列（表头带最新交易日，如「当前2026-10-16价格」）=
          该标的最新交易日<b>收盘价</b>，便于与买入/卖出价对照。
          <br />
          底部依次为「平均值 / 中位数 / 样本方差 / 样本标准差 / 总体方差 / 总体标准差」统计行：
          <b style={{ color: '#5b52d6' }}>方差</b>衡量各笔收益率偏离平均值的离散程度，
          <b style={{ color: '#5b52d6' }}>标准差</b>为其算术平方根、与收益率同为百分比量纲；
          两者越大说明波动越大、结果越不稳定。样本方差/标准差按 n−1、总体方差/标准差按 n 计算
          （样本量不足 2 时样本口径留空）。
          <br />
          时间窗口：建议仅在<b>每月最后 3 个自然日</b>导出；非月底点击会二次确认，确认后照常导出。
        </>
      }
      onClick={() => handleExport(onExportReport, '「导出买入&卖出报告（Excel）」')}
    />
    <ActionButton
      icon={<RiseOutlined />}
      title="导出买入计划（Excel）"
      subtitle="对勾选导出尚未卖出的月&季 RSI6 ★5 买入信号"
      gradient="linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)"
      glow="rgba(250, 140, 22, 0.45)"
      iconColor="#d46b08"
      tipHeading="「导出买入计划（Excel）」导出规则"
      tip={
        <>
          仅导出月&季 RSI6 的
          <b style={{ color: '#d46b08' }}> ★5 买入信号</b>中
          <b>尚未卖出</b>的部分 ——
          即最近一次 <b>★5 配对卖出</b>之后出现的未卖出 ★5 买入；
          <b>同一只{itemLabel}可有多条</b>；更早的已配对买入不再导出。
          <br />
          其中「配对卖出」需持有满 <b style={{ color: '#d46b08' }}>{MQ_SELL_MIN_HOLDING_DAYS} 天</b>（约 1 年，可配置）
          且收益率达门槛（满该天数后按年化收益率 ≥{MQ_SELL_MIN_RETURN_PCT}%，可配置）才算卖出；
          未满足则视为仍持仓、继续持有等待下一个满足条件的信号。
          <br />
          持仓中信号另给「持有天数」= 买入日至<b>最新交易日</b>、「<b style={{ color: '#d46b08' }}>持有至今收益率</b>」=
          最新交易日价格相对买入价的涨跌幅（<b>可正可负</b>，尚未卖出、非已实现收益）、
          「<b style={{ color: '#d46b08' }}>持有至今年化收益率</b>」= 持有满 {RSI_ANNUALIZE_MIN_HOLDING_DAYS} 天按
          <b>持有时间 + 区间收益率</b>复利年化，不足则直接取区间收益率（同样<b>可正可负</b>）；另含「当前价格」列（最新交易日收盘价，表头带日期）。
          <br />
          底部同样附「平均值 / 中位数 / 样本方差 / 样本标准差 / 总体方差 / 总体标准差」统计行：
          方差衡量各笔收益的离散程度，标准差为其算术平方根（百分比量纲），越大说明波动越大。
          <br />
          时间窗口：建议仅在<b>每月最后 3 个自然日</b>导出；非月底点击会二次确认，确认后照常导出。
        </>
      }
      onClick={() => handleExport(onExportPlan, '「导出买入计划（Excel）」')}
    />
  </div>
  );
};

export default BuyPointActionGroup;
