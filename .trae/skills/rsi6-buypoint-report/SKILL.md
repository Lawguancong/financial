---
name: rsi6-buypoint-report
description: 维护各行情页（A股/港股个股与指数、大宗商品、外盘期货、开放式基金）的「计算推荐买点」「导出买入&卖出报告（Excel）」「导出买入计划（Excel）」三入口，覆盖 RSI6 多周期买点计算、Worker 池批量编排、★5 月季共振买卖配对、回撤等派生指标、Excel 导出与文件名前缀约定。当用户要求新增或调整买点计算、导出买卖报告/买入计划、修改报告列或策略买卖规则、或在其它页面接入这三个入口时调用。不用于新增行情图表页或纯 K 线展示功能。
---

# RSI6 买点计算与买入卖出报告

列表页底部并排的三个操作入口，**计算内核完全相同**（`runRecommendationBatchCalculation` + 同一 Worker 池），差别只在「写回表格」与「导出 Excel 的筛选口径」。

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
| 三按钮 + 规则文案 UI | `Front-End/src/components/BuyPointActionGroup.tsx`（`itemLabel` 适配名词、`showWeeklyStrategy` 控制「回填 3/4 类买点列」与周策略文案） |
| 导出主流程（筛选 / 排序 / 单元格 / 汇总 / 下载 / 提示 / 文件名前缀） | `Front-End/src/utils/buySellReportExport.ts`（`exportBuySellReport` / `exportBuyPlan`） |
| 批量并发编排 | `Front-End/src/utils/recommendationBatch.ts` 的 `runRecommendationBatchCalculation` |
| Worker 池客户端 | `Front-End/src/utils/buyPointWorker.ts` 的 `computeBuyPoints`（池上限 4） |
| Worker 内纯计算 | `Front-End/src/utils/buyPointCompute.ts` 的 `runBuyPointTask`（`BuyPointResult`） |
| 策略与指标口径 | `Front-End/src/utils/stockUtils.ts` |
| 零依赖 xlsx 写入 | `Front-End/src/utils/xlsxExport.ts` 的 `downloadXlsx` |

数据链路：页面 → `runRecommendationBatchCalculation`（受限并发）→ 页面取数函数（HTTP 取数）→ `computeBuyPoints`（Worker 池计算）→ 结果回主线程 → 回写表格 / 生成 Excel。

**接入新页面**：页面只需提供 `targets / getCode / getName / getKey / fetchPoints / emptyWarn / itemLabel / filePrefix`，其余全部由公共模块处理；页面取数函数返回类型必须为 `Promise<BuyPointResult>`，其空数据与异常兜底分支必须补 `mqBuyPoints: []`。UI 侧直接渲染 `<BuyPointActionGroup onCalculate onExportReport onExportPlan itemLabel filePrefix… />`。

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

### 列 → 字段映射（`toReportCells`，19 列）

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
| 持有天数 | `point.holdingDays` | 整数，缺失写 `''` |
| 收益率 | `point.returnRate` | 保留 2 位 |
| 年化收益率 | `point.annualizedReturn`，为空回退 `returnRate` | 保留 2 位 |
| 最大回撤率 | `point.maxDrawdown` | 缺失写 `'-'` |
| 最大回撤的日期 | `point.maxDrawdownDate` | 缺失写 `'-'` |
| 最大回撤的收盘价 | `point.maxDrawdownClose` | 缺失写 `'-'` |
| 买点到最大回撤率的被套天数 | `point.daysToMaxDrawdown` | 缺失写 `'-'` |
| Calmar比率（年化收益 / 最大回撤） | `point.calmarRatio`，持有不足 1 年回退 `returnRate` | 缺失写 `'-'` |

- **顺序即表头顺序**：`toReportCells` 返回数组的下标必须与 `BUY_SELL_REPORT_COLUMNS` 逐项对齐，这是最易改错的一处（详见「关键不变量」）。
- 展示回退：持有天数不足 1 年时，「年化收益率」与「Calmar比率」两列都直接展示**与「收益率」相同**的数值（无法年化 / 回撤为空）；满 1 年但无回撤时 Calmar 仍写 `'-'`。
- 基金走 `cumulativeReturn` 口径，`computeFundBuyPoints` **不计算回撤类字段**，故基金的「最大回撤率 / 最大回撤的日期 / 最大回撤的收盘价 / 被套天数 / Calmar」列多为 `-`；且基金数据只有月/季（无日、无周），`weeklyPercentile` 恒为空串。

### 平均值汇总行（`buildAverageRow`）

- 追加为**最后一行**：首列写「平均值」。
- 按**列标题**判断是否取均值（`REPORT_AVERAGE_EXCLUDED_TITLES`，不写死下标，避免加列错位）：代码、名称、推荐级别、买入日期、卖出日期、最大回撤的日期（文本/日期列），以及 买入收盘价、卖出收盘价、最大回撤的收盘价（价格类列不取均值）一律留空。
- 其余数值列取均值并保留 2 位；`'-'`、空值、字符串不参与计算；某列无有效数字则留空。

### 文件命名（含类型前缀）

- 文件名 **`{filePrefix}_买入卖出报告_YYYYMMDD_HHmm.xlsx`**，工作表名 `月季RSI6五星买卖`。
- `filePrefix` 由各页面传入（见「覆盖页面」表），用于区分不同页面下载的报表；**新增接入页面时必须给 `filePrefix` 赋值**（该字段在 `BuyPointExportOptions` 中为必填）。
- 通过 `downloadXlsx(fileName, sheetName, columns, rows)` 写出，`rows` = 明细行 + 汇总行；导出仍是**零依赖手写 OOXML**（见「关键不变量」）。
- 完成后 `message.success('「买入&卖出报告」已导出（共 N 条 ★5 信号）')`。

## 功能三：买入计划（Excel）

同一个公共模块的第二个入口，主流程与功能二**完全一致**，只有三处不同：

| 项 | 买入&卖出报告 | 买入计划 |
|----|---------------|----------|
| 筛选函数 | `pickPairedFiveStarBuys`（已配对 ★5） | `pickOpenFiveStarBuys` |
| 文件名 | `{filePrefix}_买入卖出报告_….xlsx` | `{filePrefix}_买入计划_….xlsx` |
| 工作表名 | `月季RSI6五星买卖` | `月季RSI6五星买入计划` |
| 空结果提示 | 所选{label}未发现…已配对的 ★5 买卖信号 | 所选{label}暂无…尚未卖出的 ★5 买入信号 |
| 成功提示 | 「买入&卖出报告」已导出（共 N 条 ★5 信号） | 「买入计划」已导出（共 N 条 ★5 买入信号） |

**`pickOpenFiveStarBuys` 口径**：先求最近一次 ★5 配对卖出的 `sellDate`（`reduce` 取最大；无配对卖出时视为空串，小于任何日期），再保留 `level === 5 && sellDate == null && 日期 > lastSellDate` 的买入——即**当前持仓周期内尚未卖出的 ★5 买入**，同一只可有多条；更早的已配对买入不再导出。

## 并发

- 导出传 `concurrency: REPORT_BATCH_CONCURRENCY`（8），比「计算推荐买点」的默认 4 更高。单只耗时以 HTTP 取数为主，提高并发只是增加并行在途请求；RSI 计算仍由 4 个 Worker 排队，不额外占 CPU。后端在途压力大 / 超时多时把它调回 4。

## 改动入口速查

| 想改什么 | 改哪里 |
|----------|--------|
| 加列 / 改列顺序 / 改列标题 | `buySellReportExport.ts` 的 `BUY_SELL_REPORT_COLUMNS` + `toReportCells`（同步下标）+ 视情况更新 `REPORT_AVERAGE_EXCLUDED_TITLES` |
| 改汇总行排除列 | `REPORT_AVERAGE_EXCLUDED_TITLES`（按列标题） |
| 改筛选（级别 / 是否要求卖出） | `pickPairedFiveStarBuys` / `pickOpenFiveStarBuys` |
| 改排序 / 文件名 / 工作表名 / 提示文案 / 类型前缀 | `buySellReportExport.ts` 的 `runReportExport` 与两个导出函数；前缀值改各页面传入的 `filePrefix` |
| 改导出并发 | `REPORT_BATCH_CONCURRENCY` |
| 改按钮 UI / 规则文案 | `BuyPointActionGroup.tsx`（名词差异靠 `itemLabel`，周线差异靠 `showWeeklyStrategy`） |
| 新增接入页面 | 复制任一页面的两个 handler + `<BuyPointActionGroup>`，补 `filePrefix`；取数函数返回 `BuyPointResult` 并补 `mqBuyPoints: []` 兜底 |
| 改买卖 / 回撤 / Calmar 口径 | `stockUtils.ts`（`analyzeMonthlyQuarterlyPercentile`、`computeHoldingDrawdown` 等）与 `buyPointCompute.ts` |

## 策略与指标口径

在 `stockUtils.ts` 中定义，改口径只改常量即可：

- **月&季 RSI6 共振买入分级** `MQ_LEVEL_RULES`：★5 = 月/季 RSI6 同时 ≤ 3% 分位、★3 = ≤ 5%、★1 = ≤ 10%，从高到低取命中的最高级别。判定统一用 `<=` / `>=`（含等号）。
- **卖出条件**（`analyzeMonthlyQuarterlyPercentile`）：月 RSI6 ≥ `MONTHLY_RSI_SELL_PERCENTILE`(85) **且** 季 RSI6 ≥ `QUARTERLY_RSI_SELL_PERCENTILE`(85) **且 区间收益率 > 0（卖出价高于买入价）**；不满足盈利条件则继续持有，等下一个更高价格的卖出信号。
- **★5 顺序配对状态机**：★5买 → 卖 → ★5买 → 卖…；持仓期间出现的后续 ★5 不重复建仓，仅 ★5 参与卖出配对。
- **季度对齐**：每个月取「所在自然季度」的季末 RSI6（1~3 月取 3 月最晚、4~6 月取 6 月最晚、7~9 月取 9 月最晚、10~12 月取 12 月最晚），季度未走完时回退最近一个已完成季度；与季RSI6 vh 阶梯折线、shared tooltip 查表同口径。
- **单周期策略**（周/月，`computeSinglePeriodPercentileTrades`）：周 1/90、月 3/90，同样是「≥ 卖出分位 **且** 收益率 > 0」才卖出，持仓期间重复买入记为加仓。
- **预热点**：`rsiWarmup = 6`，计算分位前必须 `slice(rsiWarmup)` 剔除前 6 个固定 50 的无效点。
- **派生指标**（price 口径）：
  - 持有天数、收益率 = `calculateHoldingReturnRate`
  - 年化收益率：`calculateAnnualizedReturn`，**仅持有 ≥ 365 天**才计算，否则为 `null`
  - 最大回撤率：`computeHoldingDrawdown`，以★5买入点收盘价为基准，窗口为「买入日 → 卖出日」（未卖出则至最新交易日），取低于买入价的最低收盘价；全程未跌破买入价则无值
  - 被套天数 = 买入日 → 回撤最低点的日历天
  - Calmar = 年化收益率 / 最大回撤率（年化为空或无回撤时不计算）
  - **导出层展示回退**：持有不足 1 年时「年化收益率」列直接展示与「收益率」相同的数值；Calmar 列在持有不足 1 年时同样展示与「收益率」相同，满 1 年但无回撤仍为 `-`
- **基金口径**：`closeValueType: 'cumulativeReturn'`，收盘取「累计收益率」；数据只有月/季两个周期，无日、无周（详见「基金数据粒度」），故 `weeklyPercentile` 恒为空串、页面 `showWeeklyStrategy={false}`、回填 3 类买点列。

## 关键不变量与易错点

- **列顺序必须与表头一一对应**：`toReportCells` 的取值顺序须逐项匹配 `BUY_SELL_REPORT_COLUMNS`。曾出现「卖出三列整体错位」的线上问题（`卖出收盘价` 列装成月RSI6、`卖出季RSI6` 列装成卖出价），改动列顺序或新增列时务必同步两处。
- 新增/删除列时同步三处：`BUY_SELL_REPORT_COLUMNS`、`toReportCells`、`REPORT_AVERAGE_EXCLUDED_TITLES`。
- 导出仍是**零依赖手写 OOXML**（`xlsxExport.ts`，inlineStr + 不压缩 ZIP）：仓库约定**不引入 xlsx 依赖、不改 `package.json` 版本（含 react）**，新增导出能力优先复用 `downloadXlsx`。
- 所有买点计算必须走 Worker 池（`computeBuyPoints`），禁止在主线程同步跑 RSI/分位，否则页面卡顿。
- `computeBuyPoints` 返回的 `BuyPointResult` 必须带上 `mqBuyPoints` 明细（含卖出与回撤字段），报告导出依赖它；页面取数函数的**空数据分支与 catch 分支都要补 `mqBuyPoints: []`**，否则 TS 报 `TS2741`。
- 删除页面上的旧按钮后，注意清理随之失效的局部状态（如 `calculating`），否则 `noUnusedLocals` 报 `TS6133`。
- 三个入口的按钮与规则文案必须留在 `BuyPointActionGroup.tsx` 单点维护，各页面不要复制样式或文案。

## 验证方法

1. 类型检查：`cd Front-End && npx tsc --noEmit -p tsconfig.app.json`（仓库有大量历史遗留报错，只关注本次改动是否新增；`OutTrading.tsx` 等页面操作列 `render: (_, record)` 的 `TS7006` 属历史遗留）。
2. 导出逻辑回归（推荐，可离线复现真实结果）：用 `npx esbuild <test.ts> --bundle --format=esm --platform=node --tsconfig=tsconfig.app.json --alias:@=./src` 打包临时脚本，在 Node 中 `import { runBuyPointTask } from '@/utils/buyPointCompute'`，喂入真实日线（腾讯 `ak.stock_zh_a_hist_tx(symbol, adjust='hfq')`），断言：`卖出收盘价 == sellPrice`、`卖出月/季RSI6 落在 0~100`、`sellDate != null` 的行收益率 > 0。
3. 浏览器实测：切到对应 Tab（个股/指数/港股在「自选/分组」，基金在「自选基金」，大宗商品在页面顶部），确认按钮组渲染、`itemLabel` 名词正确、基金仅 3 条规则文案（无周 RSI6 条）；勾选后点导出，用 `openpyxl` 或直接解压 `.xlsx` 检查文件名前缀、列名顺序与汇总行。
