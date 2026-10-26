/**
 * 全局可配置参数统一入口。
 *
 * 约定：
 * - 只放「跨页面复用 / 影响回测与展示口径」的参数，改这里即可全局生效；
 * - 页面内一次性 UI 文案、分页 pageSize、局部抽样步长、设计颜色等仍留在各自页面/组件。
 */
export const appConfig = {
  http: {
    /** 请求超时（毫秒） */
    timeoutMs: 120 * 1000,
    /**
     * 中证指数历史查询起始日：A 股最早交易日为 1990-12-19。
     * 接口在起始日早于指数首条真实数据时会补一条同值占位行，由 cleanCsindexHistory 统一剔除。
     */
    indexHistoryStartDate: '19901219',
  },

  batch: {
    /** 单个标的取数/计算失败后的重试次数（不含首次尝试） */
    fetchRetryCount: 1,
    /** 重试间隔（毫秒） */
    retryDelayMs: 500,
    /** 批量买点计算默认并发数（与 Worker 池上限一致） */
    concurrency: 4,
    /** 买入&卖出报告导出的批量并发数 */
    reportConcurrency: 8,
  },

  worker: {
    /** Worker 池上限（受限并发，避免一次性占满 CPU 核） */
    maxWorkers: 4,
  },

  rsi: {
    /** RSI 预热点数：前 N 个点为固定值 50（无统计意义），计算分位时剔除 */
    warmup: 6, // RSI6

    /** as-of 回测窗口（月数）：默认 120 个月 = 10 年 */
    asOfWindowMonths: 120,

    /** 最小有效样本门槛（月&季、周/月单周期共用）：默认 60 个 */
    minSampleCount: 60,

    /** 配对卖出所需最低收益率（%，两种策略共用）：判定口径见 annualizeMinHoldingDays */
    sellMinReturnPct: 15,

    /**
     * 年化口径分界：持有满该天数按年化收益率判定/展示，不足则按区间收益率。
     * 当前为 1，等价于「所有持有期一律按年化收益率判定」；设为 365 可恢复「不足 1 年按区间收益率」的两段口径。
     */
    annualizeMinHoldingDays: 1,

    /** 近期买点高亮天数 */
    recentBuyPointDays: 100,

    /** 月&季 RSI6 百分位策略 */
    monthlyQuarterly: {
      /**
       * 星级 → 买入分位（月/季独立配置，各自需 ≤ 对应分位；星级越高越严格）
       * 默认月、季取相同值，保持原口径不变
       */
      levelRules: [
        { level: 5, monthlyPercentile: 2, quarterlyPercentile: 2 },
        { level: 3, monthlyPercentile: 5, quarterlyPercentile: 5 },
        { level: 1, monthlyPercentile: 10, quarterlyPercentile: 10 },
      ] as { level: number; monthlyPercentile: number; quarterlyPercentile: number }[],

      /** 卖出分位：月/季各自独立（月RSI6 ≥ 该分位且季RSI6 ≥ 该分位） */
      monthlySellPercentile: 90,
      quarterlySellPercentile: 90,

      /** ★5 配对卖出最低持有天数（自然日） */
      sellMinHoldingDays: 365,

      /** 分批卖出次数（配置为 1 时一次性清仓） */
      trancheCount: 4,

      /** 分批卖出间隔（自然日，配置 ≤1 时自动兜底为 2） */
      trancheIntervalDays: 7,
    },

    /** 周/月单周期 RSI6 百分位策略（分位各自独立） */
    singlePeriod: {
      weekly: {
        /** 周RSI6 买入分位（≤ 建仓） */
        buyPercentile: 1,
        /** 周RSI6 卖出分位（≥ 且收益率达标时卖出） */
        sellPercentile: 90,
      },
      monthly: {
        /** 月RSI6 买入分位（≤ 建仓/加仓） */
        buyPercentile: 3,
        /** 月RSI6 卖出分位（≥ 且收益率达标时卖出） */
        sellPercentile: 90,
      },
    },
  },

  chart: {
    /** 指数指标图（IndexMetrics） */
    indexMetrics: {
      /** 日频数据抽样步长（先算指标再抽样，仅影响展示密度） */
      dailySampleRate: 10,
      /** 日频判定阈值：相邻日期间隔中位数 ≤ 该天数即视为日频 */
      dailyGapThresholdDays: 10,
      /** 日频波动率年化系数：A 股每年约 252 个交易日（稀疏数据按 365/间隔 推断） */
      tradingDaysPerYear: 252,
      /** 波动率滚动窗口（观测点数）：日频约 1 个交易月 */
      dailyVolWindow: 20,
      /** 波动率滚动窗口（观测点数）：稀疏数据约 1 年 */
      sparseVolWindow: 12,
    },

    /** 日收益率分布图 */
    dailyReturn: {
      /** 正态分布直方图分箱数量 */
      binCount: 50,
      /** 涨幅榜 / 跌幅榜各取前 N 个交易日 */
      rankSize: 30,
    },

    /** 双指数比值对比图 */
    indexComparison: {
      /** 低区阈值：低于该分位填充绿色 */
      lowPercentile: 5,
      /** 高区阈值：高于该分位填充红色 */
      highPercentile: 95,
      /** 低区填充色 */
      lowColor: 'rgba(82, 196, 26, 0.62)',
      /** 高区填充色 */
      highColor: 'rgba(113, 8, 14, 1)',
      /** 累计年化收益率差图：至少持有满该自然日数才展示年化点，避免短窗口年化被极端放大 */
      annualizedMinDays: 365,
    },

    /** 大盘拥挤度高亮分位阈值 */
    congestionPercentile: 99,

    /** 详情页「各周期 RSI6·历史分位参考」展示的分位（升序，改这里即可调整列） */
    rsiPercentileRefs: [2, 5, 10, 90] as number[],

    /** 详情页「各周期 RSI6·历史分位参考」窗口定义 */
    rsiPercentileWindows: [
      { key: 'full', label: '全历史', years: null },
      { key: '10y', label: '近10年', years: 10 },
      { key: '5y', label: '近5年', years: 5 },
      { key: '3y', label: '近3年', years: 3 },
    ] as { key: 'full' | '10y' | '5y' | '3y'; label: string; years: number | null }[],

    /** MACD 详情页峰值买点口径 */
    macd: {
      /** 峰值检测回看窗口（根）：周52 / 月12 / 季4，约 1 年 */
      peakWindows: { weekly: 52, monthly: 12, quarterly: 4 } as Record<
        'weekly' | 'monthly' | 'quarterly',
        number
      >,
      /**
       * 峰值确认滞后（根）：峰值后第 N 根才确认买点（as-of，不使用确认日之后的数据）。
       * 默认 1，即峰值后的下一根；不同周期可分别配置。
       */
      peakConfirmLags: { weekly: 1, monthly: 1, quarterly: 1 } as Record<
        'weekly' | 'monthly' | 'quarterly',
        number
      >,
    },
  },
};
