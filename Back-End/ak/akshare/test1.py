import akshare as ak
import pandas as pd

# 1. 指定指数代码（支持主流宽基指数）
# 常用指数代码映射
index_code_map = {
    "上证指数": "sh000001",
    "沪深300": "sh000300",
    "上证50": "sh000016",
    "中证500": "sh000905",
    "创业板指": "sz399006",
    "科创50": "sh000688"
}

# 2. 获取指数估值历史数据（以沪深300为例）
target_index = "沪深300"
df_valuation = ak.index_value_hist_funddb(symbol=index_code_map[target_index])

# 3. 查看数据列和最新估值
print(f"{target_index} 估值数据字段：")
print(df_valuation.columns.tolist())
print(f"\n{target_index} 最新估值数据（最近5个交易日）：")
# 关键字段通常包括：日期、市盈率、市净率、股息率等
print(df_valuation[['日期', '市盈率', '市净率']].tail())


