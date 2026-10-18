import React, { useState } from 'react';
import { CalculatorOutlined, FileExcelOutlined, RiseOutlined } from '@ant-design/icons';

/**
 * 「计算推荐买点 / 导出买入&卖出报告 / 导出买入计划」三按钮 + 规则文案 公共组件
 *
 * 个股 / 指数 / 大宗商品 / 外盘期货 / 基金 各页面统一复用，保证功能入口与 UI 完全一致。
 * 各页面只需把三个动作回调传入即可。
 */

/** hex 颜色转 rgba，用于规则说明条的同色淡底 / 描边 */
const hexToRgba = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
};

/** 规则说明条：统一各功能「文案说明」样式（左侧色条 + 同色淡底 + 图标），便于理解按钮功能口径 */
const RuleNote: React.FC<{ color: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  color,
  icon,
  children,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      margin: 0,
      padding: '6px 12px',
      borderRadius: 6,
      background: `linear-gradient(90deg, ${hexToRgba(color, 0.1)} 0%, ${hexToRgba(color, 0.02)} 100%)`,
      border: `1px solid ${hexToRgba(color, 0.22)}`,
      borderLeft: `3px solid ${color}`,
      boxShadow: `0 1px 3px ${hexToRgba(color, 0.06)}`,
    }}
  >
    <span style={{ color, marginTop: 2, display: 'inline-flex', fontSize: 12 }}>{icon}</span>
    <div style={{ fontSize: 12, color: '#46536b', lineHeight: 1.6 }}>{children}</div>
  </div>
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
  onClick: () => void;
}

/** 操作按钮：渐变胶囊 + hover 抬升 / 按压反馈 */
const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  title,
  subtitle,
  gradient,
  glow,
  iconColor,
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
        gap: 10,
        width: '100%',
        // 固定最小高度：三个按钮等高，配合副标题换行也能保持整齐
        minHeight: 64,
        boxSizing: 'border-box',
        padding: '7px 16px',
        marginBottom: 0,
        background: gradient,
        borderRadius: 20,
        cursor: 'pointer',
        overflow: 'hidden',
        outline: 'none',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
        transform: pressed ? 'scale(0.985)' : hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `0 8px 20px ${glow}, 0 0 0 2px ${glow}`
          : `0 4px 12px ${glow}`,
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
          width: 22,
          height: 22,
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
      <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontWeight: 'bold',
            color: '#fff',
            fontSize: 13,
            letterSpacing: 0.3,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {title}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 0 }}>
          {subtitle}
        </span>
      </span>
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
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '300px minmax(0, 1fr)',
      columnGap: 12,
      rowGap: 10,
      alignItems: 'center',
      marginBottom: 16,
    }}
  >
    <ActionButton
      icon={<CalculatorOutlined />}
      title="计算推荐买点"
      subtitle="启用后将计算RSI指标"
      gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
      glow="rgba(56, 239, 125, 0.45)"
      iconColor="#0f9b8e"
      onClick={onCalculate}
    />
    <RuleNote color="#11998e" icon={<CalculatorOutlined />}>
      <b style={{ color: '#0f9b8e' }}>「计算推荐买点」说明</b>
      ：对当前分组已勾选{itemLabel}按 RSI6 多周期计算，回填 {showWeeklyStrategy ? 4 : 3} 类买点列 ——
      ① <b>推荐买点（定量）</b>：
      {showWeeklyStrategy
        ? '按日 / 周 / 月 / 季 RSI6 阈值组合判定推荐级别；'
        : '按月度 / 季度 RSI6 阈值组合判定推荐级别；'}
      ② <b>推荐买点（百分位）</b>：月 RSI6 与季 RSI6 同时跌破历史分位（★5 ≤3% / ★3 ≤5% / ★1 ≤10%）；
      ③ <b>月RSI6百分位策略</b>：月 RSI6 ≤3% 分位买入，≥90% 分位且盈利时卖出；
      {showWeeklyStrategy && (
        <>
          ④ <b>周RSI6百分位策略</b>：周 RSI6 ≤1% 分位买入，≥90% 分位且盈利时卖出。
        </>
      )}
    </RuleNote>
    <ActionButton
      icon={<FileExcelOutlined />}
      title="导出买入&卖出报告（Excel）"
      subtitle="对勾选导出月&季 RSI6 ★5 买卖配对信号"
      gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      glow="rgba(118, 75, 162, 0.45)"
      iconColor="#5b52d6"
      onClick={onExportReport}
    />
    <RuleNote color="#764ba2" icon={<FileExcelOutlined />}>
      <b style={{ color: '#5b52d6' }}>「导出买入&卖出报告（Excel）」导出规则</b>
      ：对勾选{itemLabel}计算月&季 RSI6 百分位策略，仅导出<b>一一配对</b>的 ★5 买入与卖出
      （已完成买卖配对，买、卖各占一行）；
      <b style={{ color: '#fa8c16' }}>★1 / ★3 不计入</b>，持仓中<b>尚未卖出</b>的 ★5 不导出。
    </RuleNote>
    <ActionButton
      icon={<RiseOutlined />}
      title="导出买入计划（Excel）"
      subtitle="对勾选导出尚未卖出的月&季 RSI6 ★5 买入信号"
      gradient="linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)"
      glow="rgba(250, 140, 22, 0.45)"
      iconColor="#d46b08"
      onClick={onExportPlan}
    />
    <RuleNote color="#fa8c16" icon={<RiseOutlined />}>
      <b style={{ color: '#d46b08' }}>「导出买入计划（Excel）」导出规则</b>
      ：仅导出月&季 RSI6 的
      <b style={{ color: '#d46b08' }}> ★5 买入信号</b>中
      <b>尚未卖出</b>的部分 ——
      即最近一次 <b>★5 配对卖出</b>之后出现的未卖出 ★5 买入；
      <b>同一只{itemLabel}可有多条</b>；更早的已配对买入不再导出。
    </RuleNote>
  </div>
);

export default BuyPointActionGroup;
