# todo 待完善：目前的RSI计算方法是基于14天的平均增益和损失，后续可以优化为直接使用指定周期的平均增益和损失来计算RSI，以提高准确性。

# 获取日线、周线、月线的RSI(6)、RSI(12)、RSI(24)

import akshare as ak
# import pandas as pd

# 1. 获取基础K线数据
symbol = "601186" # 中国铁建
period_map = {
    'daily': 'daily',
    'weekly': 'weekly',
    'monthly': 'monthly'
}

# 获取不同周期的数据
df_daily = ak.stock_zh_a_hist(symbol=symbol, period=period_map['daily'], adjust="qfq")
df_weekly = ak.stock_zh_a_hist(symbol=symbol, period=period_map['weekly'], adjust="qfq")
df_monthly = ak.stock_zh_a_hist(symbol=symbol, period=period_map['monthly'], adjust="qfq")

# 2. 计算RSI函数
def calculate_rsi(data, periods=[6, 12, 24], price_col='收盘'):
    """
    计算RSI指标
    :param data: 包含价格列的DataFrame
    :param periods: RSI周期列表
    :param price_col: 价格列名，默认为'收盘'
    :return: 添加了RSI列的DataFrame
    """
    df = data.copy()
    # 确保按日期排序
    df = df.sort_index() if df.index.name == '日期' else df.sort_values('日期')
    
    delta = df[price_col].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()  # 临时窗口，后续会被覆盖
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    
    for period in periods:
        # 计算特定周期的平均增益和损失
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        # 计算RS
        rs = avg_gain / avg_loss
        # 计算RSI
        df[f'RSI_{period}'] = 100 - (100 / (1 + rs))
    
    return df

# 3. 为各周期数据计算RSI
# 注意：确保DataFrame包含“收盘”列，这是AKShare返回的默认列名
df_daily_rsi = calculate_rsi(df_daily, periods=[6, 12, 24])
df_weekly_rsi = calculate_rsi(df_weekly, periods=[6, 12, 24])
df_monthly_rsi = calculate_rsi(df_monthly, periods=[6, 12, 24])

# 4. 查看结果（例如日线的最后几行）
print("RSI计算结果:----------------------------------------------------------------------")
print("daily-日线数据RSI计算结果👇🏻")
print(df_daily_rsi[['日期', '收盘', 'RSI_6', 'RSI_12', 'RSI_24']].tail(10))
print("weekly-周线数据RSI计算结果👇🏻")
print(df_weekly_rsi[['日期', '收盘', 'RSI_6', 'RSI_12', 'RSI_24']].tail(10))
print("monthly-月线数据RSI计算结果👇🏻")
print(df_monthly_rsi[['日期', '收盘', 'RSI_6', 'RSI_12', 'RSI_24']].tail(10))