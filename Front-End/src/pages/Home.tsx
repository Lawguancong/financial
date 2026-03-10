import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';




const DemoLine = (props) => {
  const { data = [] } = props;
  const config = {
    data,
    xField: (d) => new Date(d.date),
    yField: 'close',
    axis: {
      x: {
        title: 'x轴标题',
        size: 40
      },
      y: {
        title: 'y轴标题',
        // padding: 0,
        size: 40
      }
    },
    slider: {
      x: { labelFormatter: (d) => format(d, 'YYYY/M/D') },
      y: { labelFormatter: '~s' },
    },
    tooltip: {
      shared: true, // 提示框共享
      showMarkers: true,
    },
  };
  return <Line {...config} />
};








const DemoDualAxes = () => {
  const uvBillData = [
    { time: '2019-03', value: 350, type: 'uv' },
    { time: '2019-04', value: 900, type: 'uv' },
    { time: '2019-05', value: 300, type: 'uv' },
    { time: '2019-06', value: 450, type: 'uv' },
    { time: '2019-07', value: 470, type: 'uv' },
    { time: '2019-03', value: 220, type: 'bill' },
    { time: '2019-04', value: 300, type: 'bill' },
    { time: '2019-05', value: 250, type: 'bill' },
    { time: '2019-06', value: 220, type: 'bill' },
    { time: '2019-07', value: 362, type: 'bill' },
  ];

  const transformData = [
    { time: '2019-03', count: 800, name: 'a' },
    { time: '2019-04', count: 600, name: 'a' },
    { time: '2019-05', count: 400, name: 'a' },
    { time: '2019-06', count: 380, name: 'a' },
    { time: '2019-07', count: 220, name: 'a' },
    { time: '2019-03', count: 750, name: 'b' },
    { time: '2019-04', count: 650, name: 'b' },
    { time: '2019-05', count: 450, name: 'b' },
    { time: '2019-06', count: 400, name: 'b' },
    { time: '2019-07', count: 320, name: 'b' },
    { time: '2019-03', count: 900, name: 'c' },
    { time: '2019-04', count: 600, name: 'c' },
    { time: '2019-05', count: 450, name: 'c' },
    { time: '2019-06', count: 300, name: 'c' },
    { time: '2019-07', count: 200, name: 'c' },
  ];

  const config = {
    xField: 'time',
    scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
    children: [
      {
        data: uvBillData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        shapeField: 'smooth',
        style: { lineWidth: 3, lineDash: [5, 5] },
      },
      {
        data: transformData,
        type: 'line',
        yField: 'count',
        colorField: 'name',
        axis: { y: false },
        style: { lineWidth: 3 },
      },
      {
        data: transformData,
        type: 'point',
        yField: 'count',
        colorField: 'name',
        sizeField: 3,
        shapeField: 'point',
        axis: { y: false },
        tooltip: false,
      },
    ],
  };
  return <DualAxes {...config} />
};



const DemoDualAxes1 = () => {
  const data = [
    { year: '1991', value: 3, count: 10 },
    { year: '1992', value: 4, count: 4 },
    { year: '1993', value: 3.5, count: 5 },
    { year: '1994', value: 5, count: 5 },
    { year: '1995', value: 4.9, count: 4.9 },
    { year: '1996', value: 6, count: 35 },
    { year: '1997', value: 7, count: 7 },
    { year: '1998', value: 9, count: 1 },
    { year: '1999', value: 13, count: 20 },
  ];

  const config = {
    data,
    xField: 'year',
    legend: true,
    children: [
      {
        type: 'line',
        yField: 'value',
        style: {
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: 'value',
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        type: 'line',
        yField: 'count',
        style: {
          stroke: '#5AD8A6',
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'right',
            title: 'count',
            style: { titleFill: '#5AD8A6' },
          },
        },
      },
    ],
  };
  return <DualAxes {...config} />
};

const DemoDualAxes2 = (props) => {
  const { data = [] } = props;
  const config = {
    data,
    xField: (d) => new Date(d.date),
    legend: true,
    children: [
      {
        type: 'line',
        yField: 'close',
        style: {
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: 'close',
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        type: 'line',
        yField: 'pe_ttm',
        style: {
          stroke: '#5AD8A6',
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'right',
            title: 'pe_ttm',
            style: { titleFill: '#5AD8A6' },
          },
        },
      },
    ],
  };
  return <DualAxes {...config} />
};



const Home = () => {
  // todo
  // AKShare 数据接口一览
  // https://akshare.akfamily.xyz/tutorial.html#id1


  // 国证指数
  // 全部指数
  // 接口: index_all_cni

  // 股票列表-A股
  // 接口: stock_info_a_code_name


  // 个股估值
  // 接口: stock_value_em


  // A 股估值指标（个股）
  // stock_zh_valuation_baidu
  // symbol	str	symbol="002044"; A 股代码
  // indicator	str	indicator="总市值"; choice of {"总市值", "市盈率(TTM)", "市盈率(静)", "市净率", "市现率"}
  // period	str	period="近一年"; choice of {"近一年", "近三年", "近五年", "近十年", "全部"}
  // stock_zh_valuation_baidu?symbol=002044&period=全部&indicator=市净率

  // 港股估值指标 （个股）
  // 接口: stock_hk_valuation_baidu

  // 美股估值指标（个股）
  // 接口: stock_us_valuation_baidu


  // 波动率指数


  // 筹码分布
  // 接口: stock_cyq_em


  // 实时行情数据-雪球
  // 接口: stock_individual_spot_xq


  // 股票行业成交
  // 接口: stock_szse_sector_summary


  // 上海证券交易所-每日概况
  // 接口: stock_sse_deal_daily

  //  "stock_hk_indicator_eniu"  # 港股股个股市盈率、市净率和股息率指标
  //  "stock_a_high_low_statistics"  # 创新高和新低的股票数量


  //  "index_csindex_all"  # 中证指数网站-指数列表

  //  "stock_zh_index_value_csindex"  # 中证指数-指数估值 
  // 市盈率 股息率


  // 中国股票指数成份
  // 接口: index_stock_cons

  // 股票回购数据
  // 接口: stock_repurchase_em

  // 财务指标
  // 接口: stock_financial_analysis_indicator

  // 港股财务指标
  // 接口: stock_financial_hk_analysis_indicator_em

  // 美股财务指标
  // 接口: stock_financial_us_analysis_indicator_em

  // 主要指标-东方财富
  // 接口: stock_financial_analysis_indicator_em

  // 利润表
  // 接口: stock_financial_benefit_new_ths

  // 现金流量表
  // 接口: stock_financial_cash_new_ths

  // 资产负债表
  // 接口: stock_financial_debt_new_ths

  // 历史分红
  // 接口: stock_history_dividend

  // 历史分红
  // 接口: stock_dividend_cninfo

  // 机构持股一览表
  // 接口: stock_institute_hold

  // 行业市盈率
  // 接口: stock_industry_pe_ratio_cninfo

  // 港股个股指标
  // 接口: stock_hk_indicator_eniu


  // 讨论排行榜
  // 接口: stock_hot_tweet_xq

  // 交易排行榜
  // 接口: stock_hot_deal_xq

  // 人气榜-A股
  // 接口: stock_hot_rank_em

  // 飙升榜-A股
  // 接口: stock_hot_up_em

  // 人民币存款 增速
  // M2 增速 之间的关系

  // M0 M1 M2 与各指标的关系

  return <>
    {/* Demo */}
    {useMemo(() => <DemoDualAxes />, [])}
    {useMemo(() => <DemoDualAxes1 />, [])}



    {/* todo 恒生 */}
    {/* 恒生指数股息率 */}
    {/* 接口: stock_hk_gxl_lg */}



    {/* todo 基金 */}
    {/* 基金基本信息-指数型 */}
    {/* 接口: fund_info_index_em */}


  </>
};

export default Home;
