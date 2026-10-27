# AGENTS.md — 项目公共入口（所有 AI IDE 通用）

> 本文件是本仓库**唯一的公共 AI 入口**，适用于 Trae / Claude Code / Cursor / GitHub Copilot / Gemini CLI / Windsurf / Cline / Codex 等。
> 其它 IDE 的入口文件（`CLAUDE.md`、`GEMINI.md`、`.cursor/rules/*.mdc`、`.github/copilot-instructions.md`、`.windsurf/rules/*`、`.clinerules/*`）只做薄指针，**规范与索引一律以本文件为准**，不要在这些文件里重复维护内容。

## 项目概览

- **Financial Data Workbench**：基于 AKShare / AKTools 的财经数据可视化与投研分析平台，覆盖 A 股、港股、美股、基金、债券、大宗商品、全球指数、REITs。
- `Back-End/`：Python 数据服务（AKShare / AKTools 封装）。
- `Front-End/`：React 19 + TypeScript 5.9 + Vite 7 + Ant Design 6，图表使用 `@ant-design/charts`（G2 v5）。
- 详细说明见 [README.md](./README.md)。

## 目录结构

```
.
├── AGENTS.md                 # 本文件：公共约定 + 技能索引（唯一真相源）
├── README.md                 # 项目说明
├── TODO.md
├── Back-End/                 # Python 数据服务
├── Front-End/
│   ├── src/
│   │   ├── config/appConfig.ts   # 全局可配置参数中心
│   │   ├── utils/                # 计算内核、数据请求、Excel 导出
│   │   ├── components/           # 公共图表/组件
│   │   ├── pages/                # 各品类页面
│   │   └── workers/              # Web Worker（RSI 批量计算）
│   └── package.json
└── .trae/
    ├── skills/               # 技能详文（Trae 原生，同时被 .claude/skills 软链复用）
    └── documents/            # 策略分析与方案文档
```

## 常用命令

**运行环境**：Node.js `v20.19.5`、npm `10.8.x`。不同 Node 版本对 peerDependencies 的解析策略不同，可能导致 npm install 时 package.json 被改写（见技能 `dependency-install-safe`），建议用 `.nvmrc` 锁版本。

所有前端命令在 `Front-End/` 下执行：

```bash
npm run dev          # 本地开发
npm run build        # 构建
npm run build:check  # tsc -b + 构建
npm test             # 运行 test/*.test.ts 全部测试用例
npm run lint         # ESLint
npx tsc --noEmit -p tsconfig.app.json   # 仅类型检查（注意：仓库存在历史遗留报错，只看本次改动是否新增）
```

在仓库根目录也可直接执行 `yarn test`（根 `package.json` 已代理到 `Front-End` 的 `npm test`）。无需 `sudo`，用普通用户执行即可。

## 开发约定（必须遵守）

1. **配置集中**：跨页面复用 / 影响回测与展示口径的参数统一放在 `Front-End/src/config/appConfig.ts`（`appConfig.rsi` / `batch` / `worker` / `http` / `chart`）。不要在业务文件里新增重复常量；页面内一次性 UI 文案、分页 pageSize、列宽、局部颜色可留在本地。
2. **技能同步**：任何代码改动（功能、接口、页面、组件、配置、口径）完成后，同步更新 `.trae/skills/` 下对应技能，并检查本文件的「技能索引」是否仍然准确。见技能 `code-change-skill-sync`。
3. **禁止未来函数**：RSI 分位与买卖点必须使用 as-of 口径（只用当期及之前的数据），窗口与最小样本由配置控制。
4. **注释与文档使用中文**，与现有代码保持一致。
5. **不轻易新增依赖**：如 Excel 导出由 `src/utils/xlsxExport.ts` 手写零依赖实现，改动时优先扩展它而不是引入 `xlsx` / `exceljs`。
6. **计算口径与展示分离**：策略计算函数只产出数据；文案、颜色、Excel 样式在展示层处理。
7. **验证方式**：改动后至少跑一次 `npx tsc --noEmit -p tsconfig.app.json`，并过滤到本次改动文件确认无新增报错。

## 技能索引（详文在 `.trae/skills/`）

| 技能 | 何时使用 | 详文 |
|------|----------|------|
| `rsi6-buypoint-report` | 新增/调整 RSI6 买点计算、导出买入&卖出报告或买入计划、修改报告列或买卖规则、调整分位口径/回撤指标/Excel 样式 | [SKILL.md](./.trae/skills/rsi6-buypoint-report/SKILL.md) |
| `financial-feature` | 按项目约定新增金融数据功能页（菜单/路由/页面/图表/表格 + 可选后端接口），或在已有行情详情页新增技术指标 tab（如 MACD 日/周/月/季多周期图表、DEA-DIF/DEA÷DIF 派生线、as-of 峰值买点表、样本区间、type/visiblePeriods 适配） | [SKILL.md](./.trae/skills/financial-feature/SKILL.md) |
| `g2-crossfreq-tooltip` | G2 v5 DualAxes 跨频率主图、周/月/季低频指标 tooltip 补齐与光滑处理 | [SKILL.md](./.trae/skills/g2-crossfreq-tooltip/SKILL.md) |
| `market-temp-compare-chart` | 在 `/stock/a/market-temp` 新增/调整双指标对比 tab（指数比值、年化收益率差），复用 `IndexComparisonChart` | [SKILL.md](./.trae/skills/market-temp-compare-chart/SKILL.md) |
| `code-change-skill-sync` | 每次代码改动收尾、提交前，检查并同步技能、用户可见文案与索引；公共方法/计算内核改动时补测试并跑通 | [SKILL.md](./.trae/skills/code-change-skill-sync/SKILL.md) |
| `agent-confirm` | 执行中遇到不明确的参数/边界/口径/路径/需求冲突，必须停下来向用户确认，不能猜测 | [SKILL.md](./.trae/skills/agent-confirm/SKILL.md) |
| `dependency-install-safe` | 安装第三方依赖时严格锁定已有版本号，npm/pnpm/yarn 任何操作后必须 diff 验证，禁止 peerDependencies 被顺手改写 | [SKILL.md](./.trae/skills/dependency-install-safe/SKILL.md) |

> Claude Code 可直接通过 `.claude/skills`（软链到 `.trae/skills`）识别上述技能；其它 IDE 请按索引打开对应 `SKILL.md` 阅读完整流程。

## 文档索引（`.trae/documents/`）

| 文档 | 内容 |
|------|------|
| [月季RSI6分位阈值未来函数分析.md](./.trae/documents/月季RSI6分位阈值未来函数分析.md) | 全历史分位导致未来函数的分析与 as-of 改造结论 |
| [月季RSI6分批卖出方案.md](./.trae/documents/月季RSI6分批卖出方案.md) | ★5 配对分批卖出（4 批 / 7 天）方案 |
| [配对卖出最低收益率门槛.md](./.trae/documents/配对卖出最低收益率门槛.md) | 15% 收益率门槛的两段口径说明 |
| [买入卖出配对策略偏差审计与参数清单.md](./.trae/documents/买入卖出配对策略偏差审计与参数清单.md) | 配对策略偏差审计与可配置参数清单 |
| [rsi-filter-mark-worker/spec.md](./.trae/documents/rsi-filter-mark-worker/spec.md) | 详情页 RSI 计算 Worker 化方案 |
| [rsi-filter-mark-worker/tasks.md](./.trae/documents/rsi-filter-mark-worker/tasks.md) | 上述方案的任务拆解 |

## 工作方式

- 先读相关源码再改动，不要基于猜测修改。
- 需求不明确时先向用户确认，不要擅自扩大改动范围。
- 只做被要求的事，避免顺手重构。
- 完成前自测，并在最终回复中说明改了哪些文件、验证结果与剩余风险。
