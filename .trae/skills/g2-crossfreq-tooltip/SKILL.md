---
name: g2-crossfreq-tooltip
description: 用 G2 v5（@ant-design/plots 2.6.x 内置 @antv/g2 5.4.x）DualAxes 绘制跨频率主图（日频主线 + 周/月/季低频指标），并在 shared tooltip 中按周期键查表补齐低频值。当用户反馈双轴图 tooltip 缺系列、周/月/季线呈台阶式直线、smooth 仍不光滑，或要求某系列只在 tooltip 显示不画线时使用。不用于普通单系列 Line 图。
---

# G2 v5 DualAxes 跨频率 Tooltip 补齐模式

在 financial 项目的金融图表中，常见形态是「日频主线（指数/收盘价）+ 周/月/季低频指标（如 RSI6）」的 DualAxes。低频指标在普通交易日没有数据点，直接用 shared tooltip 会漏值，把低频值前向填充到每日又会产生台阶式直线。本 skill 给出经过浏览器实测的标准做法。

参考实现：`Front-End/src/pages/stock/a/stock/detail/components/RsiFilterMark.tsx`（主图「指数 · 买点标注」）。

## 版本前提（先核对，勿凭记忆写 API）

- 查版本：`node -e "console.log(require('./node_modules/@ant-design/plots/package.json').version)"`
- 本项目为声明式 Spec（`children: [...]`），不是旧版链式 API，没有 `chart.line().tooltip()` 写法。

## 核心步骤

### 1. 低频线用周期末真实数据点，不要按日前向填充

右轴数据直接取自周K/月K/季K 数组（每周/月/季一个点），不要用 `findMatchingPeriodRSI` 之类逻辑把同一月的值复制到月内每个交易日——那会画出「水平平台 + 跳变」的台阶线，`smooth` 也救不回来。DualAxes 两个子图按时间轴自动对齐不同密度数据。

```ts
const rsiLongData = lowFreqPeriods.flatMap((meta) =>
  periodDataMap[meta.dataKey]
    .map((item) => ({ date: item.日期, label: meta.label, value: item.__RSI6__ }))
    .filter((row) => row.value != null),
);
```

两个 line 子图都加 `shapeField: 'smooth' as const`。

### 2. 颜色统一在 scale.color，两个子图用同一份 domain/range

颜色常量集中在文件顶部；不要给某个子图单独写 `style.stroke`，否则折线/图例/tooltip 颜色不一致（历史教训）。

```ts
const colorDomain = [mainName, ...lowFreqPeriods.map(({ label }) => label)];
const colorRange = [mainColor, ...lowFreqPeriods.map(({ color }) => color)];
// 两个 children 都配置 scale: { color: { domain: colorDomain, range: colorRange } }
```

### 3. tooltip 单一控制点放在日频子图上（关键 API 形态）

G2 v5 中 `tooltip.items` 是**数组，每个元素本身是 `(datum) => { name, color, value }` 函数**。

- 错误写法：`items: (d) => [{...}, {...}]`（一个返回数组的函数）——会被当成单个非法 item，tooltip 只剩日期标题、内容行全部消失。这是实际踩过的坑。
- 正确写法：多个独立函数组成的数组。
- 右轴（低频）子图设 `tooltip: false`，避免周期末当天两个子图都有数据点时条目重复。
- 顶层补 `tooltip: { showCrosshairs: true, shared: true }` 保留十字准星。

```ts
tooltip: {
  title: (d) => moment(d.date).format('YYYY-MM-DD'),
  items: [
    (d) => ({ name: mainName, color: mainColor, value: fmt(d.value) }),
    (d) => ({ name: '周RSI6', color: weeklyColor, value: fmt(weeklyMap.get(weekKey(d.date))) }),
    // 月/季同理
  ],
},
```

类型定义见 `node_modules/@antv/g2/lib/spec/component.d.ts`（`TooltipItem = string | { name?, color?, field?, value?, valueFormatter? } | Encodeable<TooltipItemValue>`）。

### 4. 周期查表键必须与项目计算口径一致

tooltip 补齐值的归属周期要和推荐级别计算 `getPeriodRSIValues`（`Front-End/src/utils/stockUtils.ts`）一致，否则同一天两处数值对不上：

| 周期 | 键（用 moment） |
|------|----------------|
| 日 | `format('YYYY-MM-DD')` |
| 周 | `${date.year()}-${date.week()}` |
| 月 | `format('YYYY-MM')` |
| 季 | `${date.year()}-Q${date.quarter()}` |

构建 Map 时周/季用数组显式返回 `as const` 元组，避免 TS 推断成联合类型。

### 5. 「只在 tooltip 显示、图上不画线」的系列

只把它加进第 3 步的 `items` 数组（配独立查表 Map 和颜色），**不要**加进 `rsiLongData`、`colorDomain`/`colorRange`。G2 中 tooltip item 不要求该系列在图上存在。

## 浏览器自测

后端没起时不要硬猜，用零依赖临时 mock（标准库 `http.server`，写在 `/tmp`，不进工程），再以对应 mode 起前端：

1. `npm run dev -- --mode akshare`（读 `.env.akshare`，指向 127.0.0.1:6680）。
2. canvas 无 a11y ref，hover 用 `browser_evaluate` 在 canvas 上派发 `pointerover/pointermove/mousemove`（PointerEvent + MouseEvent 都发，clientX/clientY 用 getBoundingClientRect 算）。
3. 直接读 G2 tooltip DOM 文本断言，比截图稳定：
   `document.querySelectorAll('.g2-tooltip')` 过滤 visible，`textContent.replace(/\s+/g,' ').trim()`。
   验证点要覆盖**普通交易日**（非周期末），并多取 2-3 个 x 位置。
4. 完成后停掉临时 vite/mock 进程并删除 `/tmp` 脚本。
5. 静态检查：IDE 诊断必须 0 错误（`@typescript-eslint/no-unused-vars` 会拦截新建但未使用的 Map）。

## 反模式

- 把低频值按日前向填充后再画线（台阶线）。
- `items` 传单函数返回数组（tooltip 内容消失）。
- 两个子图颜色配置不一致或硬编码 stroke（颜色割裂）。
- 右轴子图保留默认 tooltip（周期末条目重复）。
- 周键自创新格式（如 `isoWeek`）而项目计算用 `moment.week()`（数值错配）。
- 新增系列只改 tooltip 忘记加颜色常量，或加进了 domain 导致图上多出线。
