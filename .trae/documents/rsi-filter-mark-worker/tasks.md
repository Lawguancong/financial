# Tasks：RsiFilterMark 计算迁移到 Worker 池 + 加载态交互

> 依赖 spec：[spec.md](./spec.md)。按序执行，逐步验证。

## T1 · buyPointCompute.ts：新增详情模式
- [x] 新增 `RsiDetailTask`、`RsiChartRow`/`RsiBuyPointRow`、`RsiDetailResult` 类型。
- [x] 新增 `runRsiDetailTask(task)`（逐行复刻组件现有计算，口径不变）。
- [x] 扩展协议：`BuyPointWorkerRequest.kind: 'list' | 'detail'`、`BuyPointWorkerResponse.result?: BuyPointResult | RsiDetailResult`。
- [x] 补 import：`analyzeSinglePeriodPercentile`、`analyzeMonthlyQuarterlyPercentile`、`PercentileThresholdPair`、`SinglePeriodPercentileTrade`、`CloseValueType`。
- **验收**：文件内类型自洽，`runRsiDetailTask` 无未使用变量。

## T2 · buyPointWorker.ts：池泛化 + computeRsiDetail
- [x] `PendingJob` 增 `kind` 字段，`task` 联合类型，`resolve: (result: unknown) => void`。
- [x] `pump()` 构造 `{ id, kind: job.kind, task: job.task }`。
- [x] `onmessage` 成功分支 `job.resolve(result)`。
- [x] 新增导出 `computeRsiDetail(task): Promise<RsiDetailResult>`。
- [x] `computeBuyPoints` 入队补 `kind: 'list'`，导出签名不变。
- **验收**：`computeBuyPoints` 所有现有调用方编译通过（签名未变）。

## T3 · buyPoint.worker.ts：按 kind 分派
- [x] `onmessage` 解构 `kind` 并按 `'detail' | 'list'` 分派 `runRsiDetailTask` / `runBuyPointTask`。
- [x] 补 import `runRsiDetailTask`、`RsiDetailTask`。
- **验收**：无类型错误。

## T4 · RsiFilterMark.tsx：接入 Worker + loading
- [x] import：`useEffect`、`Spin`、`computeRsiDetail`、`RsiDetailResult`。
- [x] 组件顶部新增 `computed`/`computing` state 与 `useEffect`（惰性初值 + 竞态取消）。
- [x] 大 `useMemo` 改依赖为 `[computed, mainName, visibleRsiPeriods, showDaily, showWeekly]`，开头 `if (!computed) return emptyResult;`，改为消费 `computed`；删除内部重计算；保留图表配置/tooltip/rsiStats/annotations 构造；返回 14 键不变。
- [x] 在所有 hooks 之后新增 `if (computing) return <LoadingPanel/>`（位置：`if (!data?.length)` 之后）。
- [x] 清理迁移后不再使用的 import（以 tsc 为准）。
- **验收**：hooks 顺序正确（新增 hooks 在所有 early return 前，loading return 在所有 hooks 后）。

## T5 · skill 更新
- [x] rsi6-buypoint-report/SKILL.md 记录 RsiFilterMark 走 Worker 池 detail 模式 + loading 交互。

## T6 · 验证
- [x] `cd Front-End && npx tsc --noEmit -p tsconfig.app.json` → 总错误 214（= 基线），改动文件零新增。
- [x] 口径回归确认：`runRsiDetailTask` 为组件原逻辑逐行复刻（未改口径），类型与基线一致。
- [ ] （可选）`npm run dev` 浏览器实测：loading → 渲染、切换无残留、无数据态正常。
