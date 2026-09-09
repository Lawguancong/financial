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
  // ==================== 个股 ====================
  // 筹码分布: stock_cyq_em

  // ==================== 股票列表 ====================
  // 中国股票指数成份: index_stock_cons

  // ==================== 分红数据 ====================
  // 历史分红(巨潮): stock_dividend_cninfo


  // ==================== 资金数据 ====================
  // 居民存款之比 暂无接口数据支持
  // M0/M1/M2与各指标的关系  暂无接口数据支持


  // ==================== REITs ====================
  // - REITs历史行情: reits_hist_em



  // ==================== 财务指标 ====================
  // 港股财务指标: stock_financial_hk_analysis_indicator_em
  // 美股财务指标: stock_financial_us_analysis_indicator_em
  // 主要指标(东方财富): stock_financial_analysis_indicator_em
  // 利润表: stock_financial_benefit_new_ths
  // 现金流量表: stock_financial_cash_new_ths
  // 资产负债表: stock_financial_debt_new_ths
  // 分红配送-东财 接口: stock_fhps_em
  // 分红配送详情-东财 接口: stock_fhps_detail_em
  // 公司概况-巨潮资讯 接口: stock_profile_cninfo




  // ==================== 行业指数 ====================
  // todo 行业估值  行业样本数量
  // 行业市盈率: stock_industry_pe_ratio_cninfo
  // 申万一级行业信息
  // 接口: sw_index_first_info

  // 申万二级行业信息
  // 接口: sw_index_second_info

  // 申万三级行业信息
  // 接口: sw_index_third_info

  // 申万三级行业成份
  // 接口: sw_index_third_cons


  // ==================== 债券 ====================
  // todo: 十年期国债利率倒数与A股PE中位数走势

  // todo: 风险溢价
  // todo: 市盈率、 盈利收益率、市净率、股息率、市现率


  // 简单好用高效 不用太复杂 
  // 估值比较 接口: stock_zh_valuation_comparison_em
  // A股财务指标: stock_financial_analysis_indicator
  // A股个股估值: stock_value_em (仅最近10年数据)



  return (
    <>
      {/* 演示图表 */}
      {/* {useMemo(() => <DemoDualAxes />, [])} */}
      {/* {useMemo(() => <DemoDualAxes1 />, [])} */}
    </>
  );
};

export default Home;
