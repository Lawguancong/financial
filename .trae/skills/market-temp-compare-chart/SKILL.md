---
name: market-temp-compare-chart
description: 在 /stock/a/market-temp 市场温度页新增或调整「双指标对比」tab（指数比值、年化收益率差等），复用 shared 组件 IndexComparisonChart；当用户要求新增该页 tab、改对比口径/分位高亮/差值方向/起始日期或年化展示窗口时使用；不适用于新增独立页面或单系列折线图。
---

# 市场温度页「双指标对比」tab

`/stock/a/market-temp` 下的比值/差值对比 tab 均复用 `src/components/IndexComparisonChart.tsx`，页面入口在 `src/pages/stock/a/market-temp/index.tsx`。

## 涉及文件

| 文件 | 作用 |
|------|------|
| `Front-End/src/pages/stock/a/market-temp/index.tsx` | tab 列表、各 tab 的 `IndexComparisonChartProps` 配置、数据 fetch 与归一化 |
| `Front-End/src/components/IndexComparisonChart.tsx` | 左轴双折线 + 右轴派生指标面积图（分位分区高亮）、顶部统计卡片 |
| `Front-End/src/utils/stockUtils.ts` | `filterByFrequency`（月度采样）、`calculateAnnualizedReturn`（年化口径） |
| `Front-End/src/config/appConfig.ts` | `chart.indexComparison`：分位阈值/分区配色/年化最小展示天数 |

## 新增一个 tab 的步骤

1. 在页面文件写数据 fetch：统一返回 `NormalizedPoint[]`（`{ date, close }`）。
   - 中证源：`fetchCsindexHist(symbol, startDate)` → `/api/public/stock_zh_index_hist_csindex`
   - 新浪源：`fetchSinaIndexDaily(symbol)` → `/api/public/stock_zh_index_daily`
2. 定义 `IndexComparisonChartProps` 配置常量（参照同文件 `CSI_ALL_VS_BOND_CONFIG`）。
3. 在 `refreshKeys` 初始对象里补一个递增 key（如 `'13': 0`）。
4. 在 `items` 数组中加 tab：
   ```tsx
   children: useMemo(() => <IndexComparisonChart key={refreshKeys['13']} {...YOUR_CONFIG} />, [refreshKeys['13']]),
   ```
   刷新按钮只递增该 key，即可重挂载组件重新取数。
5. 跑类型检查（见「验证方法」）。

## 共享组件口径

- **采样与对齐**：左右两路各自按 `filterByFrequency(..., 'monthly')` 取每月最后一条，再按 **`YYYY-MM` 月份键取交集**（不再要求月末交易日完全相同），并对齐后按月份升序排列。这样一侧更新到 10-23、另一侧只到 10-22 时不会整月丢失。
- **左轴**：左右两条折线，`left/right.name` 即图例/tooltip 名称，`leftAxisTitle` 为左轴标题（默认「收盘点位」）。
- **右轴派生指标**（`derivedMode`）：
  - `ratio`（默认）：`left / right`，保留 4 位小数；
  - `diff`：`left - right`，默认保留 2 位，用于年化收益率差（百分点）。
- **分位高亮**：阈值取 `appConfig.chart.indexComparison.lowPercentile` / `highPercentile`（当前 5 / 95）；近十年用近十年分位，10 年前用全历史分位；低区绿、高区红，其余为派生线色的半透明填充。
- **顶部卡片分位行**：按 `[5, lowPercentile, highPercentile, 95]` 去重升序动态生成，标签即实际分位值。配置为 10/90 时显示 5/10/90/95 四行；配置为 5/95 时自动收为两行，避免「标签写 10% 实际取 5%」的错位。不要再用写死的 5/10/90/95 行绑定配置阈值。
- **顶部卡片**：`derivedCurrentLabel` 改「当前比值/当前年化差」标题；`showLatestValues: true` 额外展示左右两路最新值；`valueSuffix: '%'` 给数值加单位。
- **负值开关**：组件默认按「指数点位」口径只保留 `>0` 的点；年化收益率可为负（创业板 2011–2014 累计年化为负），必须显式设置 `allowNegative: true`，否则会被整段过滤、图表起点被推迟到转正月份。仅影响左右两路取值过滤，不改变原始指数序列的 `>0` 校验（`annualizePoints` 内）。

## 累计年化收益率差口径（本页已落地）

- 数据源与起点：
  - 股票基金 `H11021` / 债券基金 `H11023`（中证源），均自 `20030101` 起；
  - 创业板 `sz399006`（新浪源）/ 中证红利 `000922`（中证源），均自 `20100601` 起；
  - 中证全指 `000985` / 长期国债 `H11075`（中证源），均自 `20080101` 起；
  - 沪深300 `000300` / 债券基金 `H11023`（中证源），均自 `20030101` 起；
  - 中证全指 `000985` / 债券基金 `H11023`（中证源），均自 `20041231` 起。**注意**：`000985` 在 `2003-01-01` 只有一个 1000 点的锚点，真实日线从 `2004-12-31`（基期）开始，若从 2003 起算会多出一个「持平一年、年化 0%」的假点且拉低后续年化，必须两边统一以 `20041231` 为基期。
- 实现：`annualizePoints` 统一把 `{date, close}` 折算为累计年化；`fetchAnnualizedCsindex` 适配中证源，`fetchAnnualizedSinaIndex` 先按起始日截取新浪源再折算。新浪源日期为 `YYYY-MM-DD`，中证源为 ISO，排序统一用字符串比较。
- 单点年化：`(当日点位 / 首日点位) ^ (365 / 自首日自然日数) - 1`，复用 `calculateAnnualizedReturn`（365 自然日/年）。
- 展示窗口：持有不足 `appConfig.chart.indexComparison.annualizedMinDays`（默认 365 天）的点不产出，避免首月短窗口年化被极端放大。
- 率差方向：**股票基金 − 债券基金**；**创业板 − 中证红利**；**中证全指 − 长期国债**；**沪深300 − 债券基金**；**中证全指 − 债券基金**。正值表示前者年化更高。
- 参考配置：`STOCK_BOND_ANNUALIZED_SPREAD_CONFIG`、`CYB_DIVIDEND_ANNUALIZED_SPREAD_CONFIG`、`CSI_ALL_LONG_BOND_ANNUALIZED_SPREAD_CONFIG`、`HS300_BOND_ANNUALIZED_SPREAD_CONFIG`、`CSI_ALL_BOND_ANNUALIZED_SPREAD_CONFIG`（均 `derivedMode: 'diff'`、`allowNegative: true`、`showLatestValues: true`、`valueSuffix: '%'`）。

## 验证方法

```bash
cd Front-End
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "IndexComparisonChart|market-temp"
```

- 仓库存在历史遗留报错（未使用导入、`lodash-es` 缺声明、隐式 any 等），只确认本次改动文件无**新增**报错。
- 数据口径可离线核对：拉取对应接口，按上述公式算最新点。参考值（2026-10-23）：股票基金 10.43% / 债券基金 5.19% / 率差 5.24 个百分点；创业板 6.38% / 中证红利 4.25% / 率差 2.13 个百分点；中证全指 0.06% / 长期国债 4.48% / 率差 -4.42 个百分点；沪深300 6.07% / 债券基金 5.21% / 率差 0.86 个百分点；中证全指 8.28% / 债券基金 5.21% / 率差 3.07 个百分点（后两组为 2026-09-30，见下方限制）。
- 注意闰年边界：`20080101` 起点时，首个满 365 天的点是 `2008-12-31`（2008 为闰年），正好落在金融危机年，中证全指年化约 -64.6%、长期国债约 +18.4%、率差约 -83.0 个百分点，首点会明显压缩图表；如需更可读，应调整起始日或提高 `annualizedMinDays`，不要静默改口径。

## 已知限制

- 组件只做月度采样，无法按日频展示。
- 月度对齐方式：先各自取「当月最后一个交易日」，再按 `YYYY-MM` 月份键求交集；左右值可能来自不同交易日（各自当月最后一个交易日），属于按月对齐的有意口径，不保证同一交易日。
- `showLatestValues` 展示的是左右折线的最新值，不是右轴派生指标的独立序列。
- 修改 `derivedMode` / 起始日期 / 年化展示窗口属于口径变更，历史截图与旧结论不可直接比较，需在 tab 说明文案中写清。
