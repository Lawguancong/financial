import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, Button, Card, Spin, Table } from 'antd';
import { DualAxes, Line } from '@ant-design/plots';
import axios from 'axios';
import { pick } from 'lodash-es';
import { calculateMaxDrawdown, calculateRSI, calculateStartDate } from '@/utils';
import moment from 'moment';
import apiClient from '@/utils/axios';

// 最近x年 全部
const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol');
  const symbolName = searchParams.get('symbolName');


  const [indicator, setIndicator] = useState<string>('累计收益率走势');
  const [period, setPeriod] = useState<string>('成立来');
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const [loading, setLoading] = useState(false);
  const [dailyRSIDataFund, setDailyRSIDataFund] = useState<any[]>([]);

  const keyMap: Record<string, { 日期: string; 数据: string; sampleRate: number }> = {
    '单位净值走势': {
      "日期": '净值日期',
      "数据": '单位净值',
      sampleRate: 1,
    },
    '累计净值走势': {
      "日期": '净值日期',
      "数据": '累计净值',
      sampleRate: 1,
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
  const dateKey = keyMap[indicator].日期 // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = keyMap[indicator].数据 // 左y轴键名
  const leftName = keyMap[indicator].数据 // 左y轴名称

  const rightKeys = { // 右y轴键名: 右y轴名称
    "累计收益率": '累计收益率(%)',
    ['__最大回撤率__']: '最大回撤率(%)',
    ['__年化收益率__']: "年化收益率(%)",
    ['__RSI6__']: "RSI6",
  }
  const sampleRate = keyMap[indicator].sampleRate // 抽样率
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
    { label: '单位净值走势', value: '单位净值走势' }, // 单位净值：现在卖多少钱（会因分红下跌）
    { label: '累计净值走势', value: '累计净值走势' },// 累计净值：加上所有分红，看基金整体涨幅
    { label: '累计收益率走势', value: '累计收益率走势' },// 累计收益率：算上分红再投资，你真正赚了多少
    // { label: '同类排名走势', value: '同类排名走势' },
    // { label: '同类排名百分比', value: '同类排名百分比' },
    // { label: '分红送配详情', value: '分红送配详情' },
    // { label: '拆分详情', value: '拆分详情' },
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

  const timeRangeOptions = [
    { label: '上市以来', value: '上市以来' },
    { label: '最近20年', value: '20年' },
    { label: '最近19年', value: '19年' },
    { label: '最近18年', value: '18年' },
    { label: '最近17年', value: '17年' },
    { label: '最近16年', value: '16年' },
    { label: '最近15年', value: '15年' },
    { label: '最近14年', value: '14年' },
    { label: '最近13年', value: '13年' },
    { label: '最近12年', value: '12年' },
    { label: '最近11年', value: '11年' },
    { label: '最近10年', value: '10年' },
    { label: '最近9年', value: '9年' },
    { label: '最近8年', value: '8年' },
    { label: '最近7年', value: '7年' },
    { label: '最近6年', value: '6年' },
    { label: '最近5年', value: '5年' },
    { label: '最近4年', value: '4年' },
    { label: '最近3年', value: '3年' },
    { label: '最近2年', value: '2年' },
    { label: '最近1年', value: '1年' },
  ];


  const handleChangeIndicator = async (value: string) => {
    await setTimeRange('上市以来');
    await setPeriod('成立来');
    await setIndicator(value);
  }

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
      const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
        params,
      })
      console.log('基金详情 -> response', response);

      let filteredData = response?.data || [];

      if (timeRange !== '上市以来' && filteredData.length > 0) {
        const firstDate = filteredData[0][keyMap[indicator].日期] as string;
        const startDate = calculateStartDate(firstDate, timeRange);
        console.log(`111111111 ${chartName} -> firstDate`, firstDate)
        console.log(`111111111 ${chartName} -> startDate`, startDate)
        filteredData = filteredData.filter((item: Record<string, unknown>) => {
          const itemDate = item[keyMap[indicator].日期] as string;
          return moment(itemDate).format('YYYYMMDD') >= moment(startDate).format('YYYYMMDD');
        });
      }
      console.log(`111111111 ${chartName} -> filteredData`, filteredData)

      // 过滤每月数据，有重复月的取累计收益率小的值
      const filteredData_monthly = (() => {
        const monthlyMap = new Map<string, any>();

        filteredData.forEach(item => {
          const date = item[keyMap[indicator].日期];
          const monthKey = moment(date).format('YYYY-MM');
          const currentItem = monthlyMap.get(monthKey);

          if (!currentItem) {
            // 首次遇到该月，直接添加
            monthlyMap.set(monthKey, item);
          } else {
            // 已有该月数据，比较累计收益率，取较小值
            const currentValue = Number(currentItem['累计收益率']) || 0;
            const newValue = Number(item['累计收益率']) || 0;
            if (newValue < currentValue) {
              monthlyMap.set(monthKey, item);
            }
          }
        });

        // 将Map转换为数组并按日期排序
        return Array.from(monthlyMap.values()).sort((a, b) => {
          const dateA = a[keyMap[indicator].日期];
          const dateB = b[keyMap[indicator].日期];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
        });
      })();
      console.log(`22222 ${chartName} -> filteredData_monthly`, filteredData_monthly)

      // 计算每月数据的RSI6
      const dailyRSIData_fund = calculateRSI({ data: filteredData_monthly, closeKey: '累计收益率', period: 6 });
      console.log(`2222 ${chartName} -> dailyRSIData_fund`, dailyRSIData_fund)
      setDailyRSIDataFund(dailyRSIData_fund);

      // 将RSI6数据合并到filteredData中
      const rsiMap = new Map(dailyRSIData_fund.map(item => [item.日期, item.__RSI6__]));
      const filteredDataWithRSI = filteredData.map(item => ({
        ...item,
        __RSI6__: rsiMap.get(item[keyMap[indicator].日期]) || null
      }));

      const dataFormat = calculateMaxDrawdown({
        data: filteredDataWithRSI,
        leftKey: keyMap[indicator].数据,
        dateKey: keyMap[indicator].日期,
      })?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => {
        const value = item[key];
        if (value === null) {
          return null;
        }
        return {
          date: String(item[dateKey]),
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: Number(value),
        };
      })).flat().filter((item): item is { date: string; key: string; label: string; value: number } => item !== null)
      console.log(`111111111 ${chartName} -> dataFormat`, dataFormat)
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
      })
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, indicator, period, timeRange, chartName, dateKey, keyMap, labelMap, leftKey, leftName, rightKeys, sampleRate]);

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, indicator, period, timeRange]);

  console.log(`${chartName} -> data`, data)

  const config = {
    title: {
      title: `${symbolName}(${chartName})`,
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
    annotations: indicator === '累计收益率走势' ? dailyRSIDataFund.filter((item: any) => item.__RSI6__ < 20).map((item: any) => {
      const level = item.__RSI6__ < 15 ? 5 : item.__RSI6__ < 18 ? 3 : 1;
      let color = '#008000';
      let fontSize = 12;
      if (level === 5) {
        color = '#008000';
        fontSize = 12;
      } else if (level === 3) {
        color = '#42b242ff';
        fontSize = 10;
      } else if (level === 1) {
        color = '#9fe49fff';
        fontSize = 8;
      }

      return {
        type: 'text' as const,
        data: [new Date(item.日期), item.累计收益率],
        style: {
          text: '●',
          fontSize: fontSize,
          dx: -(fontSize/2),
          stroke: color,
          fill: color,
        },
      };
    }) : [],
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
              onChange={handleChangeIndicator}
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
          {/* {indicator !== '累计收益率走势' && ( */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>时间范围：</span>
            <Select
              style={{ width: 120 }}
              value={timeRange}
              onChange={setTimeRange}
              options={timeRangeOptions}
            />
          </div>
          {/* )} */}
          <Button type="primary" onClick={fetchData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
         {indicator === '累计收益率走势' && dailyRSIDataFund.length > 0 && (
          <Card style={{ marginBottom: '16px' }}>
            <Table
              dataSource={dailyRSIDataFund.filter((item: any) => item.__RSI6__ < 20).map((item: any) => ({
                ...item,
                __recommendationLevel__: item.__RSI6__ < 15 ? 5 : item.__RSI6__ < 18 ? 3 : 1,
              }))}
              columns={[
                {
                  title: '推荐级别',
                  dataIndex: '__recommendationLevel__',
                  key: '__recommendationLevel__',
                  render: (level: number) => <span style={{ color: '#ffd700' }}>{'★'.repeat(level)}</span>,
                },
                {
                  title: '日期',
                  dataIndex: '日期',
                  key: '日期',
                  render: (text: string) => moment(text).format('YYYY-MM-DD'),
                },
                {
                  title: 'RSI6',
                  dataIndex: '__RSI6__',
                  key: '__RSI6__',
                  render: (value: number) => value?.toFixed(2),
                },
              ]}
              rowKey="日期"
              pagination={false}
            />
          </Card>
        )}
        <Card>
          <DualAxes {...config} />
        </Card>
        {indicator === '累计收益率走势' && dailyRSIDataFund.length > 0 && (
          <Card style={{ marginBottom: '16px' }}>
            <Line
              data={dailyRSIDataFund}
              xField={(d: { date: string }) => new Date(d.日期)}
              yField="__RSI6__"
              title={{ text: 'RSI6 走势' }}
              axis={{
                x: { title: '日期', size: 40 },
                y: { title: '月 RSI6', size: 60 },
              }}
              // slider={{
              //   x: { labelFormatter: (d: string) => moment(d).format('YYYY-MM-DD') },
              //   start: 0,
              //   end: 1,
              // }}
              // tooltip={{
              //   formatter: (data: any) => {
              //     return {
              //       name: 'RSI6',
              //       value: data['__RSI6__'].toFixed(2),
              //     };
              //   },
              // }}
            />
          </Card>
        )}
       
      </Spin>
    </div>
  );
};

export default FundOpenDetail;
