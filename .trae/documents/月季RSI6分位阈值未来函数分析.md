# 月&季 RSI6「历史分位」口径的未来函数分析（as-of 改造评估）

> 本文只做源码静态分析与微基准测试，**不涉及任何代码改动**。
> 分析对象：月&季 RSI6 百分位共振的 ★5「买入&卖出一一配对」策略；同一结论适用于周/月单周期百分位策略（两者共用同一套分位口径）。
> 关联文档：[买入卖出配对策略偏差审计与参数清单.md](file:///Users/luoguancong/Desktop/project/financial/.trae/documents/买入卖出配对策略偏差审计与参数清单.md)（§2.2、§6 P0 已提出同一问题，本文进一步回答「准不准 / 改多少 / 慢多少」）。

---

## 0. 结论摘要

| 问题 | 结论 |
|------|------|
| 是否真的存在未来函数？ | **是**。买入/卖出分位阈值用「整段历史（含买点之后的数据）」计算，属 **P0 级 look-ahead bias**，用户举的 2010 年例子完全成立 |
| 改成「截至买点当日」的 as-of 分位是否更准确？ | **历史可复现性 / 回测可信度显著提升**；但 **当前最新一期的信号几乎不变**（as-of 最新阈值 ≡ 现行全样本阈值），因此不会让"今天的推荐"更准；历史买卖点、星级、配对与导出报告会整体变一遍，旧报告与新报告不可比 |
| 代码改动大吗？ | **引擎必需改动约 150 行**（2 个核心函数 + 1 个 helper + 常量）；若要把"逐月变化的阈值"在页面/导出里表达正确，再加约 **200 行** UI/导出改动 |
| 性能会慢多少？ | **几乎可以忽略**。实测分位部分 1.2ms（月+季各 354 点 × 4 个分位，增量有序插入），现有「季 RSI6 逐月重算」约 30ms，新增开销约 **4%**；周线全历史 1560 点约 11ms；批量导出以 HTTP 取数为主，端到端无感 |

---

## 1. 现状代码事实（偏差发生在哪一层）

### 1.1 「历史分位」的实现

[calculatePercentile](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L982-L987)：

```ts
export const calculatePercentile = (data: number[], percentile: number): number => {
  if (data.length === 0) return 0;
  const sortedData = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sortedData.length) - 1;
  return sortedData[Math.max(0, index)];
};
```

- 最近秩法：`sorted[ceil(p/100·n)-1]`；
- **入参 `data` 是调用方传入的整段序列，没有任何时间截断能力**；
- 月&季阈值 3%/5%/10%/85% 全部走这条路径。

### 1.2 月&季策略的阈值与判定

[analyzeMonthlyQuarterlyPercentile](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1865-L2001)：

| 环节 | 现状 | 是否含未来数据 | 位置 |
|------|------|----------------|------|
| 月 RSI6 样本 | `monthlyRSI6Data.slice(6)` 全序列 | 阈值样本含未来 | [L1876-L1885](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1876-L1885) |
| 季 RSI6 样本 | 逐月 as-of 序列，但**阈值仍取全序列** | 阈值含未来 | [L1883-L1885](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1883-L1885) |
| 买入阈值 | `roundPercentile(monthlyValues/quarterlyValues, 3/5/10)` | **含未来** | [L1891-L1898](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1891-L1898) |
| 卖出阈值 | `roundPercentile(..., 85)` | **含未来** | [L1900-L1904](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1900-L1904) |
| 买点判定 | 逐月比较 `monthlyRsi <= T_level` 且 `quarterlyRsi <= T_level` | 阈值是"今天回看"的 | [L1928-L1947](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1928-L1947) |
| 卖点判定 | 逐月比较 `>= sellThresholds` + 365 天 + 收益门槛 | 阈值含未来 | [L1949-L1997](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1949-L1997) |

### 1.3 单周期（周/月）策略同病

[analyzeSinglePeriodPercentile](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1467-L1571)：

```ts
const arr = rsiData.slice(warmup);
const values = arr.map(i => i.__RSI6__).filter(isNumber);
const buyThreshold = roundPercentile(values, buyPercentile);   // 全样本
const sellThreshold = roundPercentile(values, sellPercentile); // 全样本
```

[L1478-L1486](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1478-L1486)，随后在 [L1497-L1551](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1497-L1551) 用这两个**常量阈值**扫全历史。

### 1.4 已经做对、本次不要回退的部分

| 项 | 现状 | 位置 |
|----|------|------|
| 季 RSI6 | 「季初→当月」逐月截断，不复用季末未来数据 | [calculateQuarterlyRSI6 L609-L651](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L609-L651) |
| 日/周/月 RSI6 | 周/月按日查询时为"已完成周期前缀 + 当期截断" | [calculateAsOfPeriodRSI6 L533-L593](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L533-L593) |
| 周 K 分组键 | `weekYear()`，避免跨年周错位 | [aggregateKLineByPeriod](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L374-L455) |
| 分批卖出 T+N 取价 | 决策在信号日，之后价格是已实现收益 | [buildSellTranches L1771-L1837](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L1771-L1837) |

> 也就是说：**RSI 数值本身已经无未来函数，唯独"拿它跟哪个阈值比"这一步偷看了未来。**

### 1.5 调用链（改一处即可覆盖所有入口）

```
runBuyPointTask / runRsiDetailTask        （Worker 内纯计算）
  └─ computeKLineBuyPoints / runRsiDetailTask
       ├─ calculatePeriodRSI              （日/周/月/季 RSI6，已 as-of）
       ├─ computeMonthlyQuarterlyPercentileBuyPoints  ← 月&季阈值（全样本）
       └─ computeSinglePeriodPercentileTrades         ← 周/月阈值（全样本）
            ↓
      RsiFilterMark 表格/标注、买入&卖出报告、买入计划、各列表页买点列
```

- [buyPointCompute.ts L142-L147](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buyPointCompute.ts#L142-L147)（个股/指数/商品）
- [buyPointCompute.ts L256-L261](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buyPointCompute.ts#L256-L261)（基金）
- [rsiDetailCompute.ts L119-L139](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/rsiDetailCompute.ts#L119-L139)（详情页）
- 展示层：[RsiFilterMark.tsx L1729-L1742](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/components/RsiFilterMark.tsx#L1729-L1742) 直接把阈值写成固定数字
- 图表参考线：[RsiFilterMark.tsx L836-L865](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/components/RsiFilterMark.tsx#L836-L865) / [L944-L1041](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/components/RsiFilterMark.tsx#L944-L1041) 使用 `lineY` 水平线

---

## 2. 偏差机制：为什么用户举的例子成立

### 2.1 一个月的判定实际用了"未来 16 年"的信息

用户例子（用月末口径重述）：

- 数据区间 2000-01 ~ 2026-10，月 RSI6 有效点约 **306 个**（26 年 × 12 − 6 个预热）；
- 判定 2010-01（当时有效样本约 **114 个**）是否 ★5：

| 口径 | 阈值样本 | 3% 分位对应秩 | 含义 |
|------|----------|---------------|------|
| 现状（全样本） | 2000-01 ~ 2026-10，n≈306 | `ceil(0.03×306)-1 = 9`，即**第 10 小** | 阈值里含 2010 年之后 16 年的极端值 |
| as-of（截至 2010-01） | 2000-01 ~ 2010-01，n≈114 | `ceil(0.03×114)-1 = 3`，即**第 4 小** | 只用了当时已知信息 |

两者都是"约 3%"，但**是不同分布上的 3%**。RSI 的分布会随市场状态漂移（长期牛市里极端超卖更少、阈值更高），因此：

- 全样本阈值可能比当时阈值更低 → 当时真实触发的买点被**漏掉**；
- 也可能更高 → 回看时多出**当时并未触发**的买点；
- 方向完全取决于"未来数据落在分布的哪一侧"，**不能简单断言 as-of 一定信号更多**。

但无论方向如何，结论相同：**历史信号不是当时可复现的，报告里的胜率/年化就不能当成策略的实盘能力。**

### 2.2 分位秩随样本量的退化（小样本更极端）

`ceil(p/100·n)-1` 在 n 小时的取值：

| n（有效月点） | 3% 分位对应"第几小" | 备注 |
|---------------|----------------------|------|
| 36（3 年） | 第 2 小 | 几乎是次低值 |
| 60（5 年） | 第 2 小 | 仍极不稳定 |
| 114（≈9.5 年） | 第 4 小 | 2010 年时的真实处境 |
| 240（20 年） | 第 8 小 | 较稳 |
| 306（26 年） | 第 10 小 | 现状全样本 |
| 1560（周线 30 年） | 第 46 小 | 周策略样本更充足 |

> 注意：**季 RSI6 序列是逐月产出**，每个自然季度贡献 3 个高度相关的点（1 月=季初→1 月、2 月=季初→2 月、3 月=整季）。因此季分位的"有效独立样本"约为 n/3，尾部估计比表面 n 更不稳。这是现状与 as-of 都存在的统计问题，建议在文档/页面提示，不必在本次改造中解决。

### 2.3 已量化的偏差（既有合成数据实验）

[审计文档 §2.2](file:///Users/luoguancong/Desktop/project/financial/.trae/documents/买入卖出配对策略偏差审计与参数清单.md) 用 7200 根确定性随机游走日线做过对比：

| 级别 | 全样本信号数 | as-of 信号数 | 完全一致 | 仅全样本有 | 仅 as-of 有 |
|------|--------------|--------------|----------|------------|-------------|
| ★5 | 4 | 18 | 4 | 0 | 14 |
| ★3 | 3 | 11 | 2 | 1 | 9 |
| ★1 | 17 | 23 | 4 | 13 | 19 |
| 合计 | 24 | 52 | 10 | 14 | 42 |

**只有 42% 的信号两套口径一致**。这组数字只说明"口径主导结论"这一机制，不代表任何真实标的。

### 2.4 重绘（repainting）与报告不可复现

- 每新增一段行情，全样本阈值就变一次 → 同一历史买点可能**升级/降级/消失**，配对关系与卖出价跟着变；
- 因此「买入&卖出报告」/「买入计划」每次导出都可能与上月不同，**且无法用当时的信息复现**；
- as-of 口径下，历史月份的阈值一旦确定就不再变化（只取决于该月之前的数据），**历史信号天然稳定**。

### 2.5 另一处相关但独立的偏差（本次不在范围内）

最新一根未走完的月 K（[aggregateKLineByPeriod](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L374-L455) 会把当前月当作已完成）→ 本月信号在月内可能反复出现/消失。as-of 改造**不能**修复这一点，需要单独的 `provisional` 标记。

---

## 3. 按步骤 2 实现，是否"更准确"？

必须把"准确"拆成四个维度，否则容易得出错误期待：

| 维度 | 改造后 | 说明 |
|------|--------|------|
| **无未来数据 / 可复现性** | **显著提升** | 历史每个月的阈值只用当月之前的数据，任何时点都能 1:1 重放 |
| **历史买卖点是否"当时真实存在"** | **显著提升** | 不再用 2026 年的分布去裁定 2010 年的信号 |
| **当前最新一期的推荐** | **几乎不变** | 数学上：as-of 最新一期阈值 ≡ 现行全样本阈值（见 3.1），差异仅来自"是否把当期自身纳入样本" |
| **策略收益/胜率会不会更好** | **不确定，不能假设变好** | 历史★5 集合会整体重排（合成数据里 4 → 18），所有历史绩效指标作废重算；方向取决于数据，不保证改善 |

### 3.1 为什么"今天的信号"基本不变

设当前最新月为 `t_now`：

- 现状：阈值 = 全样本 `[t0, t_now]` 的分位；
- as-of：阈值 = 截至 `t_now` 的扩展窗口 `[t0, t_now]` 的分位。

两者样本**完全相同**，因此阈值相同（除非 as-of 选择"剔除当期自身"，见 §6 问题 4，此时最多相差一个秩位）。**结论：as-of 的价值在"历史的诚实性"，不在"今天更准"。** 这一点必须在产品文案里说清楚，否则用户会误以为改造后推荐会变好。

### 3.2 改造后必然发生的变化（需要提前接受）

1. **历史买点/星级/配对整体变化**：尤其早期（样本少）会出现新信号或旧信号消失；
2. **卖出时点变化**：若卖出分位也改 as-of（推荐），卖点与平均收益率同步变化；
3. **导出报告不可与旧版对比**：文件名/表头必须标注口径（`分位口径：截至当日`），否则会被误读为"策略变差/变好"；
4. **早期样本退化**：n<60 时 3% 分位≈次低值，建议设最小样本门槛（见 §6 问题 3）。

### 3.3 改造后仍然存在的偏差（不要误以为一次改造就"准"了）

- 阈值参数（3/5/10、85/85、15%、365 天）仍是人工设定，无样本外验证 → 过拟合/数据窥探；
- 交易成本、税费、滑点、涨跌停/停牌未建模；
- 生存者偏差（只用当前在市标的）、选择偏差（人工自选股）；
- 后复权价展示 ≠ 当年真实成交价；
- 单周期策略加仓不摊薄成本；
- 当期未完成周期的重绘（见 2.5）。

---

## 4. 实现方案与改动量

### 4.1 四种可选口径

| 方案 | 含义 | 优点 | 缺点 |
|------|------|------|------|
| A 现状 `full` | 全样本分位 | 实现零成本、阈值单一好展示 | 含未来数据，报告不可复现 |
| B `expanding`（截至当月，不含当期） | 逐月扩展窗口 | 无未来数据、历史稳定、可实盘复现 | 早期样本退化；阈值随时间变，UI 表达变复杂 |
| C `expanding` + 最小样本门槛（推荐） | n<60 月不出信号 | 避免早期退化信号 | 会丢掉前 5 年信号 |
| D 滚动窗口（如近 10 年） | 固定长度回看 | 自适应市场状态 | 引入新参数与"窗口边缘跳变" |

> 建议：**引擎统一支持 `thresholdMode: 'full' | 'expanding'`，默认 `expanding` + 最小样本 60 月**；页面提供口径标注（可选开关），报告/买点回填默认 as-of。

### 4.2 引擎层改动（必需，约 150 行）

| 文件 | 改动 | 估算 |
|------|------|------|
| [stockUtils.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts) | 新增 `ThresholdMode` 类型、`EXPANDING_MIN_SAMPLE` 等常量；新增 helper（如 `createExpandingPercentileReader`，内部维护有序数组 + 二分插入，O(1) 读取任意分位）；改造 `analyzeMonthlyQuarterlyPercentile`、`analyzeSinglePeriodPercentile` | ~130 行新增/改写 |
| [rsiDetailCompute.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/rsiDetailCompute.ts) | 透传 `thresholdMode`；结果里补充「最新阈值」「阈值序列（可选）」「每个买点当月的阈值」 | ~10 行 |
| [buyPointCompute.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buyPointCompute.ts) | 同上，两处调用（股票/基金） | ~8 行 |
| Worker 请求类型（`BuyPointTask` / `RsiDetailTask`） | 增加 `thresholdMode` 字段（可结构化克隆） | ~6 行 |

**不改**：`calculateRSI`、`calculateQuarterlyRSI6`、`calculateAsOfPeriodRSI6`、周 K 聚合、配对状态机、分批卖出、回撤/Calmar、Excel 列主结构。

参考算法（增量有序插入，替代"每步复制+排序"）：

```ts
// 阈值读取器：按月推进，插入当前 RSI 后读取指定分位
const createPercentileReader = () => {
  const sorted: number[] = [];
  return {
    push(value: number) {
      let lo = 0, hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] < value) lo = mid + 1; else hi = mid;
      }
      sorted.splice(lo, 0, value);
    },
    read(p: number) {
      if (!sorted.length) return null;
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    },
    size() { return sorted.length; },
  };
};
```

> 注意：**不要改 [calculatePercentile](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L982-L987) 本身**——它还被换手率分位、RSI 统计卡（p10/p90）等多处使用，直接改签名会引发面状回归。新增独立 helper 更安全。

### 4.3 展示/导出层改动（推荐做，约 200 行）

| 文件 | 改动 | 估算 |
|------|------|------|
| [RsiFilterMark.tsx](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/components/RsiFilterMark.tsx#L1729-L1742) | 规则文案改为「截至最新交易日」+ 口径说明；`?? 阈值` 保持不变但标注"最新阈值" | ~20 行 |
| RsiFilterMark 图表 | `lineY` 水平参考线在 as-of 下**语义失效**：阈值逐月变化。改为右轴"阈值阶梯折线"（一条/级别一条），或仅在 as-of 模式下隐藏参考线并保留 tooltip 说明 | ~100 行 |
| RsiFilterMark 月&季表格 | 新增「当月买入阈值（月/季）」列（每行不同），便于复核 | ~40 行 |
| [buySellReportExport.ts](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/buySellReportExport.ts) | 报告/买入计划新增「买入阈值」列；文件名或首行注明口径；不改现有列顺序与汇总行逻辑（注意插入点要动态定位，沿用现有 `CURRENT_PRICE_INSERT_INDEX` 的做法） | ~40 行 |
| 文档/技能（[SKILL.md](file:///Users/luoguancong/Desktop/project/financial/.trae/skills/rsi6-buypoint-report/SKILL.md)） | 口径说明、旧报告不可比说明 | ~30 行 |

**"最小可行"与"完整"的差别**：只改引擎（4.2）也能跑通全部功能，但会出现"阈值文案写死一个数、图上一条水平线、而历史信号用的是逐月不同阈值"的**表达不一致**。如果短期内不想动 UI，至少必须：①文案加"截至最新交易日"；②图表参考线在 as-of 模式隐藏或改为阶梯线；③报告表头标注口径。

### 4.4 数据结构建议

```ts
export type ThresholdMode = 'full' | 'expanding';

// 每个买点记录它被判定时所用的阈值（复核/导出用）
export interface MonthlyQuarterlyPercentileBuyPoint {
  // ...既有字段
  usedMonthlyThreshold?: number;
  usedQuarterlyThreshold?: number;
}

export interface MonthlyQuarterlyPercentileResult {
  // ...既有字段
  /** 最新一期阈值（页面规则文案展示用） */
  latestThresholds: Record<number, { monthly: number; quarterly: number }>;
  latestSellThresholds: { monthly: number; quarterly: number };
  /** 阈值随时间的变化（可选，供阶梯折线使用；仅月/季各一套，按年月） */
  thresholdSeries?: { date: string; monthly: number; quarterly: number }[];
}
```

### 4.5 验证方法

1. **截断 oracle**（最关键）：对每个历史买点月 T，把日线截断到 T 重算整套策略，断言结果与全量数据在同一 T 上的判定一致。现状预期**不通过**，改造后必须 **100% 通过**。
2. **重绘率**：新增 1 个月数据后历史信号变化比例，目标 0%（as-of）。
3. **口径对照**：同一标的同时导出 full / expanding 两份，核对 ★5 数量与配对差异，确认差异来源只有阈值。
4. **类型检查**：`cd Front-End && npx tsc --noEmit -p tsconfig.app.json`，以"不新增错误"为准（项目基线本身有既有错误）。
5. **合成数据回归**：复用审计文档的随机游走数据集，断言"as-of 阈值严格只用前缀数据"（可在 helper 层做强断言）。

---

## 5. 性能评估

### 5.1 复杂度

| 实现 | 复杂度 | n=354（月/季各一套） | n=1560（周） |
|------|--------|----------------------|--------------|
| 每步复制 + 排序（最直观） | O(n² log n) | 21.7ms | 159.9ms |
| **二分插入有序数组（推荐）** | O(n²) 但常数极小 | **0.2ms** | **11.0ms** |
| 树状数组/双堆（离散化） | O(n log n) | 更小，但实现复杂 | — |

> 实测环境：本机 Node **v14.17.0**（较老），每次统计 4 个分位（3%/5%/10%/85%）。浏览器/WASM 环境通常更快或同量级。**推荐二分插入**：代码 20 行、无需离线离散化，n≤2000 时完全够用。

### 5.2 与现有计算相比的相对开销

| 现有计算（同一台机器，粗略复刻） | 耗时 |
|-----------------------------------|------|
| `calculateQuarterlyRSI6` 的逐月重算（354 个月，每月对季前缀重跑一次 RSI） | ~29.8ms |
| 新增：月+季扩展窗口分位（2×354 点 × 4 分位） | ~1.2ms |
| **相对开销** | **≈ 4%** |

说明：`calculateQuarterlyRSI6` 本身就是 O(月数 × 季数) 的逐月重算（[L632-L643](file:///Users/luoguancong/Desktop/project/financial/Front-End/src/utils/stockUtils.ts#L632-L643)），已经比"扩展窗口分位"重得多。因此新增分位开销在整体计算中占比很低。

### 5.3 端到端影响

| 场景 | 影响 |
|------|------|
| 详情页（RsiFilterMark，Worker 计算） | 单标的 +1~12ms（月/季 +1.2ms；若周策略也切 as-of，+11ms 量级），相对现有 loading 无感知 |
| 批量「计算推荐买点」（Worker 池） | 单标的 +几 ms；批量耗时由 HTTP 取数主导（数百 ms ~ 秒级），总时长变化 < 1% |
| 「买入&卖出报告」导出（并发 8） | 同上，取数主导，端到端基本不变 |
| 主线程 | **零额外开销**（全部在 Worker 内；主线程仅多收几百个阈值数字） |
| 内存 | 每个阈值读取器 ≤ n 个 number；354 点约 3KB，1560 点约 13KB，忽略不计 |

> 唯一需要注意的是：如果选择把 `thresholdSeries` 回传主线程并画阶梯线，会增加图表的系列数量（每个级别一条 × 月/季），可能带来轻微渲染开销；建议只在可见级别上画（如仅 ★5），或只画"最新阈值"标记。

---

## 6. 待确认问题（请逐条回复）

1. **默认口径**：是否把「买入&卖出报告」「买入计划」以及列表页买点回填默认切到 as-of？页面详情（RsiFilterMark）是跟随切换，还是保留全样本并明确标注"研究口径"？
2. **历史结果变化**：是否接受切换后历史 ★5 买点/配对/收益整体变化（旧报告与新报告不可比）？是否需要保留一段时间的"双口径对照"导出？
3. **最小样本门槛**：是否采用"有效月点 < 60（5 年）不出信号"？还是照常出信号但页面标注"历史不足，分位不具统计意义"？
4. **阈值是否含当期自身**：推荐"只用截至**上一期**的数据"（不含当期），语义最干净；若要求"最新阈值 ≡ 现状全样本阈值"（便于对比），则用"含当期"。请选择。
5. **周/月单周期策略**：是否同步切换为 as-of？（共用同一 helper，成本很低；但会改变列表页的"周/月百分位买点"列）
6. **页面表达**：图表阈值参考线要"改为阶梯线"、"只在 as-of 下隐藏"，还是"保留水平线但注明为最新阈值"？
7. **卖出分位**：卖出阈值是否也 as-of（推荐是；否则买卖口径不一致）？
8. **是否需要参数敏感性验证**：改造后是否要离线跑一组 `买点分位 {3,5,10} × 卖出分位 {85,90,95} × 门槛 {10,15,20}` 的矩阵，确认结论不是阈值口径的偶然产物？

---

## 7. 推荐路线（若确认执行）

1. **第一步（引擎）**：新增 `ThresholdMode` + 扩展窗口分位 helper；`analyzeMonthlyQuarterlyPercentile` / `analyzeSinglePeriodPercentile` 支持 as-of；买点对象记录"判定时阈值"；默认 `expanding` + 最小样本 60 月。
2. **第二步（一致性）**：规则文案标注"截至最新交易日"；`lineY` 参考线改为阶梯线或按口径隐藏；表格/导出补「买入阈值」列与口径说明。
3. **第三步（验证）**：截断 oracle + 重绘率 0% + 双口径对照 + tsc 不新增错误。
4. **第四步（可选）**：参数敏感性矩阵与 walk-forward，把"分位口径已修正"与"参数是否过拟合"分开评估。

> 一句话总结：**这次改造纠正的是"历史不可复现"这一硬伤，不是"提升收益"；对今天的推荐几乎无影响，对历史报告影响很大，性能代价可以忽略。**
