import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';

/**
 * 演示折线图组件
 * @param {Object} props - 组件属性
 * @param {Array} props.data - 数据数组
 */
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
        size: 40
      }
    },
    slider: {
      x: { labelFormatter: (d) => format(d, 'YYYY/M/D') },
      y: { labelFormatter: '~s' },
    },
    tooltip: {
      shared: true,
      showMarkers: true,
    },
  };
  return <Line {...config} />
};

/**
 * 演示双轴图表组件（uv/bill数据）
 */
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

/**
 * 演示双轴图表组件（基础版）
 */
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

/**
 * 演示双轴图表组件（股票数据版）
 * @param {Object} props - 组件属性
 * @param {Array} props.data - 股票数据数组
 */
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

/**
 * 首页组件
 * 包含股票、基金、指数等金融数据的展示
 */
const Home = () => {
  // ==================== 待开发功能 ====================
  // todo: 涨/跌/平 比例图
  // todo: 风险溢价
  // todo: 十年期国债利率倒数与A股PE中位数走势
  // todo: 破净统计 stock_a_below_net_asset_statistics
  // todo: 融资余额/全A流通市值 占比
  // todo: 融券余额/全A流通市值 占比
  // todo: 融资余额/全A总市值 占比
  // todo: 融券余额/全A总市值 占比
  // todo: 恒生指数股息率
  // todo: 基金相关功能完善

  // ==================== 筹码分布 ====================
  // 接口: stock_cyq_em

  // ==================== 国证指数 ====================
  // 全部指数: index_all_cni
  // 指数行情: index_hist_cni
  // 指数样本详情: index_detail_cni
  // 历史样本: index_detail_hist_cni

  // ==================== 股票列表 ====================
  // A股列表: stock_info_a_code_name
  // 中国股票指数成份: index_stock_cons

  // ==================== 估值指标 ====================
  // A股个股估值: stock_value_em (仅最近10年数据)
  // 港股估值指标: stock_hk_valuation_baidu
  // 美股估值指标: stock_us_valuation_baidu
  // 中证指数估值: stock_zh_index_value_csindex (市盈率、股息率)
  // 行业市盈率: stock_industry_pe_ratio_cninfo
  // 港股个股指标: stock_hk_indicator_eniu (市盈率、市净率、股息率)

  // ==================== 财务指标 ====================
  // A股财务指标: stock_financial_analysis_indicator
  // 港股财务指标: stock_financial_hk_analysis_indicator_em
  // 美股财务指标: stock_financial_us_analysis_indicator_em
  // 主要指标(东方财富): stock_financial_analysis_indicator_em
  // 利润表: stock_financial_benefit_new_ths
  // 现金流量表: stock_financial_cash_new_ths
  // 资产负债表: stock_financial_debt_new_ths

  // ==================== 分红数据 ====================
  // 历史分红: stock_history_dividend
  // 历史分红(巨潮): stock_dividend_cninfo

  // ==================== 行情数据 ====================
  // 实时行情(雪球): stock_individual_spot_xq
  // 股票行业成交: stock_szse_sector_summary
  // 上交所每日概况: stock_sse_deal_daily
  // 创新高/新低统计: stock_a_high_low_statistics

  // ==================== 资金数据 ====================
  // 两融余额
  // 两融交易额
  // 成交额
  // 基金发行热度/发行规模
  // 波动率VIX指标
  // 居民存款之比
  // M0/M1/M2与各指标的关系

  // ==================== 排行榜 ====================
  // 讨论排行榜: stock_hot_tweet_xq
  // 交易排行榜: stock_hot_deal_xq
  // 人气榜(A股): stock_hot_rank_em
  // 飙升榜(A股): stock_hot_up_em

  // ==================== 黄金/大宗商品 ====================
  // 黄金RSI6: spot_hist_sge (品种: Au99.99)
  // 原油RSI6
  // 大宗商品RSI6

  // ==================== 基金相关 ====================
  // 【基金基本信息】
  // - 全部基金基本信息: fund_name_em (基金代码、拼音缩写、基金简称、基金类型、拼音全称)
  // - 基金基本信息(同花顺): fund_info_ths (symbol=基金代码，返回基金代码、简称、类型、全称、投资类型、基金经理等)
  // - 基金基本信息(雪球): fund_individual_basic_info_xq (symbol=基金代码，返回基金代码、名称、全称、成立时间、规模等)
  // - 指数型基金基本信息: fund_info_index_em (symbol=分类，indicator=类型，返回基金代码、名称、单位净值、收益率等)

  // 【基金申购状态】
  // - 申购状态查询: fund_purchase_em (返回基金代码、简称、类型、净值、申购状态、赎回状态、购买起点等)

  // 【基金行情】
  // - ETF基金实时行情(东财): fund_etf_spot_em (代码、名称、最新价、IOPV估值、折价率、成交量等)
  // - 基金实时行情(同花顺): fund_etf_category_ths (symbol=类型，date=日期，返回净值、增长率等)
  // - ETF基金实时行情(同花顺): fund_etf_spot_ths (date=日期)
  // - LOF基金实时行情(东财): fund_lof_spot_em
  // - 基金实时行情(新浪): fund_spot_sina
  // - ETF基金分时行情(东财): fund_etf_minute_em
  // - LOF基金分时行情(东财): fund_lof_minute_em
  // - ETF基金历史行情(东财): fund_etf_hist_em
  // - LOF基金历史行情(东财): fund_lof_hist_em
  // - 基金历史行情(新浪): fund_hist_sina

  // 【基金净值】
  // - 开放式基金实时净值: fund_open_fund_info_em (实时数据)
  // - 开放式基金历史净值: fund_open_fund_hist_em (历史数据)
  // - 货币型基金实时数据: fund_money_fund_spot_em
  // - 货币型基金历史数据: fund_money_fund_hist_em
  // - 理财型基金实时数据: fund_wealth_fund_spot_em
  // - 理财型基金历史数据: fund_wealth_fund_hist_em
  // - 分级基金实时数据: fund_fractional_fund_spot_em
  // - 分级基金历史数据: fund_fractional_fund_hist_em
  // - 场内交易基金实时数据: fund_etf_fund_spot_em
  // - 场内交易基金历史数据: fund_etf_fund_hist_em
  // - 香港基金历史数据: fund_hk_hist_em

  // 【分红送配】
  // - 基金累计分红: fund_dividend_accumulate_em
  // - 基金分红: fund_dividend_em
  // - 基金拆分: fund_split_em
  // - 基金分红排行: fund_dividend_rank_em

  // 【基金排行】
  // - 开放式基金排行: fund_open_fund_rank_em (symbol=类型，返回单位净值、累计净值、收益率等)
  // - 场内交易基金排行: fund_etf_fund_rank_em
  // - 货币型基金排行: fund_money_fund_rank_em
  // - 理财基金排行: fund_wealth_fund_rank_em
  // - 香港基金排行: fund_hk_rank_em

  // 【基金业绩与分析】
  // - 基金业绩(雪球): fund_individual_performance_xq
  // - 净值估算: fund_net_value_estimate_em
  // - 基金数据分析: fund_individual_analysis_xq (周期、风险收益比、抗风险波动、年化波动率、夏普比率、最大回撤)
  // - 基金盈利概率: fund_individual_profit_probability_xq
  // - 基金持仓资产比例: fund_portfolio_hold_em
  // - 基金基本概况: fund_overview_em
  // - 基金交易费率: fund_fee_rate_em
  // - 基金交易规则: fund_trading_rules_em

  // 【基金持仓】
  // - 基金持仓股票: fund_portfolio_stock_em
  // - 债券持仓: fund_portfolio_bond_em
  // - 行业配置: fund_industry_allocation_em
  // - 重大变动: fund_major_changes_em

  // 【基金评级】
  // - 基金评级总汇: fund_rating_all_em
  // - 上海证券评级: fund_rating_sh_em
  // - 招商证券评级: fund_rating_cmb_em
  // - 济安金信评级: fund_rating_jajx_em

  // 【基金经理】
  // - 基金经理信息: fund_manager_info_em

  // 【新发基金】
  // - 新发基金: fund_new_found_em

  // 【基金规模】
  // - 开放式基金规模: fund_scale_open_em
  // - 封闭式基金规模: fund_scale_closed_em
  // - 分级子基金规模: fund_scale_fractional_em
  // - ETF基金份额(上交所): fund_etf_share_sse_em
  // - ETF基金份额(深交所): fund_etf_share_szse_em
  // - 基金规模日频(深交所): fund_scale_daily_szse_em

  // 【基金公司规模】
  // - 基金规模详情: fund_aum_em
  // - 基金规模走势: fund_aum_trend_em
  // - 基金公司历年管理规模: fund_aum_history_em

  // 【基金资产配置】
  // - 灵活配置型基金仓位: fund_flexible_position_em
  // - 基金资产配置: fund_asset_allocation_em

  // ==================== REITs ====================
  // - REITs实时行情: reits_realtime_em
  // - REITs历史行情: reits_hist_em

  // ==================== 其他 ====================
  // 股票回购数据: stock_repurchase_em
  // 机构持股一览表: stock_institute_hold

  return (
    <>
      {/* 演示图表 */}
      {useMemo(() => <DemoDualAxes />, [])}
      {useMemo(() => <DemoDualAxes1 />, [])}
    </>
  );
};

export default Home;
