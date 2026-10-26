---
name: rsi6-buypoint-report
description: 维护各行情页（A股/港股个股与指数、大宗商品、外盘期货、开放式基金）的「计算推荐买点」「导出买入&卖出报告（Excel）」「导出买入计划（Excel）」三入口，覆盖 RSI6 多周期买点计算（标准 Wilder 平滑 / Wilder RSI）、RSI6 日/周/月/季口径（含「周期初→当日」未来函数消除、周键 weekYear、周期二分定位）、详情页各周期历史分位参考（全历史/近10年/近5年/近3年）、Worker 池批量编排、接口异常重试与失败汇总 Modal、操作时间窗口（计算仅周末 / 导出仅每月最后 3 个自然日）、★5 月季共振买卖配对（分位阈值 as-of 近 10 年（120 个月，可配置）滚动窗口、满 60 个月才出信号、卖出需月/季 RSI6 双超买且持有满 365 天、收益率达门槛）、周/月单周期分位 as-of 近 10 年滚动窗口（满 60 个有效样本才出信号）、分批卖出、回撤等派生指标、Excel 导出与文件名前缀约定。当用户要求新增或调整买点计算、导出买卖报告/买入计划、修改报告列或策略买卖规则、修改 RSI6 周期口径/消除未来函数（含月季分位 as-of）、调整详情页历史分位参考卡片、调整时间窗口/重试策略、或在其它页面接入这三个入口时调用。不用于新增行情图表页或纯 K 线展示功能。
---

# RSI6 买点计算与买入卖出报告

列表页底部并排的三个操作入口，**计算内核完全相同**（`runRecommendationBatchCalculation` + 同一 Worker 池），差别只在「写回表格」与「导出 Excel 的筛选口径」。

## 配置中心（重要）

本技能涉及的所有可配置参数已统一收敛到 **`Front-End/src/config/appConfig.ts`**，按分组组织：

| 分组 | 包含参数 |
|------|----------|
| `appConfig.rsi` | `warmup`、`asOfWindowMonths`、`minSampleCount`、`sellMinReturnPct`、`annualizeMinHoldingDays`、`recentBuyPointDays` |
| `appConfig.rsi.monthlyQuarterly` | `levelRules`（★5/★3/★1 的 `monthlyPercentile` / `quarterlyPercentile`，月季可分设）、`monthlySellPercentile`、`quarterlySellPercentile`、`sellMinHoldingDays`、`trancheCount`、`trancheIntervalDays` |
| `appConfig.rsi.singlePeriod` | `weekly.buyPercentile` / `weekly.sellPercentile`、`monthly.buyPercentile` / `monthly.sellPercentile` |
| `appConfig.batch` | `fetchRetryCount`、`retryDelayMs`、`concurrency`、`reportConcurrency` |
| `appConfig.worker` | `maxWorkers` |
| `appConfig.http` | `timeoutMs`、`indexHistoryStartDate`（中证指数历史查询起始日，默认 19901219；配合 `cleanCsindexHistory` 剔除接口占位行） |
| `appConfig.chart` | `indexMetrics.*`、`dailyReturn.*`、`indexComparison.*`、`congestionPercentile`、`rsiPercentileRefs`（历史分位参考展示的分位列，默认 2/5/10/90）、`rsiPercentileWindows`、`macd.peakWindows` / `macd.peakConfirmLags`（MACD 峰值买点回看窗口与确认滞后） |

共用项只定义一次：`minSampleCount=60`、`sellMinReturnPct=15`、`asOfWindowMonths=120`、`warmup=6` 由月&季与周/月单周期**共用**；各类分位（月&季 ★5/★3/★1 与月/季卖出、周/月单周期买卖）仍**各自独立可调**。`stockUtils.ts` / 组件内仅保留模块级解构别名（如 `MQ_LEVEL_RULES`、`RSI_ASOF_WINDOW_MONTHS`），不再重复定义常量。

## 覆盖页面

| 页面 | 文件 | `filePrefix` | `itemLabel` | `showWeeklyStrategy` |
|------|------|--------------|-------------|----------------------|
| A股个股 | `Front-End/src/pages/stock/a/stock/components/OutTrading.tsx` | `A股个股` | 股票 | 是 |
| A股指数 | `Front-End/src/pages/stock/a/index/index.tsx` | `A股指数` | 指数 | 是 |
| 港股指数 | `Front-End/src/pages/stock/hk/index/index.tsx` | `港股指数` | 指数 | 是 |
| 港股个股 | `Front-End/src/pages/stock/hk/stock/components/HkOutTrading.tsx` | `港股个股` | 股票 | 是 |
| 大宗商品 | `Front-End/src/pages/commodity/cn/index.tsx` | `大宗商品` | 品种 | 是 |
| 外盘期货 | `Front-End/src/pages/futures/foreign/quotes/index.tsx` | `外盘期货` | 期货品种 | 是 |
| 开放式基金 | `Front-End/src/pages/fund/cn/open/index.tsx` | `开放式基金` | 基金 | **否**（基金数据只有月/季，无日/周） |

- 按钮位置与原「计算推荐买点」按钮**完全一致**：个股/指数（含港股）在「自选 / 自定义分组」Tab 内；大宗商品在页面顶部；基金在「自选基金」Tab 内。
- 「全部」列表 Tab 不挂按钮组（历史行为保持不变）。
- 页面差异的两处开关：`itemLabel` 只影响文案名词；`showWeeklyStrategy` 只有基金传 `false`（基金数据无日/周频，见「基金数据粒度」）。

## 基金数据粒度（重要）

「开放式基金」的 `累计收益率走势`（`/api/public/fund_open_fund_info_em`，`indicator: '累计收益率走势'`、`period: '成立来'`）返回的是**稀疏的月/季级序列**：

- **没有逐日交易日数据，也没有周频数据**；序列本身即按月给出（实测相邻数据点间隔约 **30 天 ≈ 1 个月**，即每月一条），因此：
  - **没有日 RSI6、没有周 RSI6** → 基金的 `weeklyPercentile` 恒为空串，页面不展示「周RSI6百分位策略」列，规则文案也只有 3 条（`showWeeklyStrategy={false}`）。
  - 基金的「定量」不是「日 / 周 / 月 / 季」四周期组合，而是**月度 RSI6 + 所在季度 RSI6** 两个周期（走 `fundRsiRecommendationRules`）。
- **有月与季度两个周期**：`computeFundBuyPoints` 先把序列映射为「收盘」（`累计收益率`），再**按月取每月最后一条**得到月线、**再在月线上按季取每季最后一条**得到季线，分别算月 RSI6 与季 RSI6。
- 因此基金页的回写与导出只有 **3 类买点列**：推荐买点（定量）、推荐买点（百分位，月&季共振）、月RSI6百分位策略。
- 基金口径 `closeValueType: 'cumulativeReturn'`（起点 0，年化用 `(100+close)/(100+first)` 而非 `close/first`，否则年化会整线缺失）。

## 公共模块

| 职责 | 位置 |
|------|------|
| 三按钮 + 规则文案 UI | `Front-End/src/components/BuyPointActionGroup.tsx`（三个按钮单行等宽排列；规则文案改为各按钮右侧 info 图标的 hover/聚焦浮层，不再常驻占高度；`itemLabel` 适配名词、`showWeeklyStrategy` 控制「回填 3/4 类买点列」与周策略文案） |
| 导出主流程（筛选 / 排序 / 单元格 / 汇总 / 下载 / 提示 / 文件名前缀） | `Front-End/src/utils/buySellReportExport.ts`（`exportBuySellReport` / `exportBuyPlan`） |
| 批量并发编排 | `Front-End/src/utils/recommendationBatch.ts` 的 `runRecommendationBatchCalculation` |
| Worker 池客户端（列表页） | `Front-End/src/utils/buyPointWorker.ts` 的 `computeBuyPoints`，池上限 = `Math.min(4, Math.max(1, CPU 核心数 - 1))`（固定上限 4，按需懒创建、空闲复用；每个浏览器标签页各一份） |
| 详情页单 Worker 客户端 | `Front-End/src/utils/rsiDetailWorker.ts` 的 `createRsiDetailWorker`（每个 `RsiFilterMark` 实例独占 1 个 Worker；数据变化时终止旧 Worker 并重建，最新数据优先） |
| Worker 内纯计算 | `Front-End/src/utils/buyPointCompute.ts` 的 `runBuyPointTask`（`BuyPointResult`）；`Front-End/src/utils/rsiDetailCompute.ts` 的 `runRsiDetailTask`（`RsiDetailResult`）；Worker 入口分别为 `workers/buyPoint.worker.ts`、`workers/rsiDetail.worker.ts` |
| 详情页 RSI6 组件 | `Front-End/src/components/RsiFilterMark.tsx`（重计算走 `createRsiDetailWorker`，计算期间展示 loading；顶部有「样本区间」RangePicker，见下方「样本区间筛选」） |
| 策略与指标口径 | `Front-End/src/utils/stockUtils.ts` |
| 零依赖 xlsx 写入 | `Front-End/src/utils/xlsxExport.ts` 的 `downloadXlsx` |

数据链路：页面 → `runRecommendationBatchCalculation`（受限并发）→ 页面取数函数（HTTP 取数）→ `computeBuyPoints`（Worker 池计算）→ 结果回主线程 → 回写表格 / 生成 Excel。

## 样本区间筛选（RsiFilterMark 顶部）

- 位置：`RsiFilterMark` 顶部「样本区间」高亮条（左侧图标 + 标题 + 状态 Tag + 样本摘要，右侧 `DatePicker.RangePicker` 与两个单侧清除按钮，底部附口径说明文案）；**默认起止为空 = 使用全部数据**。启用任一区间时整条切换为紫色/蓝色渐变高亮与阴影，并用 `sampleRangeStats`（`filteredData` 的样本点数与首尾日期）展示当前样本规模。
- 可选边界：`disabledDate` 限制在数据自身最早日期 ~ 最晚日期之间（`dataDateBounds` 取 `data` 中 `moment(日期).valueOf()` 的最小/最大值），早于最早、晚于最晚的日期不可选。
- 过滤时机：**先裁剪再计算**。区间按 `[start.startOf('day'), end.endOf('day')]` 闭区间过滤 `data` 得到 `filteredData`，再作为 `rawData` 送 `createRsiDetailWorker`。主图、RSI6 序列、分位统计、周/月策略、★5 月季买卖点全部基于区间数据重算。
- **支持单边区间**（`allowEmpty={[true, true]}`）：只选开始 → 该日期及之后全部数据（上界 `+Infinity`）；只选结束 → 该日期及之前全部数据（下界 `-Infinity`）；两端都选 → 闭区间；两端都空 → 全量数据。
- 状态：`sampleRange: [Dayjs | null, Dayjs | null] | null`（**受控**，`value={sampleRange}`；加载期间组件会被 loading 分支替换，受控值保证计算结束后仍显示所选区间）；`hasSampleRange = Boolean(sampleRange?.[0] || sampleRange?.[1])`，任一非空即过滤。`dataSignature`、loading 判定、空数据判定均改用 `filteredData`。
- 清空：`allowClear` 清空后回到全量数据；RangePicker 自带的 × 会同时清空两端。**单侧清除**用右侧两个 link 按钮「清除开始」/「清除结束」：分别把对应端置为 `null`，另一端保留（对应按钮在该端为空时禁用）。
- 空结果：区间内无数据时提示「所选样本区间内暂无数据，请调整日期范围」；**空状态下仍展示样本区间控件**（含 RangePicker 与两个单侧清除按钮），可直接重新选择。
- 口径提醒：区间起点处 RSI 需重新预热（日 RSI6 前 `rsiWarmup` 个交易日为 50；月/季 RSI6 从区间起点重新累积），分位窗口也只在区间内滚动，**与全历史口径不同，属有意为之**。

**接入新页面**：页面只需提供 `targets / getCode / getName / getKey / fetchPoints / emptyWarn / itemLabel / filePrefix`，其余全部由公共模块处理；各页面取数函数返回 `Promise<BuyPointResult>`，**接口异常（网络/HTTP 异常、空数组、收盘价无有效值）必须 `throw`**，由 `runRecommendationBatchCalculation` 统一重试并汇总弹窗；**禁止 catch 后返回空结果**（会导致该标的静默漏出报表）。UI 侧直接渲染 `<BuyPointActionGroup onCalculate onExportReport onExportPlan itemLabel showWeeklyStrategy />`。

## 操作时间窗口（前端本地时间判断）

统一下沉在 `BuyPointActionGroup.tsx`，所有接入页面自动生效，无需逐页改：

- **「计算推荐买点」仅周六 / 周日**（`moment().day()` 为 0 或 6）直接执行；非周末点击弹 `Modal.confirm`（标题「非周末时间」），用户确认后照常计算。
- **两个导出仅每月最后 3 个自然日**（`moment().date() >= moment().daysInMonth() - 2`：31 天月为 29/30/31，30 天月为 28/29/30，2 月为 26/27/28）；窗口外点击弹 `Modal.confirm`（标题「非月底时间」），确认后照常导出。
- 口径说明：按**自然日**而非交易日判断，不排除节假日；限制只做「提示 + 二次确认」，不硬性阻断。
- 规则文案三处（计算 / 买入&卖出报告 / 买入计划）均已同步注明上述时间窗口。

## 接口异常重试与失败汇总

在 `recommendationBatch.ts` 单点实现，计算与两个导出共用：

- 单个标的取数/计算异常自动重试 **`appConfig.batch.fetchRetryCount = 2` 次**（不含首次，共 3 次尝试），每次间隔 `appConfig.batch.retryDelayMs = 500` 毫秒。
- 3 次均失败则**跳过该标的**（不中断同批其它标的），记录 `{ key, name, reason }`；全部结束后：
  - 进度 message 变为「推荐买点处理完成（成功 X/Y，失败 Z）」；
  - 弹 `Modal.error`，标题「以下 Z 个标的接口异常，已跳过」，内容按「【代码】名称：原因」逐条汇总，OK 文案「知道了」。
- 「异常」范围 = **网络/HTTP 异常 + 空数据（空数组 / 收盘价无有效值 / 大宗商品收盘全 0）**；重试对 HTTP 与空数据同样生效。
- `runRecommendationBatchCalculation` 返回 `{ total, successCount, failures }`；导出主流程在「无任何可导出信号」时，若 `failures.length > 0` 则**不再**追加「无信号」提示（避免与失败 Modal 语义冲突）。
- 新增接入页面时，取数函数抛出的 Error.message 会直接展示在 Modal 中，请写可读文案（如「接口返回空数据」）。

## 功能一：计算推荐买点

- 入口 `handleCalculateRecommendation(groupKey)`，仅作用于当前分组（`selected` 自选或自定义分组）中**已勾选**的行；大宗商品/指数/外盘/基金等无分组页面则作用于当前列表勾选行。
- 结果写回 4 个买点字段并逐只落表、持久化：

| 表格列标题 | 字段 | 来源 |
|------|------|------|
| 推荐买点（定量） | `__推荐买点定量__` | `BuyPointResult.quantitative` |
| 推荐买点（百分位） | `__推荐买点百分位__` | `BuyPointResult.percentile`（月&季共振） |
| 月RSI6百分位策略 | `__月RSI6百分位__` | `BuyPointResult.monthlyPercentile` |
| 周RSI6百分位策略 | `__周RSI6百分位__` | `BuyPointResult.weeklyPercentile`（基金数据无周频，恒为空串 → 基金页无此列） |

- 行情刷新（每日取数）时必须保留买点字段：个股/指数走 `mergeFreshQuotes`（买点字段沿用分组内原值，其余字段以行情为准）；大宗商品等用独立 `buyPointCache` 持久化，空结果不覆盖已有缓存。
- 「全部」列表 Tab 不展示这些买点列（渲染时 filter 掉对应 `key`），只提供「添加到自选 / 加入分组」。

## 功能二：买入&卖出报告（Excel）

与功能一**共用同一计算内核**，差别只在：**不回写表格**（结果仅导出 Excel）、**不复用表格里已有的买点结果**（每次导出都重新取数计算）。

### 触发与前置

- 入口页面 `handleExportBuySellReport` → 公共 `exportBuySellReport(options)`。
- 必须先勾选，未勾选时由 `runRecommendationBatchCalculation` 内部 `message.warning(emptyWarn)` 提示并直接返回（各页 `emptyWarn` 见下表）。**不要在导出函数里再加重复的空选提示**。

| 页面 | `emptyWarn` |
|------|-------------|
| A股个股 / 港股个股 | 请选择股票 / 请选择股票 |
| A股指数 / 港股指数 | 请选择指数 |
| 大宗商品 / 外盘期货 | 请勾选需要导出的品种 / 请选择期货品种 |
| 开放式基金 | 请先勾选需要导出的基金 |

- 作用对象是**当前已勾选**的行（跨分组以勾选为准），不是整个分组。

### 筛选规则

- 每只标的算完后只保留 `level === 5 && sellDate != null`：即 **★5 月&季共振买点且已完成买卖配对**（有卖出日期）。★1/★3 不统计，**持仓中尚未卖出的 ★5 也不导出**。
- 汇总所有勾选标的的全部配对信号为独立行（同一只可有多行）。
- 排序：按买入日期（`point.日期`）**倒序**（最近信号在前），同日按代码升序。
- 无任何匹配行时提示「所选{label}未发现「月&季 RSI6 百分位策略」已配对的 ★5 买卖信号」并结束，不生成文件。

### 列 → 字段映射（`toReportCells`，基础 21 列 + `trancheCount` 列分批收益率）

| 列标题 | 取值 | 格式约定 |
|--------|------|----------|
| 代码 | `item.code` | 原样 |
| 名称 | `item.name`（缺失回退代码） | 原样 |
| 推荐级别 | `'★'.repeat(point.level)` | 字符串，如 `★★★★★` |
| 买入日期 | `formatReportDate(point.日期)` | `YYYY-MM-DD` |
| 买入收盘价 | `point.收盘` | 保留 2 位 |
| 买入月RSI6 | `point.monthlyRsi` | 保留 2 位 |
| 买入季RSI6 | `point.quarterlyRsi` | 保留 2 位 |
| 卖出日期 | `formatReportDate(point.sellDate)` | `YYYY-MM-DD` |
| 卖出收盘价 | `point.sellPrice` | 缺失写 `''` |
| 卖出月RSI6 | `point.sellMonthlyRsi` | 保留 2 位，缺失写 `''` |
| 卖出季RSI6 | `point.sellQuarterlyRsi` | 保留 2 位，缺失写 `''` |
| 当前价格（**动态表头** `当前YYYY-MM-DD价格`） | `point.latestClose` | 缺失写 `''` |
| 持有天数 | `point.holdingDays` | 整数，缺失写 `''` |
| 平均收益率 | `point.returnRate`（各批已执行卖出收益率的算术平均） | 保留 2 位 |
| 第N批卖出收益率（T+X天）（**动态 N 列**） | `point.sellTranches[N-1].returnRate` | 保留 2 位；未执行批次写 `'-'` |
| 年化收益率 | `point.annualizedReturn`，为空回退 `returnRate` | 保留 2 位 |
| 最大回撤率 | `point.maxDrawdown` | 缺失写 `'-'` |
| 最大回撤最低点日期 | `point.maxDrawdownDate` | 缺失写 `'-'` |
| 最大回撤的收盘价 | `point.maxDrawdownClose` | 缺失写 `'-'` |
| 买点到最大回撤率的被套天数 | `point.daysToMaxDrawdown` | 缺失写 `'-'` |
| 回本日期 | `point.recoveryDate` | 缺失写 `'-'` |
| 最大回本持有天数 | `point.maxRecoveryHoldingDays` | 缺失写 `'-'` |
| Calmar比率（年化收益 / 最大回撤） | `point.calmarRatio`，年化为空且持有不足 `annualizeMinHoldingDays` 时回退 `returnRate` | 缺失写 `'-'` |

- **「当前价格」列**：插入位置固定为**「卖出季RSI6」之后**（`CURRENT_PRICE_INSERT_INDEX` 由列标题定位，不写死下标）。表头由 `runReportExport` 动态生成 —— 取**所有导出行的最晚 `latestDate`**，拼成 `当前YYYY-MM-DD价格`（无值时回退 `当前价格`）；两个导出功能都带此列。该列是**价格类列**，汇总行按动态标题加入 `extraExcludedTitles` 排除，不参与任何统计。
- **顺序即表头顺序**：`toReportCells(item, mode)` 返回数组的下标必须与列定义逐项对齐，这是最易改错的一处（详见「关键不变量」）。
- 展示回退：持有天数 `< appConfig.rsi.annualizeMinHoldingDays`（当前配置 1 天，该分支实际不命中）时，「年化收益率」与「Calmar比率」两列直接展示**与「平均收益率」相同**的数值；否则年化取 `point.annualizedReturn`、无回撤时 Calmar 写 `'-'`。
- 基金走 `cumulativeReturn` 口径，`computeFundBuyPoints` 与个股/商品一样调用 `computeHoldingDrawdown`（按净值折算），故基金报告的「最大回撤率 / 最大回撤最低点日期 / 最大回撤的收盘价 / 被套天数 / 回本日期 / 最大回本持有天数 / Calmar」已正常产出；未跌破买入价时仍为 `-`。基金数据只有月/季（无日、无周），`weeklyPercentile` 恒为空串；「当前价格」与「最大回撤的收盘价」对基金同样为**累计收益率值**（与「买入收盘价」同口径）。
- **两种口径（`mode`）**：`paired`（买入&卖出报告）用列 `buildReportColumns(title)`，`持有天数`/`平均收益率` 取 `point.holdingDays`/`point.returnRate`（各批卖出价 vs 买入价的平均，已实现），年化取 `point.annualizedReturn`，并带动态分批收益率列；`open`（买入计划）用列 `buildBuyPlanColumns(title)`（剔除分批列、「平均收益率」→「持有至今收益率」、「年化收益率」→「持有至今年化收益率」），`持有天数`/`持有至今收益率` 取 `point.holdingDaysToNow`/`point.returnRateToNow`（最新交易日 vs 买入，可正可负），`持有至今年化收益率` = 持有满 `annualizeMinHoldingDays`（当前 1 天）按 `calculateAnnualizedReturn(returnRateToNow, holdingDaysToNow)` 复利年化（可正可负，为 `null` 时写 `'-'`），不足则直接取区间收益率。`open` 下「Calmar比率」不套用回退，留 `-`。

### 汇总行（`buildSummaryRow`）

- 追加为**最后六行**（顺序固定）：`平均值`、`中位数`、`样本方差`、`样本标准差`、`总体方差`、`总体标准差`；两个导出功能（`paired` / `open`）都有这六行。
- **只基于明细行统计**：`runReportExport` 先 `const detailRows = reportItems.map(...)`，再 `rows = [...detailRows]` 逐个 push 汇总行，禁止把已生成的汇总行再喂给下一次统计（否则中位数会被平均值行污染）。
- 按**列标题**判断是否参与统计（`REPORT_SUMMARY_EXCLUDED_TITLES`，不写死下标，避免加列错位）：代码、名称、推荐级别、买入日期、卖出日期、最大回撤最低点日期、回本日期（文本/日期列），以及 买入收盘价、卖出收盘价、最大回撤的收盘价（价格类列不取统计）一律留空。
- 其余数值列分别按对应统计量计算并保留 2 位；`'-'`、空值、字符串不参与计算；某列无有效数字（或样本口径下样本量 < 2）则留空。
- 方差/标准差口径：
  - **样本方差** = `Σ(x-mean)² / (n-1)`，**样本标准差** = √样本方差（样本量 < 2 时留空）；
  - **总体方差** = `Σ(x-mean)² / n`，**总体标准差** = √总体方差（单条数据时方差为 0）；
  - 含义：方差衡量各笔收益率偏离平均值的离散程度，标准差与其同量纲（%），两者越大代表波动越大、结果越不稳定。

### 文件命名（含类型前缀）

- 文件名 **`{filePrefix}_买入卖出报告_YYYYMMDD_HHmm.xlsx`**，工作表名 `月季RSI6五星买卖`。
- `filePrefix` 由各页面传入（见「覆盖页面」表），用于区分不同页面下载的报表；**新增接入页面时必须给 `filePrefix` 赋值**（该字段在 `BuyPointExportOptions` 中为必填）。
- 通过 `downloadXlsx(fileName, sheetName, columns, rows)` 写出，`rows` = 明细行 + 汇总行；导出仍是**零依赖手写 OOXML**（见「关键不变量」）。
- 完成后 `message.success('「买入&卖出报告」已导出（共 N 条 ★5 信号）')`。

## 功能三：买入计划（Excel）

同一个公共模块的第二个入口，主流程与功能二**完全一致**，差异如下：

| 项 | 买入&卖出报告 | 买入计划 |
|----|---------------|----------|
| 筛选函数 | `pickPairedFiveStarBuys`（已配对 ★5） | `pickOpenFiveStarBuys` |
| 单元格口径 `mode` | `paired`（`toReportCells(item, 'paired')`） | `open` |
| 导出列 | `buildReportColumns(当前价格表头)`（含分批收益率列） | `buildBuyPlanColumns(…)`（剔除分批列、「平均收益率」→「持有至今收益率」、「年化收益率」→「持有至今年化收益率」） |
| 持有天数 / 收益列 | `point.holdingDays` / `point.returnRate`（各批卖出价 vs 买入价的平均） | `point.holdingDaysToNow` / `point.returnRateToNow`（最新交易日 vs 买入，可正可负） |
| 年化列 | `point.annualizedReturn`（缺失回退 `returnRate`） | 持有满 `annualizeMinHoldingDays`（当前 1 天）取 `calculateAnnualizedReturn(returnRateToNow, holdingDaysToNow)`，不足取 `returnRateToNow`（可正可负） |
| 「当前价格」列 | `point.latestClose`（两者相同） | `point.latestClose`（两者相同） |
| 文件名 | `{filePrefix}_买入卖出报告_….xlsx` | `{filePrefix}_买入计划_….xlsx` |
| 工作表名 | `月季RSI6五星买卖` | `月季RSI6五星买入计划` |
| 空结果提示 | 所选{label}未发现…已配对的 ★5 买卖信号 | 所选{label}暂无…尚未卖出的 ★5 买入信号 |
| 成功提示 | 「买入&卖出报告」已导出（共 N 条 ★5 信号） | 「买入计划」已导出（共 N 条 ★5 买入信号） |

**`pickOpenFiveStarBuys` 口径**：先求最近一次 ★5 配对卖出的 `sellDate`（`reduce` 取最大；无配对卖出时视为空串，小于任何日期），再保留 `level === 5 && sellDate == null && 日期 > lastSellDate` 的买入——即**当前持仓周期内尚未卖出的 ★5 买入**，同一只可有多条；更早的已配对买入不再导出。

**「持有至今」字段来源**：`fillHoldingToNow(points, latestDate, latestClose, closeValueType)`（`stockUtils.ts`）在计算层原地补充 —— **所有买点**都补 `latestDate`/`latestClose`（最新交易日 + 收盘值，即「当前价格」列与动态表头来源）；**仅未卖出**的买点另补 `holdingDaysToNow` = 买入日 → 最新交易日（至少 1 天）、`returnRateToNow` = `calculateHoldingReturnRate(买入价, latestClose, closeValueType)`（可为负）。最新交易日：个股/指数/大宗/外盘取日线中日期最大的一条（`price` 口径），基金取月线最后一条（`cumulativeReturn` 口径，故其「当前价格」列是累计收益率值）。已配对卖出的买点不补「持有至今」口径，避免与已实现口径混淆。`runBuyPointTask`（含 Worker）产出即带这些字段，页面无需额外取数。

## 导出表格样式（仅展示层）

- 生成器：`src/utils/xlsxExport.ts`（零依赖手写 xlsx）。单元格可用 `{ value, style }`，行可用 `{ cells, style, height }`；相同样式组合自动去重生成 `styles.xml`，支持字体色/加粗、填充底色、边框、数字格式、对齐、自动换行、冻结首行与自动筛选。
- 视觉规范（`buySellReportExport.ts` 顶部样式常量）：
  - 表头：深蓝底 `1F4E79` + 白字加粗 + 居中 + 自动换行，行高 45，冻结首行；
  - 明细：隔行浅灰底 `F7F9FC` + 细边框；`推荐级别` 列浅金底 + 金色 ★；收益率列红正绿负并统一 `0.00%`，`最大回撤率` 保持中性色；
  - 底部统计：`平均值 / 中位数` 琥珀底 `FFF2CC`，`样本/总体方差`、`样本/总体标准差` 浅橙底 `FCE4D6`，全部加粗；首行顶部金色中粗线分隔。
- 自动筛选范围 = 表头 + 明细行（`autoFilterRowCount = detailValues.length`），底部统计行不参与筛选。
- **只改样式，不改任何统计口径**：`toReportCells`、`averageOf`、`medianOf`、`varianceOf`、`stdDevOf`、`buildSummaryRow` 的计算与排除列规则保持原样。

## 并发

- 导出传 `concurrency: appConfig.batch.reportConcurrency`（默认 8），比「计算推荐买点」的 `appConfig.batch.concurrency`（默认 4）更高。单只耗时以 HTTP 取数为主，提高并发只是增加并行在途请求；RSI 计算仍由 Worker 池排队（`appConfig.worker.maxWorkers`，默认 4），不额外占 CPU。后端在途压力大 / 超时多时把 `reportConcurrency` 调回 4。
- 并发下单个标的失败不影响其它标的：失败者按「重试 2 次 → 跳过 → 汇总 Modal」处理（见「接口异常重试与失败汇总」）。

## 改动入口速查

| 想改什么 | 改哪里 |
|----------|--------|
| 加列 / 改列顺序 / 改列标题 | `buySellReportExport.ts` 的 `BUY_SELL_REPORT_COLUMNS` + `toReportCells`（同步下标）+ `buildReportColumns`/`buildBuyPlanColumns`（改名/插列在此）+ 视情况更新 `REPORT_SUMMARY_EXCLUDED_TITLES` |
| 改汇总行排除列 | `REPORT_SUMMARY_EXCLUDED_TITLES`（按列标题）；动态表头的「当前…价格」列通过 `buildSummaryRow` 的 `extraExcludedTitles` 排除 |
| 改「当前价格」列位置 / 表头 | `CURRENT_PRICE_INSERT_INDEX`（按标题定位）+ `runReportExport` 里 `currentPriceTitle` 的拼法 |
| 改筛选（级别 / 是否要求卖出） | `pickPairedFiveStarBuys` / `pickOpenFiveStarBuys` |
| 改「买入计划」的持有天数 / 持有至今（年化）收益率口径 | `stockUtils.ts` 的 `fillHoldingToNow`（最新交易日取值在 `buyPointCompute.ts` 的两条计算路径）+ `buySellReportExport.ts` 的 `buildBuyPlanColumns` / `toReportCells(item, 'open')` |
| 改排序 / 文件名 / 工作表名 / 提示文案 / 类型前缀 | `buySellReportExport.ts` 的 `runReportExport` 与两个导出函数；前缀值改各页面传入的 `filePrefix` |
| 改导出并发 | `src/config/appConfig.ts` 的 `appConfig.batch.reportConcurrency`（`REPORT_BATCH_CONCURRENCY` 仅作别名） |
| 改操作时间窗口 | `BuyPointActionGroup.tsx` 的 `isWeekend` / `isLastThreeDaysOfMonth`（自然日口径，只做二次确认不阻断） |
| 改接口异常重试次数 / 间隔 / 汇总弹窗 | `src/config/appConfig.ts` 的 `appConfig.batch.fetchRetryCount` / `retryDelayMs`（`recommendationBatch.ts` 内以 `FETCH_RETRY_COUNT` / `RETRY_DELAY_MS` 别名引用）；汇总弹窗文案仍在 `recommendationBatch.ts` 的 `Modal.error` |
| 改按钮 UI / 规则文案 | `BuyPointActionGroup.tsx`（名词差异靠 `itemLabel`，周线差异靠 `showWeeklyStrategy`） |
| 新增接入页面 | 复制任一页面的两个 handler + `<BuyPointActionGroup>`，补 `filePrefix`；取数函数返回 `Promise<BuyPointResult>`，空数据/无有效收盘价必须 `throw`（不要返回空结果） |
| 改买卖 / 回撤 / Calmar 口径 | `stockUtils.ts`（`analyzeMonthlyQuarterlyPercentile`、`computeHoldingDrawdown` 等）与 `buyPointCompute.ts` |
| 改配对卖出最低收益率门槛（15%） | `src/config/appConfig.ts` 的 `appConfig.rsi.sellMinReturnPct`（月&季共振与周/月单周期**共用同一门槛**）+ 判定 `isPairSellReturnSatisfied`；文案随配置插值自动更新 |
| 改 ★5 配对卖出最低持有天数（满 1 年门槛） | `appConfig.rsi.monthlyQuarterly.sellMinHoldingDays`（默认 365 自然日）+ `getMinSellHoldingDays()`（非法值兜底 1 天）；判定在 `analyzeMonthlyQuarterlyPercentile`，**仅作用于月&季 ★5 配对**，周/月单周期不受影响；页面与导出文案随配置插值自动更新 |
| 改「满 1 年」年化口径分界 | `appConfig.rsi.annualizeMinHoldingDays`（当前 **1**，等价于全部持有期按年化判定；设 365 恢复两段口径）——`isPairSellReturnSatisfied`、单周期年化收益率字段与导出「买入计划」的年化列共用 |
| 改月&季 ★5 分批卖出次数 / 间隔 | `appConfig.rsi.monthlyQuarterly.trancheCount`（默认 4，配 1 即一次性清仓）/ `trancheIntervalDays`（默认 7，配 ≤1 自动兜底为 2）+ `buildSellTranches`；列名与页面文案随配置自动同步 |
| 改 as-of 回测窗口（近 10 年） | `appConfig.rsi.asOfWindowMonths`（默认 120 个月 = 10 年）；窗口按月数而非样本条数裁剪，周线/月线都按同一时间跨度滚动 |
| 改月&季分位 as-of 口径 / 最小样本月数 | `createRollingPercentileReader` / `readMonthlyQuarterlyThresholds` / `appConfig.rsi.minSampleCount`（默认 60 个月，约 5 年）；**本项目不做买点缓存版本失效**：口径变更后旧缓存不会自动清理，需用户手动重新点「计算推荐买点」重新生成覆盖 |
| 改周/月单周期分位 as-of 口径 / 最小样本数 | `analyzeSinglePeriodPercentile`（每期 push 当期 RSI 后读阈值）/ `appConfig.rsi.minSampleCount`（默认 60，与月&季共用）；同样不做缓存版本失效，口径变更后由用户手动重新计算覆盖 |
| 改星级买入分位（★5/★3/★1） | `appConfig.rsi.monthlyQuarterly.levelRules`（默认 ★5 = 月2%/季2%、★3 = 月5%/季5%、★1 = 月10%/季10%；可分别设 `monthlyPercentile` / `quarterlyPercentile`） |
| 改周/月单周期买入卖出分位 | `appConfig.rsi.singlePeriod.weekly`（默认 1 / 90）、`appConfig.rsi.singlePeriod.monthly`（默认 3 / 90），各自独立可调 |
| 改月/季卖出分位 | `appConfig.rsi.monthlyQuarterly.monthlySellPercentile` / `quarterlySellPercentile`（默认均 90） |
| 改页面分位阈值展示方式 | `RsiFilterMark.tsx` 三处规则文案只展示分位秩、不写死数值；`stockUtils` 返回的阈值快照仅用于图表水平参考线，改展示时不要把快照当成历史各月通用阈值 |
| 改 RSI6 周期口径 / 消除未来函数 / 周键与周期定位 | `stockUtils.ts`（`calculateQuarterlyRSI6`、`calculateAsOfPeriodRSI6`、`aggregateKLineByPeriod` 的周键、`getPeriodRSIValues`）与 `RsiFilterMark.tsx` 的 tooltip 查表键 |

## 策略与指标口径

在 `src/config/appConfig.ts` 的 `appConfig.rsi` 段统一定义，改口径只改配置即可（`stockUtils.ts` 内仅做解构别名，如 `MQ_LEVEL_RULES` / `RSI_ASOF_WINDOW_MONTHS`，不再各自定义常量）：

- **RSI6 计算方式（标准 Wilder 平滑 / Wilder RSI）**：`calculateRSI` 采用「简单平均播种 + Wilder 递推」，与 TA-Lib、通达信等行情软件口径一致，**不是全程简单平均（SMA / Cutler RSI）**：
  - 第 1~period 根为预热点，固定输出 50，不参与分位与买卖判定；
  - 第 period+1 根：`avgGain = Σ前 period 个涨幅 / period`（简单平均种子），`avgLoss` 同理；
  - 之后每根：`avgGain_t = (avgGain_{t-1} × (period-1) + gain_t) / period`（Wilder 平滑，权重 α = 1/period；代码注释中的「EMA」即此递推，不是 α = 2/(period+1) 的普通 EMA）；
  - `RSI = 100 − 100/(1 + avgGain/avgLoss)`，结果夹在 0~100 并保留 2 位小数；`avgLoss=0` → 100、`avgGain=0` → 0、两者均为 0 → 50；
  - 周/月 as-of（`computeWilderStates` / `calculateAsOfPeriodRSI6`）与季 RSI6（`calculateQuarterlyRSI6`）复用同一递推与种子规则，四周期口径一致；
  - 用户可见说明位于 `Front-End/src/pages/knowledge/rsi/index.tsx` 的「RSI 计算方式」区块；`BuyPointActionGroup.tsx` 与 `RsiFilterMark.tsx` 的口径浮层同步注明该口径。
- **月&季 RSI6 共振买入分级** `appConfig.rsi.monthlyQuarterly.levelRules`（别名 `MQ_LEVEL_RULES`）：每条规则含 `monthlyPercentile` / `quarterlyPercentile`，判定为「月 RSI6 ≤ 月分位 **且** 季 RSI6 ≤ 季分位」；默认 ★5 = 月2%/季2%、★3 = 月5%/季5%、★1 = 月10%/季10%（月季默认相同，口径与旧版一致），从高到低取命中的最高级别。判定统一用 `<=` / `>=`（含等号）。
- **月&季分位阈值 as-of（近 10 年滚动窗口，无未来函数）**：`analyzeMonthlyQuarterlyPercentile` 按月顺序遍历，**先把当月月/季 RSI6 push 进 `createRollingPercentileReader`（含当月自身），再读取阈值**判定该月买点与卖出；窗口只保留「该月及之前、近 `RSI_ASOF_WINDOW_MONTHS`(120 个月 = 10 年，可配置)」的样本。因此 2014-01 的判定只使用 2004-01～2014-01 的样本，既不包含 2014-01 之后的数据，也不使用 2004 年之前的更早历史。**历史不足 10 年但满 `MQ_MIN_SAMPLE_MONTHS`(60) 个月时，窗口自然退化为全部历史**（读取器至少保留 60 个样本，不因窗口裁剪把样本删到 60 以下）。分位口径与 `roundPercentile` 一致（最近秩 `sorted[ceil(p/100*n)-1]`，两位小数）；读取器用二分查找定位插入/删除点 + 数组 `splice` 保持有序（单次 O(n)、整体 O(n²)，数百个月样本下约 1ms 量级，可忽略），push 后按秩 O(1) 取任意分位。**月、季两个窗口都需满 `MQ_MIN_SAMPLE_MONTHS`(60) 个有效样本才产生买卖信号**；因季序列在 6 个已完成季度后才开始逐月产出，实际约需 6.5 年历史才出现首个信号。函数返回的 `thresholds` / `sellThresholds` 是**最新月近 10 年窗口快照**，仅用于图表水平参考线（最新月 ★1）；页面规则文案只展示分位秩（2%/5%/10%/90%），不写死数值，避免被误读为历史各月都用同一阈值。
- **卖出分位也是 as-of**：`appConfig.rsi.monthlyQuarterly.monthlySellPercentile`(90) / `quarterlySellPercentile`(90) 只是分位秩，具体阈值同样取当月近 10 年滚动窗口快照；与买入阈值同源，不做全样本预计算。
- **卖出条件**（`analyzeMonthlyQuarterlyPercentile`）：月 RSI6 ≥ 月卖出分位(90) **且** 季 RSI6 ≥ 季卖出分位(90) **且持有满 `appConfig.rsi.monthlyQuarterly.sellMinHoldingDays`(365 天，约 1 年)** **且收益率达门槛** `appConfig.rsi.sellMinReturnPct`(15)；任一条件不满足（含持有未满 365 天）则继续持有，等下一个同时满足「RSI 超买 + 持有满期 + 收益率门槛」的信号。门槛只在**卖出信号日（第 1 批）**校验一次，后续批次不再校验卖出条件。
- **配对卖出最低收益率门槛**（`isPairSellReturnSatisfied`，两类配对共用同一判定函数与同一门槛 `appConfig.rsi.sellMinReturnPct`，两段口径）：
  - 持有 **不足年化分界**（`holdingDays < appConfig.rsi.annualizeMinHoldingDays`，当前 **1** 天，该分支实际不命中）→ 要求**区间收益率 ≥ 门槛**；
  - 持有 **满年化分界及以上**（当前配置下为全部持有期）→ 要求**年化收益率 ≥ 门槛**（`calculateAnnualizedReturn` 为 `null` 视为不满足）。
  - 月&季共振与周/月单周期共用 `appConfig.rsi.sellMinReturnPct`（默认 15），不再各自独立。
  - **月&季 ★5 配对额外叠加「持有满 sellMinHoldingDays(365)」前置门槛**：未满天数时连收益率都不校验，直接继续持有。当前年化分界为 1 天，故本策略实际总是按**年化收益率**判定；若把持有门槛改小（如 30 天）且年化分界为 365，则 30~364 天区间会按区间收益率判定、满 365 天后按年化判定。该门槛**不影响**周/月单周期策略。
  - 页面规则文案（`BuyPointActionGroup.tsx` 三处、`RsiFilterMark.tsx` 月&季/月/周三处）直接读取 `appConfig` 插值，改配置即改文案。
- **★5 顺序配对状态机**：★5买 → 卖 → ★5买 → 卖…；持仓期间出现的后续 ★5 不重复建仓，仅 ★5 参与卖出配对。**卖出必须同时满足「月/季 RSI6 双超买 + 持有满 `appConfig.rsi.monthlyQuarterly.sellMinHoldingDays`(365 天) + 收益率门槛」**，未满 365 天或收益率不达标时 `holdingFiveStarBuy` 保持持仓、等待下一个满足条件的信号（不记录该次卖出）。卖出信号成立后**分批卖出**：第 1 批为信号当日（T+0），之后按 `appConfig.rsi.monthlyQuarterly.trancheIntervalDays`(7) 天间隔依次卖出，共 `trancheCount`(4) 批；第 i 批目标日非交易日时顺延到下一个交易日的收盘价，且必须严格晚于上一批实际卖出日（避免基金等稀疏数据重复取价）。各批分别按「本批卖出价 vs 买入价」计算收益率，已执行批次的算术平均写入 `point.returnRate`（平均收益率）与 `sellTranches`；后续行情未到的批次 `executed=false`、不参与平均。`sellDate`/`sellPrice`/`sellMonthlyRsi`/`sellQuarterlyRsi` 仍取信号当日。
- **分批卖出配置为 1**：不生成分批列，行为与改造前一次性清仓一致。
- **季 RSI6 为「季初→当月」逐月序列**：季 RSI6 与月 K 线一一对应（每个自然月一条），键为 `YYYY-MM`；**不再**使用「整季口径 + 季度未走完回退已完成季度」的旧口径（详见下一节）。
- **单周期策略**（周/月，`analyzeSinglePeriodPercentile`）：周 1/90、月 3/90（配置见 `appConfig.rsi.singlePeriod`，各自独立可调），同样是「≥ 卖出分位 **且收益率达门槛** `appConfig.rsi.sellMinReturnPct`(15)」才卖出，持仓期间重复买入记为加仓。
  - **同样是 as-of 近 10 年滚动窗口**：每一期先把当期周/月 RSI6 push 进 `createRollingPercentileReader`（含当期自身），再用「当期及之前、近 `appConfig.rsi.asOfWindowMonths`(120 个月 = 10 年)」的样本读取买入/卖出阈值，不使用该期之后的数据；历史信号不重绘。历史不足 10 年但满 `appConfig.rsi.minSampleCount`(60) 个有效样本时使用全部历史；有效样本不足 60 时不产生信号（样本过少分位会退化为极值）。
  - 返回的 `threshold` 是**最新一期近 10 年窗口快照**，仅用于图表水平参考线；页面规则文案只展示分位秩（周 1%/90%、月 3%/90%）。
- **预热点**：`appConfig.rsi.warmup = 6`（别名 `rsiWarmup`）。月序列在分位计算前必须 `slice(rsiWarmup)` 剔除前 6 个固定 50 的无效点；季序列由 `calculateQuarterlyRSI6` 内部已排除预热点（前缀不足 6 个已完成季度不出值），**不再重复 slice**。
- **派生指标**（price 口径）：
  - 持有天数 = 买入日 → **首笔卖出信号日**（不因后续批次延长）；月&季 ★5 配对因卖出需满 `MQ_SELL_MIN_HOLDING_DAYS`(365)，该值必然 ≥ 365
  - 收益率 = 平均收益率 = `calculateHoldingReturnRate` 对每个已执行批次计算后取算术平均（各批卖出价 vs 同一买入价）
  - 年化收益率：`calculateAnnualizedReturn(平均收益率, holdingDays)`，**仅持有 ≥ `getMinSellHoldingDays()`（默认 365）**才计算，否则为 `null`（月&季 ★5 配对实际恒满足）
  - 最大回撤率：`computeHoldingDrawdown`，以★5买入点收盘价为基准，窗口为「买入日 → 卖出信号日」（未卖出则至最新交易日），取低于买入价的最低收盘价；全程未跌破买入价则无值
  - 被套天数 = 买入日 → 回撤最低点的日历天
  - 回本日期 = 最大回撤最低点之后、首个**收盘价 ≥ 买入价**的交易日（等于买入价即不亏钱）；区间内一直未回本则无值（导出 `-`）
  - 最大回本持有天数（日历天）= 持有期内多次跌破买入价时，取「跌破 → 回本」最长一段的天数；只统计已回本的连续水下区间，全程未跌破买入价或没有已回本区间时无值（导出 `-`）
  - Calmar = 年化收益率 / 最大回撤率（年化为空或无回撤时不计算）
  - **导出层展示回退**：持有天数 `< appConfig.rsi.annualizeMinHoldingDays`（当前 1 天，实际不命中）时「年化收益率」列直接展示与「平均收益率」相同的数值；Calmar 列在该情况下展示「平均收益率 / 最大回撤率」，否则年化缺失或无回撤时仍为 `-`
- **基金口径**：`closeValueType: 'cumulativeReturn'`，收盘取「累计收益率」；回撤类指标复用 `computeHoldingDrawdown(..., 'cumulativeReturn')`，先把累计收益率折算为「净值 = 100 + 收益率」再按价格口径比较，因此负收益率不会被当成负价格；数据只有月/季两个周期，无日、无周（详见「基金数据粒度」），故 `weeklyPercentile` 恒为空串、页面 `showWeeklyStrategy={false}`、回填 3 类买点列。基金分批卖出的取价序列也是该稀疏序列（`priceSeries: mappedData`），7 天间隔会顺延到后续可用数据点，且「严格晚于上一批」避免重复取价。

## RSI6 未来函数（look-ahead bias）修复

**问题**：整周期口径下每个周/月/季只产出一根周期 K 线（日期=周期最后一天）。若把周期内某一天直接匹配到该周期末 K 线，等于**用该天之后的未来数据**算当天的周/月/季 RSI6。三处已统一按「周期初→当日 / 季初→当月」截断口径修复，全部在 `stockUtils.ts`：

| 周期 | 计算函数 | 口径 | 输出粒度 / 查表键 |
|------|----------|------|-------------------|
| 日 | `calculateDailyRSI6` | 逐日 Wilder | 每交易日一条，键 `YYYY-MM-DD` |
| 周 | `calculateAsOfPeriodRSI6(daily, 周K线)` | 已完成周前缀 + 当前周「周初→当日」截断 | **逐日**一条，键 `YYYY-MM-DD` |
| 月 | `calculateAsOfPeriodRSI6(daily, 月K线)` | 已完成月前缀 + 当前月「月初→当日」截断 | **逐日**一条，键 `YYYY-MM-DD` |
| 季 | `calculateQuarterlyRSI6` | 已完成季前缀 + 当前季「季初→当月」截断 | **逐月**一条，键 `YYYY-MM`（与月 K 一一对应） |

- **`calculateAsOfPeriodRSI6`（日→周、日→月）**：`computeWilderStates` 先预计算「每根周期 K 线处理完后的 Wilder 递推状态」；遍历日 K 时每天只用「上一已完成周期状态」+「当日相对上一周期末的涨跌」做**一次** Wilder 步进 → 复杂度 `O(日K数 × log 周期数)`，不随「周期数 × 日数」放大。周期末当天的截断序列即整周期序列，结果与 `calculateWeeklyRSI6` / `calculateMonthlyRSI6` 逐点一致。
- **周期定位用二分查找，不依赖输入顺序**：每个交易日独立在周期 K 线日期数组上二分定位「首个 ≥ 当日的周期 K 线」。早期版本用只增不减的单调指针（假定 `dailyData` 升序），**倒序输入会静默错值**——已改为二分查找消除该隐患。
- **`calculateQuarterlyRSI6`**：先按月聚合，按自然季度推进；对当前季度内每个自然月，用「已完成季度前缀 + 当月收盘」算 Wilder RSI6 取末点。季末月结果与旧整季口径一致，但 1~2 月不再偷看 3 月等未来数据（4~6 月不偷看 6 月、…）。
- **周分组键必须用 ISO `weekYear()`**：`aggregateKLineByPeriod` 的周键为 `${date.weekYear()}-W${date.week()}`。本项目 moment locale 为 `dow:0, doy:6`（周日为一周首日），跨年周（如 `2014-12-29`~`2015-01-02` 同属一周）若用日历 `year()` 会被拆成两组、并与同年 12 月合并 → 周 K 日期错位、周 RSI6 取到错误的「上一完成周」。**所有周匹配键（聚合、`RsiFilterMark` 的 tooltip 查表）必须统一为 `weekYear()+week()`。**
- **周期值直查**：`getPeriodRSIValues` 用 `Map.get` O(1) 取值，缺失兜底 100（不满足任何买点）。
- **季线渲染**：季 RSI6 已是逐月序列，折线按逐月点用 `smooth` 连成连续曲线，**不再**是跨季度的水平阶梯。
- **日期解析一律用 `moment`，禁止 `new Date('YYYYMMDD')`**：`new Date('20111031')` 在不同引擎下会得到 `Invalid Date`，导致 `holdingDays` 变成 `NaN`、卖出的「满最低持有天数」判定永远不成立（★5 永不配对卖出）。`aggregateKLineByPeriod` 排序、`analyzeSinglePeriodPercentile`、`analyzeMonthlyQuarterlyPercentile` 均已改为 `moment(日期).valueOf()`，兼容 `YYYY-MM-DD` 与 `YYYYMMDD` 两种输入。

## 关键不变量与易错点

- **列顺序必须与表头一一对应**：`toReportCells` 的取值顺序须逐项匹配 `BUY_SELL_REPORT_COLUMNS`。曾出现「卖出三列整体错位」的线上问题（`卖出收盘价` 列装成月RSI6、`卖出季RSI6` 列装成卖出价），改动列顺序或新增列时务必同步两处。
- 新增/删除列时同步三处：`BUY_SELL_REPORT_COLUMNS`、`toReportCells`、`REPORT_SUMMARY_EXCLUDED_TITLES`。
- 导出仍是**零依赖手写 OOXML**（`xlsxExport.ts`，inlineStr + 不压缩 ZIP）：仓库约定**不引入 xlsx 依赖、不改 `package.json` 版本（含 react）**，新增导出能力优先复用 `downloadXlsx`。
- 所有买点计算必须走 Worker 池（`computeBuyPoints`），禁止在主线程同步跑 RSI/分位，否则页面卡顿。
- 详情页 `RsiFilterMark` 的重计算走**独立的单 Worker**（`createRsiDetailWorker`，每个实例独占 1 个 Worker），计算期间展示 loading，完成后移除；图表配置（含函数）与 `rsiStats` 仍在主线程构造。
- 详情页单 Worker 与列表页 Worker 池（`computeBuyPoints`）互相独立；不要把 `RsiFilterMark` 接回列表页池。
- `computeBuyPoints` 返回的 `BuyPointResult` 必须带上 `mqBuyPoints` 明细（含卖出与回撤字段），报告导出依赖它。页面取数函数**不要 catch 后返回空结果**（会静默漏标的）；接口异常/空数据一律 `throw`，由批量编排重试并弹 Modal 汇总。正常计算路径返回的 `BuyPointResult` 由计算层保证字段齐全。
- 删除页面上的旧按钮后，注意清理随之失效的局部状态（如 `calculating`），否则 `noUnusedLocals` 报 `TS6133`。
- 三个入口的按钮与规则文案必须留在 `BuyPointActionGroup.tsx` 单点维护，各页面不要复制样式或文案；时间窗口与二次确认也在该组件内，接入页面无需重复实现。
- Worker 池（`buyPointWorker.ts`）上限由 `appConfig.worker.maxWorkers`（默认 4）控制：`size = Math.min(MAX_WORKERS, Math.max(1, navigator.hardwareConcurrency - 1))`，即最多 4 个、低核机器取 `core-1`；Worker 按需懒创建（首次提交任务时建池）、空闲槽位复用，`pump()` 循环派发等待队列。按用户确认**保持受限并发**，不要再改成按核心数动态扩容。
- 列表页 Worker 池是**模块级**的，一个浏览器标签页一份 JS realm → **每个标签页各自独立一个池**（多开 tab 互不干扰，无需额外多实例化）。详情页由 `window.open` 打开 → 同样独立 realm，且不使用该池，而是每个 `RsiFilterMark` 实例创建自己的单 Worker（见下节）。

## 详情页 RSI6（RsiFilterMark）单 Worker + 加载态

- `RsiFilterMark`（个股/指数/基金/大宗商品详情页复用；基金 `收盘` 即累计收益率）的重计算统一放入**每个组件实例独占的 1 个 Worker**，避免主线程同步 RSI 计算卡顿。
- 模块分工：
  - 计算内核 `Front-End/src/utils/rsiDetailCompute.ts`：`runRsiDetailTask(task)` 返回可结构化克隆的 `RsiDetailResult`。
  - Worker 入口 `Front-End/src/workers/rsiDetail.worker.ts`：只做消息收发。
  - 客户端 `Front-End/src/utils/rsiDetailWorker.ts`：`createRsiDetailWorker()` 返回 `{ compute, terminate }`，内部持有 1 个 Worker。
- 协议：主线程 → Worker `{ id, task }`；Worker → 主线程 `{ id, ok, result?, error? }`（类型见 `RsiDetailWorkerRequest/Response`）。
- `RsiDetailResult` 字段：`mainChartData`、`buyPointList`（index/fund 已按月折叠）、`periodRSI`（日/周/月/季）、`weeklyThreshold`/`weeklyTrades`、`monthlyThreshold`/`monthlyTrades`、`mqBuyPoints`/`mqThresholds`/`mqSellThresholds`。
- **图表配置（含函数）必须在主线程构造**；Worker 只做 RSI 重算与分位/配对，`rsiStats` 也由主线程从 `periodRSI` 计算（口径不变）。
- **生命周期：切数据即终止重建（最新优先）**。`useEffect([dataSignature, type])` 内创建 Worker，cleanup 中 `client.terminate()` 立即取消旧任务；下一次数据变化再创建新 Worker。每个页面任意时刻最多 1 个该 Worker。
- **就绪判断用「内容签名」而非数组引用**：`dataSignature = `${type}|${data.length}|${data[0]?.日期}|${data[data.length-1]?.日期}|${data[0]?.收盘}``。state 存 `{ signature, result }`，`matchedResult = detail?.signature === dataSignature ? detail.result : null`。父组件重建等值数组不会重复计算；签名不同即旧结果立即失效，loading 先出现，不闪现上一只标的的图表。
- 三态判定：`isLoading = Boolean(data?.length) && (!detail || detail.signature !== dataSignature)`；Worker 成功写入 `{ signature, result }`；失败写入 `{ signature, result: null }`（`isLoading` 退出，渲染空图表，不会永久 loading）。
- hooks 顺序：新增 `useMemo`/`useState`/`useEffect` 放在所有 early return 之前；early return 依次为 `if (!data?.length)`（暂无数据）→ `if (isLoading)`（Spin + 文案），全部在所有 hooks 之后。
- 多标签页：详情页由 `window.open` 打开 → 新标签页 = 独立 JS realm，每个页面各自创建自己的 Worker；多开不同 `code` 的 `/stock/a/index/detail` 天然并行、互不干扰，无需额外多实例化。
- 口径约束：`RsiFilterMark` 对基金同样是直接对传入 `data`（收盘=累计收益率）调用 `calculatePeriodRSI`，**不**做「先按月折叠再算 RSI」，迁移/改动时须逐行复刻、不得改口径。

### 各周期 RSI6·历史分位参考（概览区）

- 每个可见周期一张卡片（日/周/月/季），卡片内是 **4 行小表格**：全历史 / 近10年 / 近5年 / 近3年。
- 每行展示各分位（默认 `2% / 5% / 10% / 90%`，见 `appConfig.chart.rsiPercentileRefs`）与当前值在该窗口的分位位置（0~100%）；表头只写 `2%` / `90%`，不再带「分位」二字，避免窄卡片内折行。
- 卡片头部：仅展示当前 RSI6 大数字（已去掉「当前 · 全历史位置 x%」副文案，也不再展示超买/超卖状态）。
- 分位列完全由 `appConfig.chart.rsiPercentileRefs`（升序数组）驱动：表头、单元格、grid 列模板（`RSI_PERCENTILE_GRID_TEMPLATE = '44px repeat(N, 1fr) 1fr'`）都按该数组动态生成，增删分位不需要改组件。
- 窗口锚点：取样本最后一个数据点的时间（`anchorMs = points[points.length-1].time`），**不是当前自然日**；截止时间 = 锚点回推 N 年，按数据点时间戳 `>= cutoff` 过滤。这样选择「样本区间」后，卡片里的「近10年」列与买点判定用的 as-of 近 10 年滚动窗口口径一致（区间结束于 2018-12 时，近 10 年就是 2008-12～2018-12，而非 2016-10～2018-12）。
- 不展示规则：数据起点（剔除 `rsiWarmup` 后的第一个有效点）晚于 cutoff，或窗口内无有效点 → 该窗口整行不渲染；`全历史` 行始终展示。
- 布局约束：**一屏内不出现左右滚动**，用 CSS Grid 而非 flex：容器 `display: 'grid'` + `gridTemplateColumns: repeat(N, minmax(0, 1fr))` + `gap: 8`，卡片 `minWidth: 0`。列数由 `resolveRsiCardColumns(rsiStats.length)` 决定：**4 个周期 → 2 列（上下 2 行 × 2 个）**、3 个 → 3 列一行、2 个 → 2 列一行、1 个 → 1 列。表格首列 `44px`、末尾位置列 `1fr`、`columnGap: 4`，表头 11px / 数据 12px；卡片标题 14px、当前值 24px。历史上曾用 `minWidth: 300` + `nowrap + overflowX: 'auto'`，导致 4 张卡片总宽超容器、出现横向滚动条，已修正。
- 样式约束：分位 `toFixed(2)`、位置一位小数并带 `%`；等宽数字 `tabular-nums`；表头与单元格 `whiteSpace: 'nowrap'`。
- 表头口径 tooltip：分位列表头带虚下划线 + `cursor: help`，hover 说明「最近秩法不插值」；「位置」表头右侧另挂 `InfoCircleOutlined` 图标（10px 灰色），hover 图标弹出位置口径说明（≤ 当前值的样本占比，即经验分位）。因分位列取整、样本有限（如 116 个样本时 2% 取第 3 个样本），同一当前值可能同时显示「2% 阈值 = 当前值」与「位置 2.6%」，两者口径不同但都正确，不是精度问题。常量 `RSI_PERCENTILE_TIP` / `RSI_POSITION_TIP` 在组件内定义。
- 该分位参考**仅用于展示**，不参与买点/卖点判定；月&季与周/月单周期策略的阈值均已改为 as-of 近 10 年滚动窗口（见「策略与指标口径」）。as-of 改造评估见 `.trae/documents/月季RSI6分位阈值未来函数分析.md`。

## 已知偏差（改动策略前必读）

- **月&季 RSI6 百分位策略已改为 as-of 近 10 年滚动窗口**：`analyzeMonthlyQuarterlyPercentile` 的买/卖阈值只依赖「当月及之前、近 `appConfig.rsi.asOfWindowMonths`(120) 个月」的样本，历史买点可复现、不含未来数据；历史不足 10 年但满 `appConfig.rsi.minSampleCount`(60) 时用全部历史，不足 60 不产生信号。分析结论见 `.trae/documents/月季RSI6分位阈值未来函数分析.md`。
- **周/月单周期百分位策略也已改为 as-of 近 10 年滚动窗口**：`analyzeSinglePeriodPercentile` 每期只用当期及之前、近 120 个月的样本算阈值（含当期自身），历史不足 10 年时用全部历史，`appConfig.rsi.minSampleCount`(60) 前不产生信号；历史信号可复现、不含未来数据。口径变更后旧缓存不自动失效，需手动重新点「计算推荐买点」覆盖。
- 当期未走完的月/周 K 会被当作已完成 K 线参与计算，最新一期信号为暂定值；回测/导出口径另有生存者偏差、选择偏差、无交易成本等问题。
- 改策略时不要只看全样本回测收益，需同时评估「截至当期（近 10 年滚动窗口）」口径与参数敏感性（`appConfig.rsi.asOfWindowMonths` 建议测 60 / 120 / 240 三档；另需覆盖「历史不足 10 年回退全部历史」的标的）。

## 验证方法

1. 类型检查：`cd Front-End && npx tsc --noEmit -p tsconfig.app.json`（仓库有大量历史遗留报错，只关注本次改动是否新增；`OutTrading.tsx` 等页面操作列 `render: (_, record)` 的 `TS7006` 属历史遗留）。
2. 导出逻辑回归（推荐，可离线复现真实结果）：用 `npx esbuild <test.ts> --bundle --format=esm --platform=node --tsconfig=tsconfig.app.json --alias:@=./src` 打包临时脚本，在 Node 中 `import { runBuyPointTask } from '@/utils/buyPointCompute'`，喂入真实日线（腾讯 `ak.stock_zh_a_hist_tx(symbol, adjust='hfq')`），断言：`卖出收盘价 == sellPrice`、`卖出月/季RSI6 落在 0~100`、**所有 `sellDate != null` 的行 `holdingDays >= MQ_SELL_MIN_HOLDING_DAYS`（365，满 1 年门槛）**、满 1 年时年化收益率 ≥ 15（`MQ_SELL_MIN_RETURN_PCT`）；分批卖出断言：`sellTranches.length === MQ_SELL_TRANCHE_COUNT`、已执行批次卖出日严格递增、`returnRate` = 已执行批次收益率算术平均、后续无数据时 `executed=false` 且不参与平均。
   还可构造合成数据断言门槛可配置性：在当前 `annualizeMinHoldingDays=1` 下，买入后持有「区间收益率 20% / 30 天」应因年化 < 15% **不出**卖出；把价格改为持有 1 年、区间收益率 20%（年化 20%）→ 出卖出。若临时把 `annualizeMinHoldingDays` 改为 365，则持有 30 天、区间收益率 20% 的场景应立即配对卖出（按区间收益率判定）。**注意断言必须读取 `appConfig.rsi.annualizeMinHoldingDays`，不要写死 365。**
3. 浏览器实测：切到对应 Tab（个股/指数/港股在「自选/分组」，基金在「自选基金」，大宗商品在页面顶部），确认按钮组渲染、`itemLabel` 名词正确、基金仅 3 条规则文案（无周 RSI6 条）；勾选后点导出，用 `openpyxl` 或直接解压 `.xlsx` 检查文件名前缀、列名顺序与底部 6 行汇总（平均值 / 中位数 / 样本方差 / 样本标准差 / 总体方差 / 总体标准差）。
4. RSI6 口径自测（验证消除未来函数）：喂入真实日线后，把数据**截断到某月末最后一个交易日**、重算周/月/季序列取末值作为 oracle，断言与 `calculateAsOfPeriodRSI6` / `calculateQuarterlyRSI6` 的同日值**逐点相等**；再把 `dailyData` **倒序 / 乱序**传入，断言按日期对齐的结果与升序**完全一致**（检验二分定位不依赖输入顺序）。
5. 时间窗口实测：工作日点「计算推荐买点」应弹「非周末时间」确认框，取消则不动、确认则开始计算；非月底点两个导出应弹「非月底时间」确认框；周末 / 每月最后 3 个自然日则直接执行。可临时改系统日期或用 `moment` 注入验证边界（29/30/31、28/29/30、26/27/28）。
6. 异常重试实测：把接口临时改为错误地址或返回空数组，断言进度提示最终变为「成功 X/Y，失败 Z」，并弹出 `Modal.error` 汇总「【代码】名称：原因」；确认该标的被跳过、其它标的仍正常完成。
7. 汇总统计自测：`[10,20,30]` 断言样本方差 100、样本标准差 10、总体方差 66.67、总体标准差 8.16；样本量 1 时样本口径留空、总体方差为 0；价格/日期列留空；`'-'`/空串不参与统计；汇总行只基于明细行（中位数不被平均值行污染）。
8. 月&季 as-of 滚动窗口 oracle 自测：取真实月/季 RSI6 序列，对每个判定月 m 构造「m 及之前、近 `RSI_ASOF_WINDOW_MONTHS` 个月」的样本切片（按日期回推，含当月；切片样本数至少 `MQ_MIN_SAMPLE_MONTHS` 个），直接用 `roundPercentile` 重算 ★5/★3/★1 与 90% 卖出阈值，断言与 `analyzeMonthlyQuarterlyPercentile` 该月的买点分级、卖出触发**完全一致**。另需覆盖三类断言：① **eviction**（窗口滚动确实生效）：历史超过 120 个月的标的，其最新月阈值快照 **不等于** 用全部历史算出的分位；窗口内样本恰为 120 个；② **不足 10 年回退全部历史**：有效历史 < 120 个月（但 ≥ 60 个月）时，最新快照等于全历史分位；③ **截断不变性**：把序列截断到任意历史月份重算，截断前该月及之前已完成的买点、卖出配对完全不变；同时断言前 `MQ_MIN_SAMPLE_MONTHS - 1` 个有效月内无任何买卖信号。
9. 周/月单周期 as-of 滚动窗口自测：对 `analyzeSinglePeriodPercentile` 的每笔买入/卖出，按成交日构造「当期及之前、近 `RSI_ASOF_WINDOW_MONTHS` 个月」的 RSI 切片并用 `roundPercentile` 重算阈值，断言买入 RSI ≤ 当期买入阈值、卖出 RSI ≥ 当期卖出阈值；注意周线按**日期**回推 120 个月（约 520 条周样本），月线约 120 条，不要按固定条数切。另断言：有效样本 < `SINGLE_PERIOD_MIN_SAMPLE_COUNT` 时 `trades` 为空；最新 `threshold` 为**最新窗口快照**（历史超 120 个月时 ≠ 全历史分位）；序列截断到中期日期重算，已完成交易的买入日/卖出日/收益率完全不变。
10. as-of 窗口可配置性自测：临时把 `appConfig.rsi.asOfWindowMonths` 改为 60 与 240，断言同一标的的买点数量/日期随窗口变化，且窗口越小越贴近近期样本；恢复默认 120 后再跑一次，确认结果与改动前一致（确定性、无随机性）。
11. 自动化回归：`cd Front-End && npm test`（根目录 `yarn test` 等价），执行 `Front-End/test/*.test.ts`：
    - `asof-rolling.test.ts`：滚动窗口 / RSI6 数学 / 消除未来函数 / 月季共振 as-of / 单周期 as-of / 分批卖出边界 / 回撤口径。
    - `stockUtils-extra.test.ts`：通用工具函数、YYYYMMDD 日期兼容回归（单周期与月&季 ★5 均能正常配对卖出、`holdingDays` 非 NaN）。
    - `buyPointCompute.test.ts`：个股/指数/大宗商品日线路径与基金累计收益率路径、★5 三重卖出条件、回撤派生字段、确定性。
    - `buySellReportExport.test.ts`：买入&卖出报告 / 买入计划列构建与 ★5 配对筛选。
    通过标准：每个文件输出 `汇总：通过 N / 失败 0`，`npm test` 退出码为 0。
