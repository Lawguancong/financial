# 接口: stock_zh_a_spot_em

# 目标地址: https://quote.eastmoney.com/center/gridlist.html#hs_a_board

# 描述: 东方财富网-沪深京 A 股-实时行情数据

# 限量: 单次返回所有沪深京 A 股上市公司的实时行情数据

import akshare as ak

stock_zh_a_spot_em_df = ak.stock_zh_a_spot_em()
print(stock_zh_a_spot_em_df)