---
name: "financial-feature"
description: "按项目约定新增金融数据功能页（前端菜单/路由/页面/图表/表格 + 可选后端接口）。当用户要求新增金融数据页面、新增股票/基金/宏观等功能、添加 AKShare 数据展示页时调用。"
---

# 新增金融数据功能页

本 skill 用于在 financial 项目中按既有约定新增一个完整的金融数据功能页，覆盖「前端菜单注册 → 路由 → 页面组件 → API 调用 → 图表/表格展示」全链路，并在需要时新增后端接口。

## 项目背景

- **后端**：项目主要使用 **aktools 官方服务**（端口 6670），它自动把所有 AKShare 函数暴露为 HTTP 接口，路径为 `/api/public/<akshare函数名>`。**无需手写后端接口**，前端直接调用即可。另有 `Back-End/ak/akshare/app.py`（自建 Flask，端口 6680）作为备选，仅用于 aktools 未覆盖或需自定义逻辑的场景。
- **前端**：`Front-End/`，React 19 + TypeScript + Vite 7 + Ant Design 6 + @ant-design/charts。
- **默认运行模式**：aktools（`.env.aktools`：`VITE_API_PORT='http://127.0.0.1:6670'`、`VITE_API_API_TYPE='aktools'`）。
- **API 请求格式**：统一用 `/api/public/<akshare原函数名>`，如 `/api/public/fund_report_asset_allocation_cninfo`、`/api/public/macro_china_gdp`。
- **响应结构**：aktools 模式下 `response.data` **直接是数据数组**（非 `{success, data, message}` 包装）。
- **数据字段多为中文**（来自 akshare 原始 DataFrame 列名）。

## 执行步骤

### 第 1 步：明确需求

向用户确认以下信息（若未给出）：
1. 功能所属分类（股票/基金/大宗商品/房地产/宏观等）
2. 对应的 AKShare 接口名（如 `stock_a_gxl_lg`、`fund_open_fund_rank_em`、`macro_china_gdp`）
3. 展示形式（折线图 / 双轴图 / 表格 / 多图表组合）
4. 是否需要入参（如 `symbol`、`start_date`）

### 第 2 步：确认后端接口是否可用（aktools 模式默认无需写后端）

**默认情况下无需新增后端接口**。aktools 官方服务已自动暴露所有 akshare 函数，前端直接请求：

```
GET http://127.0.0.1:6670/api/public/<akshare函数名>?<参数>
```

例如 akshare 有 `fund_report_asset_allocation_cninfo()` 函数，前端即可直接调用 `/api/public/fund_report_asset_allocation_cninfo`。

**仅当以下情况才需在 `Back-End/ak/akshare/app.py` 新增自建接口**（akshare 模式，端口 6680）：
- aktools 未暴露该函数
- 需要自定义数据处理逻辑
- 需要聚合多个 akshare 接口

若需新增自建接口，按以下模板（严格遵循统一响应格式与错误处理）：

```python
@app.route('/api/public/<akshare函数名>', methods=['GET'])
def get_xxx():
    """获取XXX数据"""
    try:
        symbol = request.args.get('symbol', '默认值')
        result = ak.<akshare函数名>(symbol=symbol).to_dict(orient='records')
        return jsonify({
            'success': True,
            'data': result,
            'message': '获取数据成功'
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'data': None,
            'message': '获取数据失败: {}'.format(str(e))
        })
```

**自建接口约定**：
- 路由路径统一用 `/api/public/<akshare原函数名>`，与 aktools 保持一致
- 必须用 `try/except` 包裹，异常时返回 `success: False`
- DataFrame 用 `.to_dict(orient='records')` 转换
- 若 DataFrame 有非默认索引，先 `result.reset_index()` 再转换
- **注意**：自建接口响应是 `{success, data, message}` 包装，前端取值需用 `response.data.data`（与 aktools 模式的 `response.data` 直接为数组不同）

### 第 3 步：前端菜单与路由注册

在 `Front-End/src/config/menuConfig.tsx` 的 `menuConfigs` 数组中，按分类层级新增菜单项。**必须用 lazy import**：

```tsx
{
  key: 'stock/a/xxx',          // 唯一 key，与 path 对应
  label: 'XXX功能',
  path: 'stock/a/xxx',         // 路由路径（不含前导 /）
  component: lazy(() => import('@/pages/stock/a/xxx')),
  // 如有详情子页，加 children
  children: [
    {
      key: 'stock/a/xxx/detail',
      label: 'XXX详情',
      path: 'stock/a/xxx/detail',
      component: lazy(() => import('@/pages/stock/a/xxx/detail')),
    },
  ],
},
```

**约定**：
- `key` 与 `path` 保持一致（不含前导 `/`）
- 父级菜单（有 children）只填 `key`/`label`/`icon`/`children`，不填 `path`/`component`
- 叶子菜单必须同时有 `path` 和 `component`
- 路由会自动通过 `routeConfigs` 收集并注入 `routers/index.tsx`，无需手动改路由文件
- `menuItems`（传给 antd Menu）会自动从 `menuConfigs` 映射，但**只支持两层 children**，更深层级需检查 `menuItems` 映射逻辑

**同步使用手册（必做）**：新增或调整页面后，必须在 `Front-End/src/config/userManualConfig.ts` 的 `userManualItems` 中新增/更新对应 `menuKey` 的 `features`：
- 新增页面 → 新增 `{ menuKey, features }`，`menuKey` 与 `menuConfig.tsx` 叶子菜单 `key` 完全一致；
- 已有页面结构调整（tab/列/按钮/筛选/跳转）→ 同步修改该条目，删除过期描述；
- 只写用户可见功能，详细规则见技能 `code-change-skill-sync`。

### 第 4 步：创建页面文件

页面目录按领域组织：`src/pages/<category>/<region>/<feature>/index.tsx`。

根据展示形式选择对应模板。**所有模板的 API 请求统一用 `/api/public/<akshare函数名>` 格式**。

#### 模板 A：图表页（折线图 / 双轴图）

参考 `src/pages/fund/cn/fund-asset-allocation/index.tsx`、`src/pages/stock/a/valuation/index.tsx` 的 DualAxes 模式。核心结构：

```tsx
import { DualAxes } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { pick } from 'lodash-es';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const XxxPage = () => {
  const chartName = '图表标题';
  const dateKey = '日期';        // akshare 返回的日期列名（中文）
  const leftKey = '收盘';        // 左 y 轴字段（中文）
  const leftName = '指数';       // 左 y 轴显示名
  const rightKeys = { 滚动市盈率: '滚动市盈率' }; // 右 y 轴字段映射
  const sampleRate = 10;         // 抽样率，数据量大时用

  type DataRes = {
    [dateKey]: string;
    [leftKey]: number;
  } & {
    [K in keyof typeof rightKeys]: number;
  };

  const labelMap = { [dateKey]: dateKey, [leftKey]: leftName, ...rightKeys };

  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: { date: string; key: string; value: number }[];
  }>({ leftData: [], rightData: [] });

  const fetchData = async () => {
    try {
      // 统一用 /api/public/<akshare函数名>，aktools 模式下 response.data 直接是数组
      const response = await apiClient.get('/api/public/<akshare函数名>');
      console.log(`${chartName} -> response`, response);

      const dataFormat = response?.data
        ?.filter((_: unknown, index: number) => index % sampleRate === 0)
        ?.map((item: DataRes) =>
          Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
            date: item[dateKey],
            key,
            label: labelMap[key as keyof typeof labelMap],
            value: item[key as keyof DataRes],
          })),
        )
        .flat();

      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey) ?? [],
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey) ?? [],
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const config = {
    title: { title: chartName },
    xField: (d: { date: string }) => new Date(d.date),
    children: [
      {
        data: data.leftData,
        type: 'line' as const,
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth' as const,
        axis: { y: { title: leftName } },
      },
      {
        data: data.rightData,
        type: 'line' as const,
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth' as const,
        axis: { y: { position: 'right' as const, title: '右轴' } },
      },
    ],
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>
          刷新数据
        </Button>
      </div>
      <DualAxes {...config} />
    </>
  );
};

export default XxxPage;
```

**带入参的调用**：

```tsx
const response = await apiClient.get('/api/public/stock_zh_index_hist_csindex', {
  params: {
    symbol: '000985',
    start_date: '20050101',
    end_date: moment().format('YYYYMMDD'),
  },
});
```

#### 模板 B：表格页

参考 `src/pages/fund/cn/open/index.tsx`。核心结构：

```tsx
import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Select } from 'antd';
import apiClient from '@/utils/axios';
import { createRangeFilter, numberSorter, stringSorter } from '@/utils/tableUtils';

interface RowData {
  序号: number;
  代码: string;
  名称: string;
  // ...按 akshare 返回的中文列名定义
}

const XxxPage: React.FC = () => {
  const [data, setData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 统一用 /api/public/<akshare函数名>，response.data 直接是数组
      const response = await apiClient.get('/api/public/<akshare函数名>');
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    { title: '序号', dataIndex: '序号', sorter: numberSorter<RowData>('序号') },
    { title: '代码', dataIndex: '代码', sorter: stringSorter<RowData>('代码') },
    {
      title: '数值',
      dataIndex: '数值',
      sorter: numberSorter<RowData>('数值'),
      filterDropdown: createRangeFilter<RowData>('数值').filterDropdown,
      filterIcon: createRangeFilter<RowData>('数值').filterIcon,
      onFilter: createRangeFilter<RowData>('数值').onFilter,
    },
  ];

  return (
    <Card>
      <Table
        rowKey="代码"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination(p)}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default XxxPage;
```

#### 模板 C：多图表组合页（宏观类）

参考 `src/pages/stock/a/macro/components.tsx` 的 `useMacroData` Hook + `createChartConfig` 模式，适合一个接口拆成多个折线图展示。该文件已封装通用数据获取 Hook，新增同类图表只需扩展数据处理器。

### 第 5 步：API 调用约定（核心）

**统一用 `@/utils/axios` 的默认导出 `apiClient`**，不要直接 `import axios from 'axios'`（部分旧代码直接用 axios，新代码请遵循规范）。

```tsx
import apiClient from '@/utils/axios';

// GET 请求，统一用 /api/public/<akshare函数名>
const response = await apiClient.get('/api/public/<akshare函数名>');
const data = response?.data;  // aktools 模式下直接是数组

// 带参数
const response = await apiClient.get('/api/public/<akshare函数名>', {
  params: { symbol: '000001', start_date: '20200101' },
});
```

**请求路径规则**：
- **统一用 `/api/public/<akshare原函数名>`**（aktools 模式，默认）
- 路径中的函数名与 akshare Python 函数名完全一致（如 `fund_report_asset_allocation_cninfo`、`macro_china_gdp`、`stock_zh_a_spot_em`）
- **不要**自创路径如 `/api/stock/a/xxx`（那是 akshare 自建模式的旧约定，项目已弃用）

**响应数据取值**：
- **aktools 模式（默认）**：`response.data` 直接是数据数组，用 `response?.data || []` 取值
- **akshare 自建模式（仅当新增了 app.py 接口）**：`response.data` 是 `{ success, data, message }`，实际数据在 `response.data.data`
- 新增页面时默认按 aktools 模式取值（`response.data` 直接为数组）

**双后端兼容（可选）**：若该接口需同时支持两种模式且 URL 不同，参考 `src/utils/akshareApi.ts` 的写法：

```tsx
const url = import.meta.env.VITE_API_API_TYPE === 'akshare'
  ? `/api/stock/a/xxx?${queryString.stringify(params)}`
  : `/api/public/xxx?${queryString.stringify(params)}`;
const response = await apiClient.get<T>(url);
```

但**绝大多数情况下无需做双后端兼容**，直接用 `/api/public/<akshare函数名>` 即可。

### 第 6 步：可用工具函数

优先复用 `src/utils/` 下已有工具：

- **`stockUtils.ts`**：
  - `calculateMaxDrawdown`：计算最大回撤率、年化收益率（峰值以首值为基准，累计收益率负起点不会虚构回撤）；传入 `percentKey` 时额外产出 15%/85% 百分位列，未传则不产出这些字段（避免 `undefined` 列名与 NaN）
- **`tableUtils.tsx`**：
  - `createRangeFilter<T>(key)`：表格数值范围筛选（含 filterDropdown/filterIcon/onFilter）
  - `numberSorter<T>(key)`：数值排序
  - `stringSorter<T>(key)`：字符串排序（中文 localeCompare）
- **`akshareApi.ts`**：已封装的双后端兼容 API 调用（仅当需要双模式兼容时参考，新增同类接口可在此扩展）

图表配置参考 `src/pages/stock/a/macro/components.tsx` 的 `createChartConfig` 通用生成器。

### 第 7 步：验证

**默认使用 aktools 模式**：

1. 启动后端：`yarn start:server:aktools`（端口 6670）
2. 启动前端：`yarn start:frontend:aktools`（端口 6671）
3. 访问 `http://localhost:6671/<路由路径>` 验证页面
4. 浏览器控制台检查 `console.log` 输出的 response 数据结构是否符合预期
5. 使用手册已同步：`Front-End/src/config/userManualConfig.ts` 中存在本次页面 `menuKey` 的条目，且描述与页面当前实际功能一致
6. 若数据字段名不确定，可在 Python 中 `import akshare as ak; print(ak.<函数名>().columns.tolist())` 确认列名
7. 若接口 404，确认 aktools 服务已启动且该 akshare 函数存在

**akshare 自建模式（仅当新增了 app.py 接口时）**：
- 启动后端：`yarn start:server:akshare`（端口 6680）
- 启动前端：`yarn start:frontend:akshare`（端口 6681）

## 关键约定速查

| 项目 | 约定 |
|------|------|
| 默认后端模式 | **aktools**（端口 6670，自动暴露所有 akshare 函数） |
| API 请求路径 | **`/api/public/<akshare原函数名>`**（统一格式） |
| API 响应（aktools） | `response.data` 直接是数组 |
| API 响应（akshare 自建） | `response.data` 是 `{ success, data, message }`，取 `response.data.data` |
| API 客户端 | `@/utils/axios` 默认导出 `apiClient` |
| 路径别名 | `@` → `src/` |
| 菜单配置 | `src/config/menuConfig.tsx`（集中式，自动生成路由） |
| 路由 | 自动从 menuConfigs 收集，无需手动改 `routers/index.tsx` |
| 数据字段 | 中文（akshare 原始列名） |
| 图表库 | `@ant-design/plots`（Line、DualAxes） |
| 表格筛选 | `createRangeFilter` / `numberSorter` / `stringSorter` |
| 菜单层级 | 最多两层 children（antd Menu 映射限制） |
| 端口 | aktools 后端 6670 / 前端 6671；akshare 后端 6680 / 前端 6681 |

## 详情页技术指标 tab（MACD 示例）

在已有行情详情页（如 A 股个股 `/stock/a/stock/detail`）新增技术指标 tab 时，按以下约定：

1. **组件位置**：放 `Front-End/src/components/`（跨页面复用），页面内用 `React.lazy` + `Suspense` 引入。
2. **Props**：`data: KLineData[]` 为必传（日 K，至少含 `日期`/`收盘`，基金场景 `收盘` 为累计收益率）；`type?: 'stock' | 'index' | 'fund' | 'commodity'` 默认 `stock`，仅影响「收盘价 / 累计收益率」文案；`visiblePeriods?: MacdPeriodKey[]` 默认全部四周期，基金可传 `['monthly','quarterly']`；传空数组则不展示任何周期。
3. **多周期口径**：日 K 直接算；周/月/季先用 `aggregateKLineByPeriod` 聚合，再按同一参数独立计算。MACD 参数取自 `appConfig.chart.macd.macdParams`（默认快/慢/信号线 `12/26/9`）：`DIF=EMA(收盘,快线)-EMA(收盘,慢线)`、`DEA=EMA(DIF,信号线)`、`MACD柱=2×(DIF-DEA)`，计算内核为 `stockUtils.calculateMACD`；内核同时产出派生序列 `DEA-DIF`（= −MACD柱/2）与 `DEA÷DIF`（DIF=0 时为 `null`）。
4. **图表组合**：用 `DualAxes` 叠加三个同 X 视图——主视图画 DIF/DEA/DEA-DIF 三条折线并负责 shared tooltip（按日期查表补齐柱/DIFF/DEA/DEA-DIF/DEA÷DIF 五个值），柱状视图画 interval 柱（正红负绿）且只关闭 y 轴（`axis: { y: false }`），比值视图画 `DEA÷DIF` 粉色实线并使用独立缩放、隐藏轴（右侧轴让给价格线）。x 轴配置必须放在**顶层** `axis.x`，否则后续 mark 的 axis 配置会把共享 x guide 置空、导致日期轴消失。主视图与柱状视图显式设置相同的 y `domain`（包含 0）保证零轴对齐；比值显示范围取 `MacdFilterMark.tsx` 顶部的展示参数 `RATIO_DISPLAY_PERCENTILES`（默认 2%~98%），上下额外留白取 `RATIO_DISPLAY_PADDING_RATIO`；超出范围的比值**钳制到上下边界**（不要置空，否则曲线会出现缺失时段），tooltip 仍为真实值。
5. **图例过滤**：每个周期图的自定义图例可点击（`role="button"` + `tabIndex`，支持 Enter/Space），按 `MacdLegendKey`（`bar`/`dif`/`dea`/`deaMinusDif`/`ratio`/`price`）独立记录隐藏状态；被隐藏的折线不进入长表数据、柱/比值 mark 直接不生成，`price` 隐藏时价格线与青色价格线标记一并隐藏。MACD 柱正/负两个图例共用 `bar` 键。主折线被全部隐藏时 tooltip 依次回退到柱、比值；全部系列隐藏时显示占位提示而不是空图。
6. **样本区间（as-of）**：组件顶部提供 `DatePicker.RangePicker`，支持双边/单边区间与「清除开始/结束」；**先按区间裁剪 `data` 得到 `filteredData`，再基于它重算各周期 MACD（月/季同时重算峰值）**，区间外数据完全不使用。为避免切换区间时 G2 重绘阻塞日期面板：选择器状态 `sampleRange` 立即更新，实际计算用 `appliedRange`，通过 `setTimeout(0) + startTransition` 延后提交；两者不一致期间显示 `Spin`「MACD 指标与峰值重算中」，图表配置设 `animate: false`。**月K最低柱标记的 MACD 预热门槛按样本内月K索引计算**：样本区间内月K不足 `minMonthlyBars` 时不产生最低柱标记。
7. **峰值标记与买点表（as-of）**：峰值检测用 `stockUtils.findConfirmedPeaks`：只回看过去 `peakWindows` 根（月6 / 季4，来自 `appConfig.chart.macd`）要求为窗口最高，且峰值后 `peakConfirmLags` 根（默认 1，可按周期配置）全部回落才确认；确认回落使用 `confirmValues` 传入真实比值，避免显示裁剪的 null 误判为未确认；确认日当天即产生买点，不使用确认日之后的数据。**红色峰值买点属于右侧交易：需要等待下一个周期数据判断，默认最多存在 n=1 个周期的确认延迟（峰值后第 1 根才产生买入信号）。**红点仍标在峰值位置；买点表用 `stockUtils.mapConfirmedPeakRows` 配对峰值行/确认行：峰值日期、峰值收盘价、DEA÷DIF、MACD、DEA、DIFF 取峰值日数据；「买入收盘价（N根后）」取峰值后第 N 根确认日的收盘价，并在单元格内展示确认日期。峰值参与判定的比值上限取自 `appConfig.chart.macd.peakRatioCap`（当前为 `Infinity`，表示不设上限）；所有高于显示下限的有效比值都参与峰值判定，不再过滤 74.15 或数百上千的极端但有效峰值。**仅月/季参与买点判定：日K数据过密、周K仅保留 MACD 图，均不标记峰值与买点表。**主折线全隐藏时由柱状图承担左 y 轴。表格与图例隐藏状态无关。
8. **测试**：公共计算函数改动必须补 `Front-End/test/macd.test.ts` 一类用例（含 `calculateMACD`、`cleanCsindexHistory`、`findLocalMaxima`、`findConfirmedPeaks`、`findMacdBarReboundMarks`、`mapConfirmedPeakRows`），并运行 `npm test`；MACD 预热门槛与导出列另见 `test/macdBarMarkerExport.test.ts`。
9. **跨页面接入现状**：所有展示 `RsiFilterMark` 的页面都同时接入 `MacdFilterMark`，两者必须放在相互独立的区块（独立 `Collapse.Panel` / Tab / 组件块），不得混在同一面板；props 与 `RsiFilterMark` 保持一致（`data` / `type` / `visiblePeriods`）。涉及页面：全球指数详情、商品详情、外盘期货详情、生猪指数、A 股指数详情、港股个股详情、港股指数详情、美股指数、基金详情（`FundRsiFilterMark`）。A 股个股详情页与港股个股详情页均使用独立的「RSI6 技术指标」「MACD 技术指标」tab。
10. **日涨跌幅分析**：有日 K 数据的详情页同时接入 `DailyReturnAnalysis`（独立 `Collapse.Panel` / Tab / 组件块）：A 股个股、A 股指数、港股个股、港股指数、美股指数、全球指数、国内商品、外盘期货。生猪指数为周频数据、基金详情为累计收益率序列（非日 K 价格），不接入。
11. **MACD柱负连续区间最小柱标记（数据）**：`stockUtils.findMacdBarReboundMarks` 检测连续负值区间，区间长度至少为 n（n 复用各周期 `appConfig.chart.macd.peakWindows`：月6 / 季4；仅月/季标记，日K与周K不标记），取**整个连续负值区间**的最小值（并列时取最早一根）；**最低柱的下一周期**柱值高于该最小值时，产出该最小值柱（`index`/`bar`）与下一周期确认柱（`confirmIndex`/`confirmBar`）。每个连续负值区间最多一条记录，后面的局部低点不重复标记；若区间内出现新的更低点，记录跟随新的最小值柱。**月K额外增加 MACD 预热门槛**：最低柱索引必须 ≥ `appConfig.chart.macd.minMonthlyBars - 1`（默认 35 根 = 慢线 26 + 信号线 9），`MacdFilterMark` 在 `periodResults` 中对月K过滤、季K不受限；导出 `macdBarMarkerExport` 使用同一门槛。该数据不参与、不改变「红色峰值买点」及买入逻辑。
12. **MACD价格线与双标记（展示）**：`MacdFilterMark` 在各周期 MACD 图上叠加价格线（指数为「指数」、股票/商品为「收盘价」、基金为「累计收益率」，取聚合后周期的 `收盘`），使用右侧独立轴；`DEA÷DIF` 改为独立缩放、隐藏轴（峰值标签仍显示真实值）。价格线右轴上下基础留白由 `PRICE_LINE_BASE_PADDING_RATIO`（默认 0.05）控制，底部额外留白由 `PRICE_LINE_BOTTOM_PADDING_RATIO`（默认 0.9）控制，使价格线整体上移、减少与 MACD 柱/线重叠；底部设为 0 表示只保留基础留白。颜色、周期主题色、图表高度、标记点/峰值样式、MACD 折线/柱/比值线/价格线样式均集中在 `MacdFilterMark.tsx` 顶部展示参数区；`appConfig.chart.macd` 只保留策略参数（`macdParams` / `minMonthlyBars` / `peakRatioCap` / `peakWindows` / `peakConfirmLags`）。**保留原有金色圆点**：标在最低 MACD 柱；**新增青色圆点**：标在价格线上、`confirmIndex` 对应的下一周期价格。`price` 图例可单独显示/隐藏价格线和青色标记，`bar` 图例控制金色柱标记。图表下方在原「红色峰值买点」表之后新增「最低 MACD 柱下一周期价格线标记」表（最低柱日期/值/价格、连续负值柱数、下一周期日期/价格/MACD），原红色峰值买点表与逻辑保持不变。**买点标记与两张表仅月/季启用；周K仍保留 MACD 图，但不显示红色峰值买点表与最低柱标记表。**

### 中证指数历史起始日与占位行

`/api/public/stock_zh_index_hist_csindex` 在 `start_date` 早于指数首条真实数据时，会补一条「日期 = start_date、数值与下一条完全重复」的占位行（`收盘=基点`、开高低为空）。统一处理方式：

- 起始日使用 `appConfig.http.indexHistoryStartDate`（默认 `19901219`，A 股最早交易日）；
- 用 `stockUtils.cleanCsindexHistory(rows, startDate)` 清洗，禁止再写 `19800101` 或用「收盘 % 100」等启发式切片；
- 指数列表买点计算与指数详情页都必须走同一函数，避免两边口径不一致。

### 多数据源指数列表合并（中证 + 新浪）

`/stock/a/index` 的「全部」Tab 同时拉取 `/api/public/index_csindex_all` 与 `/api/public/stock_zh_index_spot_sina`，由 `stockUtils.mergeIndexSpotLists` 统一合并：

- 新浪字段映射：`代码 → 指数代码`（保留 `sh/sz` 前缀）、`名称 → 指数简称`、`最新价 → 最新收盘`；新浪行情补充列（涨跌额/涨跌幅/昨收/今开/最高/最低/成交量/成交额）在中证行显示「-」。
- 同码匹配统一用 `stockUtils.normalizeIndexCode`：仅对「`sh/sz/bj` + 数字」去前缀并转小写，避免误伤中证字母代码（如 `SHHKSI`）；同码以中证行为准，只补新浪行情字段，标记 `数据源 = 中证+新浪`；仅新浪有的指数追加到尾部，标记 `数据源 = 新浪`。列表按 `指数代码` 去重后唯一。
- 详情/日线取数必须按 `数据源` 分流：中证行（含「中证+新浪」）走 `stock_zh_index_hist_csindex`（6 位代码，配合 `cleanCsindexHistory`）；`数据源 === '新浪'` 走 `stock_zh_index_daily`（必须带 `sh/sz` 前缀），返回 `date/close` 统一用 `stockUtils.normalizeSinaIndexDailyRows` 归一化为 `日期/收盘`（ISO 日期转 `YYYY-MM-DD`、过滤非正收盘）。详情页通过 `source=sina&name=...` 参数切换；`name` 由 `URLSearchParams.get` 自动解码，禁止再调用 `decodeURIComponent`（名称含 `%` 会抛 URIError）。
- 自选/自定义分组刷新按「完整代码优先、去前缀同码回退」匹配，并保留 4 个买点字段。
- 展示说明：`index/index.tsx` 顶部 `DATA_SOURCE_STYLES` 定义三种数据源配色（中证灰 / 中证+新浪金 / 新浪橙），「全部」Tab 用浅蓝信息条 + 彩色标签解释含义，表格「数据源」列复用同一套标签样式。

## 注意事项

- **新增页面默认无需写后端**：aktools 已自动暴露所有 akshare 函数，前端直接调 `/api/public/<函数名>` 即可
- **不要自创 API 路径**：统一用 `/api/public/<akshare原函数名>`，不要用 `/api/stock/a/xxx` 等自建路径（除非确实需要自建接口）
- 新增页面后，若菜单层级超过两层，需检查 `menuItems` 映射逻辑（当前 `menuConfig.tsx` 中 `menuItems` 只映射到第二层 children）
- akshare 返回的 DataFrame 列名常为中文，前端 TypeScript interface 需用中文键名（如 `序号: number`）
- 数据量过大时用 `sampleRate` 抽样（如 `index % 10 === 0`）
- 日期格式不统一（有 `YYYYMMDD`、`YYYY-MM-DD`、`季度` 等），用 `moment` 统一处理
- 不要直接 `import axios from 'axios'`，统一用 `@/utils/axios` 的 `apiClient`
- 图表组件用 `@ant-design/plots`（不是 `@ant-design/charts`，注意包名差异）
