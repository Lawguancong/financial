import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FundOutlined,
  BankOutlined,
  StockOutlined,
  ApartmentOutlined,
  GlobalOutlined,
  ReadOutlined,
  CodeOutlined,
  FireOutlined,
  DashboardOutlined,
  GoldOutlined,
  PercentageOutlined,
  BarChartOutlined,
  RocketOutlined,
  AimOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

/* ------------------------------- 数据配置 ------------------------------- */

interface ModuleItem {
  title: string;
  desc: string;
  path: string;
  icon: ReactNode;
  gradient: string;
  glow: string;
}

/** 主要功能宫格（路径与 menuConfig 保持一致） */
const MODULES: ModuleItem[] = [
  {
    title: '基金列表',
    desc: '开放式 / 场内 / 指数基金，自选池与推荐买点',
    path: '/fund/cn/open',
    icon: <FundOutlined />,
    gradient: 'linear-gradient(135deg, #4f8cff 0%, #1d5cff 100%)',
    glow: 'rgba(79,140,255,.45)',
  },
  {
    title: 'A股个股',
    desc: '沪深京行情、自选股与 RSI 量化信号',
    path: '/stock/a/stock',
    icon: <StockOutlined />,
    gradient: 'linear-gradient(135deg, #ff7875 0%, #f5222d 100%)',
    glow: 'rgba(245,34,45,.4)',
  },
  {
    title: 'A股指数',
    desc: '主要指数行情、成长 vs 价值与买点',
    path: '/stock/a/index',
    icon: <BarChartOutlined />,
    gradient: 'linear-gradient(135deg, #ff9c6e 0%, #fa541c 100%)',
    glow: 'rgba(250,84,28,.4)',
  },
  {
    title: '宏观经济',
    desc: '业绩报表与宏观指标全景监控',
    path: '/stock/a/macro',
    icon: <BankOutlined />,
    gradient: 'linear-gradient(135deg, #b37feb 0%, #722ed1 100%)',
    glow: 'rgba(114,46,209,.4)',
  },
  {
    title: '市场温度',
    desc: 'A 股市场情绪与估值温度',
    path: '/stock/a/market-temp',
    icon: <FireOutlined />,
    gradient: 'linear-gradient(135deg, #ffc53d 0%, #fa8c16 100%)',
    glow: 'rgba(250,140,22,.45)',
  },
  {
    title: '估值数据',
    desc: 'PE / PB 历史分位与估值中枢',
    path: '/stock/a/valuation',
    icon: <DashboardOutlined />,
    gradient: 'linear-gradient(135deg, #5cdbd3 0%, #08979c 100%)',
    glow: 'rgba(8,151,156,.4)',
  },
  {
    title: '全球指数',
    desc: '全球主要市场指数实时行情',
    path: '/global/index',
    icon: <GlobalOutlined />,
    gradient: 'linear-gradient(135deg, #69b1ff 0%, #0958d9 100%)',
    glow: 'rgba(9,88,217,.4)',
  },
  {
    title: '中美国债',
    desc: '中美国债收益率走势对比',
    path: '/bond/cn/zh-us-rate',
    icon: <PercentageOutlined />,
    gradient: 'linear-gradient(135deg, #95de64 0%, #389e0d 100%)',
    glow: 'rgba(56,158,13,.4)',
  },
  {
    title: '大宗商品',
    desc: '金属指数与中国油价跟踪',
    path: '/commodity/cn/index',
    icon: <GoldOutlined />,
    gradient: 'linear-gradient(135deg, #d4b106 0%, #ad8b00 100%)',
    glow: 'rgba(173,139,0,.4)',
  },
  {
    title: 'REITs 实时',
    desc: '房地产宏观与 REITs 行情',
    path: '/realestate/cn/reits',
    icon: <ApartmentOutlined />,
    gradient: 'linear-gradient(135deg, #36cfc9 0%, #006d75 100%)',
    glow: 'rgba(0,109,117,.4)',
  },
  {
    title: '知识课堂',
    desc: 'RSI 指标原理与策略科普',
    path: '/knowledge/rsi',
    icon: <ReadOutlined />,
    gradient: 'linear-gradient(135deg, #ffd666 0%, #d48806 100%)',
    glow: 'rgba(212,136,6,.4)',
  },
  {
    title: 'API 测试',
    desc: 'AKShare 接口在线调试',
    path: '/api/test',
    icon: <CodeOutlined />,
    gradient: 'linear-gradient(135deg, #8c8c8c 0%, #262626 100%)',
    glow: 'rgba(38,38,38,.4)',
  },
];

/** 更多功能快捷入口 */
const MORE_LINKS: { label: string; path: string }[] = [
  { label: '股票回购', path: '/stock/a/repurchase' },
  { label: '历史分红', path: '/stock/a/history-dividend' },
  { label: '向上突破', path: '/stock/a/upward-breakthrough' },
  { label: '期权波动', path: '/stock/a/option-volatility' },
  { label: '恒指股息率', path: '/stock/hk/hsi-dividend-yield' },
  { label: '美股指数', path: '/stock/us/index' },
  { label: '基金温度', path: '/fund/cn/market-temp' },
  { label: '新发基金', path: '/fund/cn/new-fund' },
  { label: '基金仓位', path: '/fund/cn/position' },
  { label: '基金分红', path: '/fund/cn/dividend' },
  { label: '基金经理', path: '/fund/cn/manager' },
  { label: '基金公司', path: '/fund/cn/company' },
  { label: '中国油价', path: '/commodity/cn/oil' },
  { label: '地产宏观', path: '/realestate/cn/macro' },
];

const STATS = [
  { value: '29', suffix: '个', label: '功能页面' },
  { value: '7', suffix: '大', label: '资产品类' },
  { value: '2', suffix: '套', label: '量化买点策略' },
  { value: '100', suffix: '天', label: '近期买点高亮' },
];

const CAPABILITIES = [
  {
    icon: <AimOutlined />,
    title: 'RSI6 多周期共振 · 定量策略',
    points: ['日 / 周 / 月 / 季 K 线 RSI6 联合分级', '★5 / ★3 / ★1 三级买入信号', '基金、个股、指数自选表格通用'],
    accent: '#4f8cff',
  },
  {
    icon: <StarOutlined />,
    title: '月&季 RSI6 百分位策略',
    points: ['月、季 RSI6 同时低于 3% / 5% / 10% 分位买入', '★5 持仓且双双突破 85% 分位时卖出配对', '自动计算持有期收益与年化收益'],
    accent: '#fa8c16',
  },
  {
    icon: <RocketOutlined />,
    title: '自选池 · 批量计算 · 本地持久化',
    points: ['逐只串行计算并显示 (i/N) 进度', '每只买点即时 / 批量写入表格', 'localStorage 持久化，刷新行情不丢失'],
    accent: '#52c41a',
  },
];

/* -------------------------------- 组件 -------------------------------- */

const Home = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  // 顶部实时时钟
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }, [now]);

  const dateText = useMemo(() => {
    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${week}`;
  }, [now]);

  return (
    <div className="hfm-root">
      {/* 作用域样式 */}
      <style>{`
        .hfm-root { margin: -24px; overflow: hidden; border-radius: inherit; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
        .hfm-root * { box-sizing: border-box; }

        /* ---------- Hero ---------- */
        .hfm-hero {
          position: relative; padding: 56px 48px 44px; overflow: hidden;
          background: radial-gradient(1200px 500px at 80% -10%, #1d3a8a 0%, transparent 60%),
                      radial-gradient(900px 500px at 0% 120%, #4a1d8a 0%, transparent 55%),
                      linear-gradient(135deg, #0b1530 0%, #142657 55%, #1b2f6b 100%);
          color: #fff;
        }
        .hfm-hero::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 80% 90% at 50% 0%, #000 30%, transparent 75%);
        }
        .hfm-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; pointer-events: none; }
        .hfm-blob-1 { width: 320px; height: 320px; background: #2f6bff; top: -110px; right: -60px; animation: hfm-float 9s ease-in-out infinite; }
        .hfm-blob-2 { width: 260px; height: 260px; background: #9254de; bottom: -130px; left: 12%; animation: hfm-float 11s ease-in-out infinite reverse; }
        @keyframes hfm-float { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(24px,28px) scale(1.12); } }

        .hfm-hero-inner { position: relative; z-index: 1; max-width: 980px; margin: 0 auto; }
        .hfm-badge {
          display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
          background: rgba(79,140,255,.14); border: 1px solid rgba(120,170,255,.35);
          font-size: 13px; color: #bcd3ff; letter-spacing: .5px;
          animation: hfm-fadeup .7s both;
        }
        .hfm-title {
          margin: 18px 0 14px; font-size: 46px; font-weight: 800; line-height: 1.2; letter-spacing: 1px;
          animation: hfm-fadeup .7s .08s both;
        }
        .hfm-title .grad {
          background: linear-gradient(90deg, #7cc0ff 0%, #9d80ff 50%, #5ee7df 100%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          background-size: 200% auto; animation: hfm-shine 5s linear infinite;
        }
        @keyframes hfm-shine { to { background-position: 200% center; } }
        .hfm-sub { font-size: 16px; color: rgba(225,235,255,.78); line-height: 1.9; max-width: 720px; margin: 0 0 26px; animation: hfm-fadeup .7s .16s both; }
        .hfm-actions { display: flex; flex-wrap: wrap; gap: 14px; animation: hfm-fadeup .7s .24s both; }
        .hfm-btn {
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
          padding: 11px 24px; border-radius: 10px; font-size: 15px; font-weight: 600;
          transition: transform .25s, box-shadow .25s; border: none;
        }
        .hfm-btn-primary { background: linear-gradient(135deg, #4f8cff, #1d5cff); color: #fff; box-shadow: 0 10px 26px rgba(45,110,255,.45); }
        .hfm-btn-primary:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(45,110,255,.55); }
        .hfm-btn-ghost { background: rgba(255,255,255,.08); color: #dce8ff; border: 1px solid rgba(160,190,255,.35); }
        .hfm-btn-ghost:hover { transform: translateY(-3px); background: rgba(255,255,255,.16); }
        .hfm-clock {
          position: absolute; right: 40px; bottom: 26px; z-index: 1; text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .hfm-clock .t { font-size: 30px; font-weight: 700; letter-spacing: 2px; color: #cfe0ff; }
        .hfm-clock .d { font-size: 12px; color: rgba(210,225,255,.55); margin-top: 2px; }
        @keyframes hfm-fadeup { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }

        /* ---------- 统计条 ---------- */
        .hfm-stats { display: grid; grid-template-columns: repeat(4, 1fr); background: #fff; }
        .hfm-stat { padding: 26px 16px; text-align: center; position: relative; }
        .hfm-stat + .hfm-stat::before { content: ''; position: absolute; left: 0; top: 22%; height: 56%; width: 1px; background: #eef1f6; }
        .hfm-stat .num { font-size: 34px; font-weight: 800; background: linear-gradient(135deg, #1d5cff, #9254de); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .hfm-stat .num small { font-size: 15px; font-weight: 600; margin-left: 2px; }
        .hfm-stat .lab { margin-top: 6px; font-size: 13px; color: #8a94a6; }

        /* ---------- 通用区块 ---------- */
        .hfm-section { padding: 40px 48px 8px; }
        .hfm-section.alt { background: linear-gradient(180deg, #f5f8ff 0%, #eef3ff 100%); }
        .hfm-sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
        .hfm-sec-head .bar { width: 5px; height: 22px; border-radius: 3px; background: linear-gradient(180deg, #4f8cff, #9254de); }
        .hfm-sec-head h2 { margin: 0; font-size: 22px; font-weight: 700; color: #1c2b4a; }
        .hfm-sec-head .en { font-size: 12px; color: #a0abc0; letter-spacing: 2px; text-transform: uppercase; }

        /* ---------- 功能宫格 ---------- */
        .hfm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .hfm-card {
          position: relative; padding: 22px 20px; border-radius: 16px; cursor: pointer;
          background: #fff; border: 1px solid #edf0f6; overflow: hidden;
          transition: transform .28s cubic-bezier(.2,.7,.3,1), box-shadow .28s, border-color .28s;
          animation: hfm-fadeup .6s both;
        }
        .hfm-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(30,60,140,.14); border-color: #cfe0ff; }
        .hfm-card::after {
          content: ''; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px;
          border-radius: 50%; opacity: 0; transition: opacity .28s;
        }
        .hfm-card:hover::after { opacity: .12; background: currentColor; }
        .hfm-card .icon {
          width: 48px; height: 48px; border-radius: 13px; display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: #fff; margin-bottom: 14px; transition: transform .28s;
        }
        .hfm-card:hover .icon { transform: scale(1.1) rotate(-6deg); }
        .hfm-card h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #1c2b4a; }
        .hfm-card p { margin: 0; font-size: 12.5px; line-height: 1.7; color: #8a94a6; min-height: 42px; }
        .hfm-card .go { position: absolute; right: 16px; bottom: 14px; font-size: 13px; color: #b4bfd4; opacity: 0; transform: translateX(-6px); transition: all .25s; }
        .hfm-card:hover .go { opacity: 1; transform: translateX(0); }

        /* ---------- 能力卡片 ---------- */
        .hfm-caps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; padding-bottom: 36px; }
        .hfm-cap { padding: 26px 24px; border-radius: 16px; background: #fff; border: 1px solid #e8edf7; transition: transform .28s, box-shadow .28s; }
        .hfm-cap:hover { transform: translateY(-5px); box-shadow: 0 16px 38px rgba(30,60,140,.12); }
        .hfm-cap .ci { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; margin-bottom: 16px; }
        .hfm-cap h3 { margin: 0 0 12px; font-size: 16px; color: #1c2b4a; }
        .hfm-cap ul { margin: 0; padding: 0; list-style: none; }
        .hfm-cap li { position: relative; padding-left: 16px; margin-bottom: 8px; font-size: 13px; line-height: 1.7; color: #6b768c; }
        .hfm-cap li::before { content: ''; position: absolute; left: 0; top: 9px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent, #4f8cff); }

        /* ---------- 更多入口 ---------- */
        .hfm-chips { display: flex; flex-wrap: wrap; gap: 10px; }
        .hfm-chip { padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; background: #fff; border: 1px solid #e3e9f4; color: #46536b; transition: all .2s; }
        .hfm-chip.link { cursor: pointer; }
        .hfm-chip.link:hover { background: #1d5cff; border-color: #1d5cff; color: #fff; transform: translateY(-2px); }

        .hfm-foot { padding: 26px 48px 30px; text-align: center; background: #0b1530; color: rgba(220,230,255,.6); font-size: 12.5px; line-height: 1.9; }
        .hfm-foot .warn { color: #ffc53d; font-weight: 600; }

        @media (max-width: 1100px) { .hfm-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 860px) {
          .hfm-hero { padding: 40px 24px 60px; }
          .hfm-title { font-size: 32px; }
          .hfm-clock { right: 24px; bottom: 14px; }
          .hfm-section { padding-left: 24px; padding-right: 24px; }
          .hfm-grid { grid-template-columns: repeat(2, 1fr); }
          .hfm-caps { grid-template-columns: 1fr; }
          .hfm-stats { grid-template-columns: repeat(2, 1fr); }
          .hfm-stat:nth-child(3)::before { display: none; }
          .hfm-foot { padding-left: 24px; padding-right: 24px; }
        }
      `}</style>

      {/* Hero */}
      <div className="hfm-hero">
        <div className="hfm-blob hfm-blob-1" />
        <div className="hfm-blob hfm-blob-2" />
        <div className="hfm-hero-inner">
          <span className="hfm-badge">
            <SafetyCertificateOutlined /> 基于 AKShare / AKTools 开源财经数据
          </span>
          <h1 className="hfm-title">
            Financial Data Workbench
            <br />
            <span className="grad">一站式财经数据可视化与投研分析平台</span>
          </h1>
          <p className="hfm-sub">
            覆盖 A股 · 港股 · 美股 · 基金 · 债券 · 大宗商品 · 全球指数 · REITs，
            内置 RSI6 多周期共振与月&季百分位量化买点策略、自选池批量计算与近期买点高亮，
            让数据驱动你的每一次研究。
          </p>
          <div className="hfm-actions">
            <button className="hfm-btn hfm-btn-primary" onClick={() => navigate('/fund/cn/open')}>
              <RocketOutlined /> 立即进入基金自选
            </button>
            <button className="hfm-btn hfm-btn-ghost" onClick={() => navigate('/stock/a/index')}>
              <BarChartOutlined /> 浏览 A 股指数 <ArrowRightOutlined />
            </button>
          </div>
        </div>
        <div className="hfm-clock">
          <div className="t">{timeText}</div>
          <div className="d">{dateText}</div>
        </div>
      </div>

      {/* 统计条 */}
      <div className="hfm-stats">
        {STATS.map((s, i) => (
          <div className="hfm-stat" key={s.label} style={{ animation: `hfm-fadeup .6s ${i * 0.08}s both` }}>
            <div className="num">
              {s.value}
              <small>{s.suffix}</small>
            </div>
            <div className="lab">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 量化能力 */}
      <div className="hfm-section alt">
        <div className="hfm-sec-head">
          <span className="bar" />
          <h2>核心量化能力</h2>
          <span className="en">Quantitative</span>
        </div>
        <div className="hfm-caps">
          {CAPABILITIES.map(cap => (
            <div className="hfm-cap" key={cap.title} style={{ ['--accent' as string]: cap.accent }}>
              <div className="ci" style={{ background: cap.accent, boxShadow: `0 8px 20px ${cap.accent}55` }}>
                {cap.icon}
              </div>
              <h3>{cap.title}</h3>
              <ul>
                {cap.points.map(p => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 功能模块 */}
      <div className="hfm-section">
        <div className="hfm-sec-head">
          <span className="bar" />
          <h2>功能模块</h2>
          <span className="en">Modules</span>
        </div>
        <div className="hfm-grid">
          {MODULES.map((m, i) => (
            <div
              key={m.path}
              className="hfm-card"
              style={{ color: m.glow, animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(m.path)}
            >
              <div className="icon" style={{ background: m.gradient, boxShadow: `0 8px 20px ${m.glow}` }}>
                {m.icon}
              </div>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
              <span className="hfm-go">进入 <ArrowRightOutlined /></span>
            </div>
          ))}
        </div>
      </div>

      {/* 更多入口 */}
      <div className="hfm-section">
        <div className="hfm-sec-head">
          <span className="bar" />
          <h2>更多功能</h2>
          <span className="en">More</span>
        </div>
        <div className="hfm-chips">
          {MORE_LINKS.map(link => (
            <span key={link.path} className="hfm-chip link" onClick={() => navigate(link.path)}>
              {link.label}
            </span>
          ))}
        </div>
      </div>

      {/* 页脚 */}
      <div className="hfm-foot">
        <div className="warn">⚠️ 本平台仅用于数据展示与学习研究，所有数据与策略信号不构成任何投资建议，据此操作风险自担。</div>
        <div style={{ marginTop: 6 }}>市场有风险，投资需谨慎 · 数据来源：AKShare 开源社区</div>
        <div style={{ marginTop: 6, opacity: .55 }}>© 2026 Financial Data Workbench</div>
      </div>
    </div>
  );
};

export default Home;
