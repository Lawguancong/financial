#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
from flask import Flask, request, jsonify
from flask_cors import CORS
import akshare as ak
import pandas as pd

app = Flask(__name__)
CORS(app)  # 启用CORS，允许跨域请求

# 根路由
@app.route('/')
def index():
    return "Welcome to AKShare API Service"

# 股票相关接口
@app.route('/api/stock/a/gxl', methods=['GET'])
def get_stock_a_gxl():
    """获取A股股息率数据"""
    try:
        # 暂时返回模拟数据，需要根据akshare库的实际参数格式进行修改
        # result = [
        #     {"date": "2024-01-01", "gxl": 0.025},
        #     {"date": "2024-02-01", "gxl": 0.026},
        #     {"date": "2024-03-01", "gxl": 0.027}
        # ]
        result = ak.stock_a_gxl_lg().to_dict(orient='records')
        return jsonify({
            'success': True,
            'data': result,
            'message': '获取数据成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'data': None,
            'message': '获取数据失败: {}'.format(str(e))
        })

@app.route('/api/stock/a/ttm-lyr', methods=['GET'])
def get_stock_a_ttm_lyr():
    """获取A股TTM和LYR数据"""
    try:
        # 暂时返回模拟数据，需要根据akshare库的实际参数格式进行修改
        # result = [
        #     {"date": "2024-01-01", "ttm": 15.5, "lyr": 14.8},
        #     {"date": "2024-02-01", "ttm": 16.2, "lyr": 15.1},
        #     {"date": "2024-03-01", "ttm": 15.8, "lyr": 14.9}
        # ]
        
        # print(ak.stock_a_ttm_lyr())
        result = ak.stock_a_ttm_lyr().to_dict(orient='records')
        return jsonify({
            'success': True,
            'data': result,
            'message': '获取数据成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'data': None,
            'message': '获取数据失败: {}'.format(str(e))
        })

# 更多akshare接口可以在这里添加

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AKShare API Service')
    parser.add_argument('--port', type=int, default=6680, help='Port to run the server on')
    args = parser.parse_args()
    app.run(host='0.0.0.0', port=args.port, debug=True)
