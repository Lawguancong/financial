<div align="center">

# 📈 Financial Data Workbench

**基于 AKShare / AKTools 的一站式财经数据可视化与投研分析平台**

A股 · 港股 · 美股 · 基金 · 债券 · 大宗商品 · 全球指数 · REITs

<br />

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant%20Design-6-0170fe?logo=antdesign&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.14-3776ab?logo=python&logoColor=white)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [技术栈](#-技术栈)
- [功能模块](#-功能模块)
- [环境准备](#-环境准备)
- [快速开始](#-快速开始)
- [两种运行模式](#-两种运行模式)
- [常用命令](#-常用命令)
- [目录结构](#-目录结构)
- [核心能力：自选与推荐买点](#-核心能力自选与推荐买点)
- [常见问题](#-常见问题)
- [致谢与引用](#-致谢与引用)

---

## 🎯 项目简介

本项目通过 **AKTools**（或自建 Flask 服务）将 Python 财经数据库 [AKShare](https://github.com/akfamily/akshare) 封装为 HTTP API，前端突破语言限制，以表格与图表的形式呈现覆盖 **股票、基金、债券、大宗商品、全球指数、房地产** 等品类的金融数据，并内置 RSI 量化策略、自选池、推荐买点等投研辅助工具。

> 💡 AKTools 是一款用于快速搭建 AKShare HTTP API 的工具，一行命令即可启动服务，让 C/C++、Java、Go、Rust、JavaScript 等任意语言都能轻松获取财经数据。

🔗 相关链接：[AKTools 文档](https://aktools.akfamily.xyz/) · [AKShare HTTP 部署](https://akshare.akfamily.xyz/deploy_http.html) · [AKTools GitHub](https://github.com/akfamily/aktools)

---

## 🧱 技术栈

<table>
<tr>
<th width="20%">层级</th>
<th width="40%">技术</th>
<th>说明</th>
</tr>
<tr>
<td>前端框架</td>
<td>React 19 + TypeScript 5</td>
<td>函数组件 + Hooks，路由懒加载</td>
</tr>
<tr>
<td>构建工具</td>
<td>Vite 7</td>
<td>多环境模式（<code>--mode aktools / akshare</code>）</td>
</tr>
<tr>
<td>UI 与图表</td>
<td>Ant Design 6 · @ant-design/charts · ahooks</td>
<td>表格 / 表单 / G2 图表</td>
</tr>
<tr>
<td>数据请求</td>
<td>Axios · query-string</td>
<td>统一封装 <code>apiClient</code></td>
</tr>
<tr>
<td>工具库</td>
<td>moment · lodash-es · decimal.js</td>
<td>日期 / 工具函数 / 精度计算</td>
</tr>
<tr>
<td>后端服务</td>
<td>Python 3.14 · Flask · AKShare · AKTools</td>
<td>aktools 直启 或 自研 Flask 接口</td>
</tr>
</table>

---

## 🧩 功能模块

| 一级菜单 | 二级分类 | 主要页面 |
| :--- | :--- | :--- |
| 🏠 首页 | — | 数据看板入口 |
| 📊 股票 | A股 | 宏观指标、市场温度、估值、指数、个股、期权波动、股票回购、历史分红、向上突破 |
| | 港股 | 恒生指数股息率 |
| | 美股 | 美股指数 |
| 💼 基金 | 国内 | 基金温度、新发基金、基金仓位、基金公司、基金分红、基金经理、**基金列表/详情**、资产配置、规模变动 |
| 🏦 债券 | 国内 | 中美国债收益率 |
| 🌍 全球指数 | 全球 | 全球指数实时行情与详情 |
| 🛢️ 大宗商品 | 国内 | 金属指数、中国油价 |
| 🏢 房地产 | 国内 | 房地产宏观、REITs 实时行情 |
| 📚 知识课堂 | — | RSI 指标科普 |
| 🧪 API 测试 | — | AKShare 接口在线调试 |

---

## ⚙️ 环境准备

### 1. Node.js

建议使用 **v20.19.5**（推荐通过 nvm / fnm 管理版本）：

```bash
node -v   # 期望输出 v20.19.5
```

### 2. Python 依赖

项目统一使用 **Python 3.14**，需提前安装并保证 `python3.14` 命令可用。

**① 升级 pip**

```bash
python3.14 -m pip install --upgrade pip
```

**② 安装 / 升级 AKTools**（aktools 模式必需）

> AKShare 版本迭代频繁，使用前建议先升级到最新版。macOS 受系统保护时加 `--user --break-system-packages`。

```bash
python3.14 -m pip install --user --break-system-packages --upgrade aktools
```

**③ 安装自研 Flask 后端依赖**（akshare 模式必需，见 [app.py](./Back-End/ak/akshare/app.py)）

```bash
python3.14 -m pip install --user --break-system-packages --upgrade akshare flask flask-cors pandas
```

> 也可在仓库根目录用一条命令一键升级全部 Python 依赖：`npm run upgrade:all`（等价于依次升级 pandas / akshare / aktools）。

### 3. 安装前端依赖（使用 yarn）

```bash
cd Front-End
yarn
```

---

## 🚀 快速开始

在**仓库根目录**执行：

```bash
# ✅ 推荐：一条命令同时启动后端(6670) + 前端(6671)
npm run dev
```

启动成功后访问：

<div align="center">

### 👉 http://localhost:6671/

</div>

如端口被占用，启动脚本会自动清理占用进程后重启，无需手动处理。

---

## 🔀 两种运行模式

项目支持两套后端，通过 Vite mode + 环境变量切换（见 [Front-End/.env.aktools](./Front-End/.env.aktools) 与 [.env.akshare](./Front-End/.env.akshare)）：

| 模式 | 后端 | 后端端口 | 前端端口 | 启动方式 |
| :--- | :--- | :---: | :---: | :--- |
| **aktools**（默认推荐） | `python -m aktools` 通用 HTTP 服务 | `6670` | `6671` | `npm run dev` |
| **akshare** | 自研 Flask（[app.py](./Back-End/ak/akshare/app.py)，含定制接口） | `6680` | `6681` | 需开两个终端，见下 |

<details>
<summary>📦 akshare 模式启动步骤（点击展开）</summary>

```bash
# 终端 1：启动 Flask 后端
npm run start:server:akshare

# 终端 2：启动前端
npm run start:frontend:akshare
```

访问 http://localhost:6681/

</details>

<details>
<summary>🔧 分别启动 aktools 前后端（调试用）</summary>

```bash
# 终端 1：后端服务（端口 6670）  http://localhost:6670/
npm run start:server:aktools

# 终端 2：前端页面（端口 6671）  http://localhost:6671/
npm run start:frontend:aktools
```

</details>

---

## 📜 常用命令

所有脚本均定义在根目录 [package.json](./package.json)：

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | **同时启动 aktools 后端 + 前端**（退出时自动清理子进程） |
| `npm run start:server:aktools` | 启动 aktools 服务（:6670） |
| `npm run start:frontend:aktools` | 启动前端（:6671，mode=aktools） |
| `npm run start:server:akshare` | 启动自研 Flask 服务（:6680） |
| `npm run start:frontend:akshare` | 启动前端（:6681，mode=akshare） |
| `npm run upgrade:aktools` | 升级 aktools |
| `npm run upgrade:akshare` | 升级 akshare |
| `npm run upgrade:pandas` | 升级 pandas |
| `npm run upgrade:all` | 升级以上全部 Python 依赖 |

> 💡 根目录脚本同样兼容 yarn，例如 `yarn start:server:aktools`、`yarn start:frontend:aktools` 与上表的 `npm run …` 等价。

前端工程内还可使用：

```bash
cd Front-End
yarn dev          # 本地开发
yarn build        # 生产构建
yarn build:check  # tsc 类型检查 + 构建
yarn lint         # ESLint 检查
```

---

## 📂 目录结构

```text
financial/
├── Back-End/
│   └── ak/
│       ├── akshare/            # 自研 Flask 服务（定制化接口）
│       │   ├── app.py
│       │   ├── below_net_asset.py
│       │   └── index.py
│       └── aktools/            # AKTools HTTP 服务目录
├── Front-End/
│   ├── src/
│   │   ├── config/             # 菜单配置 menuConfig / 应用配置
│   │   ├── layouts/            # 主布局
│   │   ├── pages/              # 业务页面（按资产类别组织）
│   │   │   ├── stock/          # 股票（A股 / 港股 / 美股）
│   │   │   ├── fund/           # 基金
│   │   │   ├── bond/           # 债券
│   │   │   ├── commodity/      # 大宗商品
│   │   │   ├── global/         # 全球指数
│   │   │   ├── realestate/     # 房地产 / REITs
│   │   │   └── knowledge/      # 知识课堂
│   │   ├── routers/            # 路由表（由菜单配置自动生成）
│   │   └── utils/              # stockUtils / fundUtils / recommendationBatch 等
│   ├── .env.aktools            # aktools 模式环境变量
│   ├── .env.akshare            # akshare 模式环境变量
│   └── vite.config.ts
├── package.json                # 根脚本：启动 / 升级
└── README.md
```

---

## ⭐ 核心能力：自选与推荐买点

基金、A股个股、A股指数三个自选表格均支持量化推荐买点，并持久化在浏览器 localStorage：

- **自选池管理**：在「全部」列表勾选加入自选，行情刷新时已计算的买点不丢失。
- **推荐买点（定量）**：基于日 / 周 / 月 / 季 K 线 RSI6 的共振分级策略（★5 / ★3 / ★1）。
- **推荐买点（百分位）**：月 RSI6 与季 RSI6 同时处于历史低分位（3% / 5% / 10%）时买入；★5 买点持仓且双双突破 85% 分位时卖出配对。
- **近期买点高亮**：距今 **100 天** 内的买点日期以橙色加粗标签高亮，阈值在公共方法中可配置（`RECENT_BUY_POINT_DAYS`）。
- **批量渐进/批量提交计算**：逐只串行请求并显示 `(i/N)` 进度；页面可选择逐行刷新或全部完成后统一写入。
- **基金收益率口径修正**：基金使用「累计收益率」序列，持有期收益按净值比折算，避免买入值为负时收益率符号翻转。

核心算法沉淀于：

- [stockUtils.ts](./Front-End/src/utils/stockUtils.ts)：RSI 计算、定量/百分位策略、分位工具
- [fundUtils.ts](./Front-End/src/utils/fundUtils.ts)：基金月/季 RSI6 与买点计算
- [recommendationBatch.ts](./Front-End/src/utils/recommendationBatch.ts)：批量计算编排（进度 / 增量更新 / 持久化）

---

## ❓ 常见问题

<details>
<summary>端口 6670 / 6671 被占用怎么办？</summary>

启动脚本内置 `lsof -ti:<port> | kill -9` 会自动清理；也可手动执行：

```bash
lsof -ti:6670 | xargs kill -9
lsof -ti:6671 | xargs kill -9
```

</details>

<details>
<summary>提示数据获取失败 / 接口报错？</summary>

AKShare 迭代频繁，优先升级到最新版本后重试：

```bash
npm run upgrade:all
```

</details>

<details>
<summary>前端请求打到了错误的后端端口？</summary>

检查启动时使用的 mode：aktools → `6670`，akshare → `6680`，对应环境变量文件为 `Front-End/.env.aktools` 与 `Front-End/.env.akshare`。

</details>

<details>
<summary>没有 <code>python3.14</code> 命令？</summary>

项目统一要求 **Python 3.14**，请先安装 3.14 并确认命令可用：

```bash
python3.14 --version   # 应输出 Python 3.14.x
```

安装完成后再执行上文「Python 依赖」中的命令。

</details>

---

## 🙏 致谢与引用

本项目数据能力来源于开源项目 [AKShare](https://github.com/akfamily/akshare) 与 [AKTools](https://github.com/akfamily/aktools)，感谢 AKFamily 团队的贡献。

```bibtex
@misc{akshare2022,
    author       = {Albert King},
    title        = {AKShare},
    year         = {2022},
    publisher    = {GitHub},
    journal      = {GitHub repository},
    howpublished = {\url{https://github.com/akfamily/akshare}},
}
```

<div align="center">
<br />

⚠️ 本平台仅用于数据展示与学习研究，所有数据与策略信号**不构成任何投资建议**，据此操作风险自担。

</div>
