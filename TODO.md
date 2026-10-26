# TODO

## 数据接口

### 个股

- 筹码分布：`stock_cyq_em`

### 股票列表

- 中国股票指数成份：`index_stock_cons`

### 分红数据

- 历史分红（巨潮）：`stock_dividend_cninfo`

### 资金数据

- 居民存款之比：暂无接口数据支持

### REITs

- REITs 历史行情：`reits_hist_em`

### 财务指标

- 港股财务指标：`stock_financial_hk_analysis_indicator_em`
- 美股财务指标：`stock_financial_us_analysis_indicator_em`
- 主要指标（东方财富）：`stock_financial_analysis_indicator_em`
- 利润表：`stock_financial_benefit_new_ths`
- 现金流量表：`stock_financial_cash_new_ths`
- 资产负债表：`stock_financial_debt_new_ths`
- 分红配送-东财接口：`stock_fhps_em`
- 分红配送详情-东财接口：`stock_fhps_detail_em`
- 公司概况-巨潮资讯接口：`stock_profile_cninfo`

> （行业/指数）接口不支持

### 估值

- 简单好用高效，不用太复杂
- 估值比较接口：`stock_zh_valuation_comparison_em`
- A 股财务指标：`stock_financial_analysis_indicator`
- A 股个股估值：`stock_value_em`（仅最近 10 年数据）

### 全球指数

- 接口不 ok：`index_global_spot_em`
- <https://quote.eastmoney.com/center/gridlist.html#global_qtzs>
- 接口 ok 的：`/api/public/index_global_hist_em?symbol=上证指数`
- A 股指数历史行情数据-新浪接口：`stock_zh_index_daily`（好接口、可深入研究）

### 待办

- 风险溢价
- 市盈率、盈利收益率、市净率、股息率、市现率

## 功能

- 计算 RSI6 买点，新增 worker js 线程计算，是否稳定？
- 再想想怎么优化
- RSI 买点报告数据、报表（如最大回撤率等等数据）
  - 策略绩效指标：年化收益率（大于 1 年）、最大回撤、回撤时间、夏普比率、Calmar 比率（年化收益 / 最大回撤）、胜率（交易次数 / 总次数）、盈亏比（平均盈利 / 平均亏损）、年化换手率、交易成本占比
  - todo： 年化收益率太低怎么优化？
  - 未来函数：优化asof（只用已走完的季度）
  - 优化： 8月的 季度RSI， 取8月的RSI6计算季度RSI6


- 新增kill，每次改动都有完善、补充skill，可以是新的skill或者原来的skill
 - RsiFilterMark 用一个worker计算，提高性能， 页面loading，计算完后去掉loading

- MACD 技术指标 todo 完善 绿色macd 递减 买点


