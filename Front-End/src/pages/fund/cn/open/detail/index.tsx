import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, Button, Card, Spin } from 'antd';
import { DualAxes } from '@ant-design/plots';
import axios from 'axios';
import { Line } from '@ant-design/plots';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';

interface FundDetailData {
  净值日期: string;
  indicator: number;
}

const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol');
  const symbolName = searchParams.get('symbolName');
  

  const [indicator, setIndicator] = useState<string>('单位净值走势');
  const [period, setPeriod] = useState<string>('成立来');
  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const [loading, setLoading] = useState(false);

   const keyMap = {
    '单位净值走势': {
      "日期": '净值日期',
      "数据": '单位净值',
      sampleRate: 10,
    },
    '累计净值走势': {
      "日期": '净值日期',
      "数据": '累计净值',
      sampleRate: 10,
    },
    '累计收益率走势': {
      "日期": '日期',
      "数据": '累计收益率',
      sampleRate: 1,
    },
    // '同类排名走势': {
    //   "日期": '净值日期',
    //   "数据": '同类排名'
    // },
    // '同类排名百分比': {
    //   "日期": '净值日期',
    //   "数据": '同类排名百分比'
    // },
    // '分红送配详情': {
    //   "日期": '净值日期',
    //   "数据": '分红送配详情'
    // },
    // '拆分详情': {
    //   "日期": '净值日期',
    //   "数据": '拆分详情'
    // },
  }

  
  const chartName = indicator; // 图表名称
  const dateKey = (keyMap as Record<string, { 日期: string; 数据: string; sampleRate: number }>)[indicator].日期 // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '最大回撤率' // 左y轴键名
  const leftName = '最大回撤率(%)' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    "单位净值": "单位净值",
    "累计净值": "累计净值",
    "累计收益率": "累计收益率",
  }
  const sampleRate = (keyMap as Record<string, { 日期: string; 数据: string; sampleRate: number }>)[indicator].sampleRate // 抽样率
  type DataRes = {
    [dateKey]: string;
    [leftKey]: number;
  } & {
    [K in keyof typeof rightKeys]: number;
  };

  const labelMap = {
    [dateKey]: dateName,
    [leftKey]: leftName,
    ...rightKeys
  }

  const indicatorOptions = [
    { label: '单位净值走势', value: '单位净值走势' },
    { label: '累计净值走势', value: '累计净值走势' },
    { label: '累计收益率走势', value: '累计收益率走势' },
    { label: '同类排名走势', value: '同类排名走势' },
    { label: '同类排名百分比', value: '同类排名百分比' },
    { label: '分红送配详情', value: '分红送配详情' },
    { label: '拆分详情', value: '拆分详情' },
  ];

  const periodOptions = [
    { label: '1月', value: '1月' },
    { label: '3月', value: '3月' },
    { label: '6月', value: '6月' },
    { label: '1年', value: '1年' },
    { label: '3年', value: '3年' },
    { label: '5年', value: '5年' },
    { label: '今年来', value: '今年来' },
    { label: '成立来', value: '成立来' },
  ];

 
  const fetchData = useCallback(async () => {
    if (!symbol) {
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        symbol,
        indicator,
      };

      if (indicator === '累计收益率走势') {
        params.period = period;
      }

      const response = await axios.get('http://127.0.0.1:8080/api/public/fund_open_fund_info_em', {
        params,
      });
      console.log('基金详情 -> response', response);
      // setData(response?.data || []);
      const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat()
      console.log(`${chartName} -> dataFormat`, dataFormat)
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
      })
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, indicator, period]);

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, fetchData]);

  console.log(`${chartName} -> data`, data)

  const config = {
    title: {
      title: `${symbolName}${chartName}`,
      // subtitle: symbol ? `基金代码: ${symbol}` : '',
    },
    xField: (d: { date: string }) => new Date(d.date),
    children: [
      {
        data: data.leftData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: {
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
        axis: {
          y: {
            title: leftName,
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        data: data.rightData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        axis: {
          y: {
            position: 'right',
            title: chartName,
            style: { titleFill: '#6c6868ff' },
          },
        },
      },

    ],
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>指标：</span>
            <Select
              style={{ width: 200 }}
              value={indicator}
              onChange={setIndicator}
              options={indicatorOptions}
            />
          </div>
          {indicator === '累计收益率走势' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>周期：</span>
              <Select
                style={{ width: 120 }}
                value={period}
                onChange={setPeriod}
                options={periodOptions}
              />
            </div>
          )}
          <Button type="primary" onClick={fetchData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        <Card>
          <DualAxes {...config} />
        </Card>
      </Spin>
    </div>
  );
};

export default FundOpenDetail;
