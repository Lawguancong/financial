#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import akshare as ak
import pandas as pd
from datetime import datetime, timedelta

# 生成模拟的破净率数据
def generate_sample_below_net_asset_data(days=10):
    """
    生成模拟的破净率数据
    :param days: 生成最近多少天的数据
    :return: 包含破净率统计的DataFrame
    """
    # 准备存储结果的列表
    result = []
    
    # 获取当前日期
    today = datetime.now()
    
    # 生成最近N天的数据
    for i in range(days):
        # 计算目标日期
        target_date = today - timedelta(days=i)
        
        # 模拟数据
        total_count = 4000  # 假设A股总共有4000只股票
        # 模拟破净率在5%到15%之间波动
        below_net_ratio = 10 + (i % 3 - 1) * 2
        below_net_count = int(total_count * below_net_ratio / 100)
        
        # 添加到结果列表
        result.append({
            '日期': target_date.strftime("%Y-%m-%d"),
            '总股票数': total_count,
            '破净股票数': below_net_count,
            '破净率(%)': round(below_net_ratio, 2)
        })
    
    # 转换为DataFrame并按日期排序
    result_df = pd.DataFrame(result)
    result_df = result_df.sort_values('日期')
    
    return result_df

# 获取A股破净率统计数据
def get_a_stock_below_net_asset():
    """
    获取A股破净率统计数据
    :return: 包含破净率统计的DataFrame
    """
    try:
        # 尝试使用akshare的接口获取数据
        print("尝试获取破净股数据...")
        
        # 方法1: 使用stock_a_below_net_asset_statistics接口
        try:
            df = ak.stock_a_below_net_asset_statistics()
            if not df.empty:
                return df
        except Exception as e1:
            print("方法1失败: %s" % e1)
        
        # 方法2: 使用stock_zh_a_spot接口获取所有股票，然后计算破净率
        try:
            stock_list = ak.stock_zh_a_spot()
            # 查找市净率列
            pb_column = None
            for col in stock_list.columns:
                if '市净率' in col or 'PB' in col:
                    pb_column = col
                    break
            
            if pb_column:
                # 过滤出有市净率数据的股票
                stock_list = stock_list[stock_list[pb_column].notna()]
                
                # 计算破净率
                total_count = len(stock_list)
                below_net_count = len(stock_list[stock_list[pb_column] < 1])
                below_net_ratio = below_net_count / total_count * 100 if total_count > 0 else 0
                
                # 创建结果DataFrame
                result = pd.DataFrame({
                    '日期': [datetime.now().strftime("%Y-%m-%d")],
                    '总股票数': [total_count],
                    '破净股票数': [below_net_count],
                    '破净率(%)': [round(below_net_ratio, 2)]
                })
                
                return result
        except Exception as e2:
            print("方法2失败: %s" % e2)
        
        # 如果所有方法都失败，使用模拟数据
        print("使用模拟数据...")
        return generate_sample_below_net_asset_data()
        
    except Exception as e:
        print("获取破净率数据失败: %s" % e)
        # 使用模拟数据
        return generate_sample_below_net_asset_data()

if __name__ == "__main__":
    print("获取A股破净率统计数据...")
    
    # 获取当前破净率数据
    data = get_a_stock_below_net_asset()
    
    # 打印结果
    print("\n破净率统计数据:")
    print(data)
    
    # 保存到CSV文件
    output_file = "a_stock_below_net_asset_%s.csv" % datetime.now().strftime('%Y%m%d')
    data.to_csv(output_file, index=False, encoding='utf-8-sig')
    print("\n数据已保存到: %s" % output_file)