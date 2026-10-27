# Spec：RsiFilterMark 计算迁移到 Worker 池 + 加载态交互

## 1. 背景与现状（已核实）

- `RsiFilterMark`（[RsiFilterMark.tsx](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/components/RsiFilterMark.tsx)）是详情页 RSI6 组件，被 个股/指数/基金/大宗商品 页面复用（基金经 `FundRsiFilterMark` 传入，`收盘` 字段实为「累计收益率」）。
- 组件内**唯一一个大 `useMemo`**（L559–1210）在**主线程同步**完成全部重计算，是当前唯一仍在主线程做 RSI 重算的组件：
  1. `calculatePeriodRSI(data)`（日/周/月/季 RSI6）
  2. `computeRSIRecommendations(periodRSIMap, type)` → `chartData`
  3. 过滤推荐买点 `buyPointList`；`index|fund` 再 `convertToMonthlyData`
  4. `createRecommendationAnnotations(buyPointList)`
  5. `analyzeSinglePeriodPercentile`（周、月各一次）
  6. `analyzeMonthlyQuarterlyPercentile`（月&季共振）
  7. `rsiStats`（`roundPercentile` 分位）
  8. 构造 4 个图表配置（`mainChartConfig` / `rsiLineConfigs` / `percentileChartConfig` / `monthlyPercentileChartConfig` / `monthlyQuarterlyChartConfig`）——**含函数（xField/tooltip items），必须在主线程构造**。
- 组件现有的 early return：`if (!data?.length) return <div>暂无数据</div>;`（L1528，位于全部 hooks 之后）。
- **现有 Worker 池**已就绪，可直接复用：
  - [buyPointWorker.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buyPointWorker.ts)：`MAX_WORKERS=4`、`pool`/`pendingJobs`/`waitingQueue`/`pump()`/`ensurePool()`，导出 `computeBuyPoints(task)`。
  - [buyPoint.worker.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/workers/buyPoint.worker.ts)：`onmessage` 仅按 `{ id, task }` → `runBuyPointTask(task)`。
  - [buyPointCompute.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buyPointCompute.ts)：计算内核 + 协议 `BuyPointWorkerRequest/Response`。
- **关键口径约束**：`RsiFilterMark` 的 RSI 计算对 fund 也是**直接对传入的 `data`（收盘=累计收益率）** 调用 `calculatePeriodRSI`，**不做** `computeFundBuyPoints` 里的“先按月折叠再算 RSI”。迁移时**必须复刻组件当前逐行逻辑**，不得改口径。

## 2. 目标 / 非目标

**目标**
1. 把 `RsiFilterMark` 的重计算放进 Worker（复用现有池，作为**单个任务**占 1 个 Worker）。
2. 计算期间页面显示 loading，计算完成后自动移除 loading。

**非目标**
- 不改任何图表/表格样式、文案、数值口径。
- 不改 Worker 池并发上限策略，不改其他页面调用方（`computeBuyPoints` 签名保持）。
- 不新增依赖、不改 `package.json` 版本。

## 3. 硬性约束

- **hooks 顺序**：新增 `useState`/`useEffect` 必须放在**所有 early return 之前**（即组件顶部）；新增 loading early return 必须放在**所有 hooks 之后**（`if (!data?.length)` 之后、主 return 之前）。
- 图表配置（含函数）留在主线程构造；Worker 只返回**可结构化克隆**的纯数据。
- `RsiFilterMark` 内所有图表/表格/分位必须消费**同一份**计算结果（不得重复计算 RSI）。

## 4. 设计方案（decision-complete）

### 4.1 `Front-End/src/utils/buyPointCompute.ts`

新增类型与函数（其余保持不变）：

```ts
// 详情模式任务：type 决定推荐级别口径；rawData 为 {日期, 收盘}
// 基金场景 收盘 即累计收益率（由 FundRsiFilterMark 已映射）
export interface RsiDetailTask {
  type: BuyPointType;              // 'stock' | 'index' | 'commodity' | 'fund'
  rawData: BuyPointKLineItem[];    // { 日期: string; 收盘: number }
}

type RsiFieldKey = '__daily__RSI6__' | '__weekly__RSI6__' | '__monthly__RSI6__' | '__quarterly__RSI6__';
export type RsiChartRow = KLineData & { __recommendationLevel__: number | null } & Record<RsiFieldKey, number | null>;
export type RsiBuyPointRow = RsiChartRow & { __recommendationLevel__: number };

export interface RsiDetailResult {
  /** 主图左轴数据（label=mainName 由主线程补） */
  mainChartData: { date: string; value: number }[];
  /** 带 4 周期 RSI6 + 推荐级别的推荐买点（index/fund 已按月折叠） */
  buyPointList: RsiBuyPointRow[];
  /** 各周期 RSI K 线（含 __RSI6__），供 tooltip 查表 / 右轴折线 / 单周期 Line 图 */
  periodRSI: {
    dailyRSI: KLineData[];
    weeklyRSI: KLineData[];
    monthlyRSI: KLineData[];
    quarterlyRSI: KLineData[];
  };
  weeklyThreshold: PercentileThresholdPair | null;
  weeklyTrades: SinglePeriodPercentileTrade[];
  monthlyThreshold: PercentileThresholdPair | null;
  monthlyTrades: SinglePeriodPercentileTrade[];
  mqBuyPoints: MonthlyQuarterlyPercentileBuyPoint[];
  mqThresholds: Record<number, { monthly: number; quarterly: number }> | null;
  mqSellThresholds: { monthly: number; quarterly: number } | null;
}
```

`runRsiDetailTask(task)` **逐行复刻组件当前逻辑**：

1. `const periodRSIMap = calculatePeriodRSI(task.rawData);`
2. `const chartData = computeRSIRecommendations(periodRSIMap, task.type) as RsiChartRow[];`
3. `let buyPointList = chartData.filter(r => r.__recommendationLevel__ != null) as RsiBuyPointRow[];`
   `if (type === 'index' || type === 'fund') buyPointList = convertToMonthlyData(buyPointList);`
4. `const closeValueType: CloseValueType = type === 'fund' ? 'cumulativeReturn' : 'price';`
5. `weeklyThreshold/weeklyTrades = analyzeSinglePeriodPercentile({ rsiData: periodRSIMap.weeklyRSI, buyPercentile: WEEKLY_RSI_BUY_PERCENTILE, sellPercentile: WEEKLY_RSI_SELL_PERCENTILE, closeValueType })`
6. `monthlyThreshold/monthlyTrades = analyzeSinglePeriodPercentile({ rsiData: periodRSIMap.monthlyRSI, buyPercentile: MONTHLY_RSI_PCT_BUY_PERCENTILE, sellPercentile: MONTHLY_RSI_PCT_SELL_PERCENTILE, closeValueType })`
7. `const mq = analyzeMonthlyQuarterlyPercentile({ monthlyRSI6Data: periodRSIMap.monthlyRSI, quarterlyRSI6Data: periodRSIMap.quarterlyRSI, closeValueType })`
8. 组装 `mainChartData = chartData.map(r => ({ date: r.日期, value: r.收盘 }))`，返回 `RsiDetailResult`。

**协议扩展**（同时保留旧调用方不变）：

```ts
export interface BuyPointWorkerRequest {
  id: number;
  kind: 'list' | 'detail';
  task: BuyPointTask | RsiDetailTask;
}
export interface BuyPointWorkerResponse {
  id: number;
  ok: boolean;
  result?: BuyPointResult | RsiDetailResult;
  error?: string;
}
```

（新增 import：`analyzeSinglePeriodPercentile`、`analyzeMonthlyQuarterlyPercentile`、`PercentileThresholdPair`、`SinglePeriodPercentileTrade`；其余已在 L2–17。）

### 4.2 `Front-End/src/utils/buyPointWorker.ts`

- `PendingJob` 泛化：
  ```ts
  interface PendingJob {
    kind: 'list' | 'detail';
    task: BuyPointTask | RsiDetailTask;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }
  ```
- `pump()` 派发请求改为 `{ id, kind: job.kind, task: job.task }`。
- `onmessage` 成功分支 `job.resolve(result)`（`unknown`，类型由各 `computeXxx` Promise 断言收窄）。
- 导出：
  ```ts
  export const computeRsiDetail = (task: RsiDetailTask): Promise<RsiDetailResult> =>
    new Promise<RsiDetailResult>((resolve, reject) => {
      waitingQueue.push({ kind: 'detail', task, resolve: resolve as (r: unknown) => void, reject });
      pump();
    });
  ```
- `computeBuyPoints` 入队改为 `{ kind: 'list', task, resolve: resolve as (r: unknown) => void, reject }`，导出签名 `(task: BuyPointTask): Promise<BuyPointResult>` **不变**。

### 4.3 `Front-End/src/workers/buyPoint.worker.ts`

```ts
scope.onmessage = (event) => {
  const { id, kind, task } = event.data;
  try {
    const result = kind === 'detail'
      ? runRsiDetailTask(task as RsiDetailTask)
      : runBuyPointTask(task as BuyPointTask);
    scope.postMessage({ id, ok: true, result });
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
```

（新增 import `runRsiDetailTask`、`RsiDetailTask`。）

### 4.4 `Front-End/src/components/RsiFilterMark.tsx`

**(a) import**：`React` 增 `useEffect`；`antd` 增 `Spin`；新增
`import { computeRsiDetail } from '@/utils/buyPointWorker';`
`import type { RsiDetailResult } from '@/utils/buyPointCompute';`
（`calculatePeriodRSI`、`computeRSIRecommendations`、`convertToMonthlyData` 若迁移后组件内不再直接调用则从 import 移除，避免 no-unused 报错——以 tsc 结果为准。）

**(b) 组件顶部（L549 之后、大 useMemo 之前）新增 hooks**：

```ts
const [computed, setComputed] = useState<RsiDetailResult | null>(null);
// 惰性初值：有数据时先进入 loading，避免首帧渲染空图表
const [computing, setComputing] = useState<boolean>(() => Boolean(data && data.length));

useEffect(() => {
  if (!data?.length) {
    setComputed(null);
    setComputing(false);
    return;
  }
  let cancelled = false;
  setComputing(true);
  computeRsiDetail({ type, rawData: data })
    .then((result) => { if (!cancelled) { setComputed(result); setComputing(false); } })
    .catch(() => { if (!cancelled) { setComputed(null); setComputing(false); } });
  return () => { cancelled = true; };
}, [data, type]);
```

> 说明：`data` 为 `KLineData[]`，结构上兼容 `BuyPointKLineItem[]`（均含 `日期/收盘`），无需转换。

**(c) 大 `useMemo` 改造**（范围 L573–1210）：
- 依赖数组改为 `[computed, mainName, visibleRsiPeriods, showDaily, showWeekly]`。
- 回调开头：`if (!computed) return emptyResult;` 再解构：
  `const { mainChartData, buyPointList, periodRSI, weeklyTrades, monthlyTrades, mqBuyPoints, mqThresholds, mqSellThresholds } = computed;`
  及 `weeklyThreshold`/`monthlyThreshold`。
- **删除** memo 内 1)–6) 的重计算（`calculatePeriodRSI`/`computeRSIRecommendations`/filter/`convertToMonthlyData`/两次 `analyzeSinglePeriodPercentile`/`analyzeMonthlyQuarterlyPercentile`）。
- **保留**在主线程：`createRecommendationAnnotations(buyPointList)`、`mainData`（由 `mainChartData` 补 `label: mainName`）、`rsiLongData`、4 个 tooltip Map、`rsiStats`（由 `periodRSI` 计算，口径不变）、`buildPercentileAnnotations(trades)`、`monthlyQuarterlyAnnotations`、以及 5 个图表配置。
- `percentileThresholds` 由 `weeklyThreshold`/`monthlyThreshold` 组装（保持原 `Number.NaN` 兜底逻辑）。
- 返回的 14 个键**保持不变**，下游 `useMemo`（trade rows / 表格列）无需改动。

**(d) loading early return**（放在 `monthlyQuarterlyColumns` memo 之后，与 `if (!data?.length)` 相邻）：

```ts
if (!data?.length) return <div>暂无数据</div>;
if (computing) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 0', borderRadius: 8, background: 'linear-gradient(180deg, #fafbfc 0%, #f0f2f5 100%)', border: '1px solid #e8e8e8' }}>
      <Spin size="large" />
      <span style={{ fontSize: 13, color: '#8c8c8c' }}>RSI6 多周期指标与买卖点计算中，请稍候…</span>
    </div>
  );
}
```

**(e) 失败兜底**：`catch` 后 `computed=null` → memo 返回 `emptyResult` → 渲染空图表而不阻塞 UI（不新增错误 UI）。

### 4.5 skill 更新

[rsi6-buypoint-report/SKILL.md](file:///Users/luoguancong/Desktop/project/financial/.trae/skills/rsi6-buypoint-report/SKILL.md)：新增条目说明「RsiFilterMark 详情重计算统一走 `buyPointWorker` 池的 `detail` 模式（`computeRsiDetail`/`runRsiDetailTask`），协议 `kind:'list'|'detail'`；计算期间展示 loading，完成后移除」。

## 5. 验证

1. **类型**：`cd Front-End && npx tsc --noEmit -p tsconfig.app.json` → 总错误数 **≤ 214（基线）**，改动文件**零新增**。
2. **运行**（可选，浏览器）：`npm run dev`，访问含 `RsiFilterMark` 的页面（如 `/stock/a/stock` 某股详情 / 基金详情），确认：
   - 初次进入/切换标的时先显示 loading（Spin + 文案）；
   - 计算完成后 loading 消失，图表与表格正常渲染、数值与改动前一致；
   - 无数据时显示「暂无数据」。
3. **口径回归**：`rsiStats`、百分位阈值、买卖配对表格数值与改动前一致（未改计算口径）。

## 6. 风险与缓解

- **结构克隆开销**：`periodRSI`（日频 ~N 行）与 `buyPointList` 需跨线程克隆一次；相对被移出主线程的 RSI 重算，收益明显，开销可接受。
- **首帧闪烁**：`useState` 惰性初值 `Boolean(data.length)` 保证有数据即先 loading。
- **hooks 顺序**：新增 hooks 置于所有 early return 之前；loading return 置于所有 hooks 之后。

## 7. 待确认 → 批准后执行

请确认以上方案（尤其 4.4 的 loading 早返回位置与 `useState` 惰性初值），批准后进入实现。
