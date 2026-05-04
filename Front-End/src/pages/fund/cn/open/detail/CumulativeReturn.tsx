import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Button, Card, Spin, Table, Collapse } from 'antd';
import { DualAxes, Line } from '@ant-design/plots';
import { pick, isNumber } from 'lodash-es';
import { calculateMaxDrawdown, calculateRSI, calculateMACD, calculatePercentile } from '@/utils';
import moment from 'moment';
import apiClient from '@/utils/axios';
import { timeRangeOptions, periodOptions, keyMap, rightKeys, calculateRecommendationLevel, getLevelStyle } from './constants';

interface CumulativeReturnProps {
  symbol: string | null;
}

const indicator = '累计收益率走势';
const closeKey = '累计收益率';
const chartName = indicator;
const dateKey = '日期';
const dateName = '日期';
const leftKey = closeKey;
const leftName = '累计收益率(%)';



type DataRes = {
  [key: string]: string | number;
};

const labelMap = {
  [dateKey]: dateName,
  [leftKey]: leftName, // 左侧Y轴名称，避免与右侧重复
  ...rightKeys
}


const tableColumns = [
  {
    title: '推荐级别',
    dataIndex: '__recommendationLevel__',
    key: '__recommendationLevel__',
    width: 100,
    fixed: 'left',
    render: (level: number) => {
      const { color, fontSize } = getLevelStyle(level);
      return <span style={{ color, fontSize }}>{'★'.repeat(Math.abs(level))}</span>;
    },
  },
  {
    title: dateName,
    dataIndex: dateKey,
    key: dateKey,
    width: 140,
    fixed: 'left',
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: 'RSI6（月）',
    dataIndex: '__monthlyRSI6__',
    key: '__monthlyRSI6__',
    width: 110,
    fixed: 'left',
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: 'RSI6（季）',
    dataIndex: '__quarterlyRSI6__',
    key: '__quarterlyRSI6__',
    width: 110,
    fixed: 'left',
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: '累计年限（年）',
    dataIndex: '__累计年限__',
    key: '__累计年限__',
    width: 140,
    render: (value: number) => value?.toFixed(2),
  },
  {
    title: '年化收益率(%)',
    dataIndex: '__年化收益率__',
    key: '__年化收益率__',
    width: 140,
    render: (value: number) => value !== null ? value.toFixed(1) : '-',
  },
  {
    title: '累计收益率(%)',
    dataIndex: '累计收益率',
    key: '累计收益率',
    width: 140,
    render: (value: number) => value?.toFixed(1),
  },

  {
    title: '3年后【预期累计】收益率(%)(长期6%年化)',
    dataIndex: '__EXPECTED_RETURN_3Y_6PCT__',
    key: '__EXPECTED_RETURN_3Y_6PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '3年后【预期累计】收益率(%)(长期8%年化)',
    dataIndex: '__EXPECTED_RETURN_3Y_8PCT__',
    key: '__EXPECTED_RETURN_3Y_8PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '3年后【预期累计】收益率(%)(长期10%年化)',
    dataIndex: '__EXPECTED_RETURN_3Y_10PCT__',
    key: '__EXPECTED_RETURN_3Y_10PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '3年后【预期累计】收益率(%)(长期12%年化)',
    dataIndex: '__EXPECTED_RETURN_3Y_12PCT__',
    key: '__EXPECTED_RETURN_3Y_12PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '3年后【预期累计】收益率(%)(长期15%年化)',
    dataIndex: '__EXPECTED_RETURN_3Y_15PCT__',
    key: '__EXPECTED_RETURN_3Y_15PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },

  {
    title: '3年后【预期相对】收益率(%)(长期6%年化)',
    dataIndex: '__RELATIVE_RETURN_3Y_6PCT__',
    key: '__RELATIVE_RETURN_3Y_6PCT__',
    width: 140,
        render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 3; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '3年后【预期相对】收益率(%)(长期8%年化)',
    dataIndex: '__RELATIVE_RETURN_3Y_8PCT__',
    key: '__RELATIVE_RETURN_3Y_8PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 3; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '3年后【预期相对】收益率(%)(长期10%年化)',
    dataIndex: '__RELATIVE_RETURN_3Y_10PCT__',
    key: '__RELATIVE_RETURN_3Y_10PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 3; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '3年后【预期相对】收益率(%)(长期12%年化)',
    dataIndex: '__RELATIVE_RETURN_3Y_12PCT__',
    key: '__RELATIVE_RETURN_3Y_12PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 3; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '3年后【预期相对】收益率(%)(长期15%年化)',
    dataIndex: '__RELATIVE_RETURN_3Y_15PCT__',
    key: '__RELATIVE_RETURN_3Y_15PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 3; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },


  {
    title: '5年后【预期累计】收益率(%)(长期6%年化)',
    dataIndex: '__EXPECTED_RETURN_5Y_6PCT__',
    key: '__EXPECTED_RETURN_5Y_6PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '5年后【预期累计】收益率(%)(长期8%年化)',
    dataIndex: '__EXPECTED_RETURN_5Y_8PCT__',
    key: '__EXPECTED_RETURN_5Y_8PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '5年后【预期累计】收益率(%)(长期10%年化)',
    dataIndex: '__EXPECTED_RETURN_5Y_10PCT__',
    key: '__EXPECTED_RETURN_5Y_10PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '5年后【预期累计】收益率(%)(长期12%年化)',
    dataIndex: '__EXPECTED_RETURN_5Y_12PCT__',
    key: '__EXPECTED_RETURN_5Y_12PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },
  {
    title: '5年后【预期累计】收益率(%)(长期15%年化)',
    dataIndex: '__EXPECTED_RETURN_5Y_15PCT__',
    key: '__EXPECTED_RETURN_5Y_15PCT__',
    width: 140,
    render: (value: number) => (value * 100)?.toFixed(1),
  },


  {
    title: '5年后【预期相对】收益率(%)(长期6%年化)',
    dataIndex: '__RELATIVE_RETURN_5Y_6PCT__',
    key: '__RELATIVE_RETURN_5Y_6PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 5; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '5年后【预期相对】收益率(%)(长期8%年化)',
    dataIndex: '__RELATIVE_RETURN_5Y_8PCT__',
    key: '__RELATIVE_RETURN_5Y_8PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 5; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '5年后【预期相对】收益率(%)(长期10%年化)',
    dataIndex: '__RELATIVE_RETURN_5Y_10PCT__',
    key: '__RELATIVE_RETURN_5Y_10PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 5; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '5年后【预期相对】收益率(%)(长期12%年化)',
    dataIndex: '__RELATIVE_RETURN_5Y_12PCT__',
    key: '__RELATIVE_RETURN_5Y_12PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 5; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
  {
    title: '5年后【预期相对】收益率(%)(长期15%年化)',
    dataIndex: '__RELATIVE_RETURN_5Y_15PCT__',
    key: '__RELATIVE_RETURN_5Y_15PCT__',
    width: 140,
    render: (value: number) => {
      const CUMULATIVE_RETURN_3Y = value;
      const YEARS = 5; // 年限
      const annualizedReturn = Math.pow(1 + CUMULATIVE_RETURN_3Y, 1 / YEARS) - 1;
      return `${(value * 100)?.toFixed(1)}%(年化${(annualizedReturn * 100)?.toFixed(1)}%)`
    }
  },
]

const CumulativeReturn: React.FC<CumulativeReturnProps> = ({ symbol }) => {
  const [period, setPeriod] = useState<string>('成立来');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    leftData: any[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const [RSI6Data, setRSI6Data] = useState<any[]>([]);
  const [macdData, setMacdData] = useState({ montyly: [], quarterly: [], monthly10th: null, monthly90th: null, quarterly10th: null, quarterly90th: null });
  const RSI6LevelData = useMemo(() => RSI6Data?.filter((item: any) => isNumber(item.__recommendationLevel__)), [RSI6Data]);
  console.log('RSI6LevelData', RSI6LevelData)
  const config = useMemo(() => {
    return {
      title: {
        title: chartName
      },
      smooth: true,
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
  }, [data.leftData, data.rightData]);

  const fetchData = async () => {
    if (!symbol) {
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        symbol,
        indicator,
        period,
      };

      const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
        params,
      });

      const responseData = response?.data || [];
      // console.log('基金返回数据filteredData', responseData);

      const dataFormat = calculateMaxDrawdown({
        data: responseData,
        leftKey,
        dateKey,
      })?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => {
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
      })).flat().filter((item): item is { date: string; key: string; label: string; value: number } => item !== null);

      const leftFormat = dataFormat?.filter((item: { key: string }) => item.key === leftKey) || [];
      const rightFormat = dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || [];
      setData({
        leftData: leftFormat,
        rightData: rightFormat
      });
      if (period === '成立来') {
        // 过滤每月数据，取每月的最后一天数据（收盘价）
        const monthlyMap = new Map<string, any>();
        responseData.forEach(item => {
          const date = item[dateKey];
          const monthKey = moment(date).format('YYYY-MM');
          const currentItem = monthlyMap.get(monthKey);

          if (!currentItem) {
            // 首次遇到该月，直接添加
            monthlyMap.set(monthKey, item);
          } else {
            // 有该月度数据，比较日期，取较晚的日期（收盘价）
            const currentDate = moment(currentItem[dateKey]);
            const newDate = moment(item[dateKey]);
            if (newDate.isAfter(currentDate)) {
              monthlyMap.set(monthKey, item);
            }
          }
        });

        // 将Map转换为数组并按日期排序
        const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => {
          const dateA = a[dateKey];
          const dateB = b[dateKey];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
        });

        // 季度数据处理：按季度分组，取每个季度的最后一天数据（收盘价）
        const quarterlyMap = new Map<string, any>();
        monthlyData.forEach(item => {
          const date = item[dateKey];
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;
          const currentItem = quarterlyMap.get(quarterKey);

          if (!currentItem) {
            // 首次遇到该季度，直接添加
            quarterlyMap.set(quarterKey, item);
          } else {
            // 已有该季度数据，比较日期，取较晚的日期（收盘价）
            const currentDate = moment(currentItem[dateKey]);
            const newDate = moment(date);
            if (newDate.isAfter(currentDate)) {
              quarterlyMap.set(quarterKey, item);
            }
          }
        });

        // 将季度Map转换为数组并按日期排序
        const quarterlyData = Array.from(quarterlyMap.values()).sort((a, b) => {
          const dateA = a[dateKey];
          const dateB = b[dateKey];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
        });

        // 计算每月数据的RSI6
        const monthlyRSI6Data = calculateRSI({ data: monthlyData, closeKey, period: 6 });
        // 计算每季度数据的RSI6
        const quarterlyRSI6Data = calculateRSI({ data: quarterlyData, closeKey, period: 6 });

        // 提取RSI6数值
        const monthlyRSIValues = monthlyRSI6Data.map(item => item['__RSI6__']).filter(value => typeof value === 'number' && !isNaN(value));
        const quarterlyRSIValues = quarterlyRSI6Data.map(item => item['__RSI6__']).filter(value => typeof value === 'number' && !isNaN(value));

        // 计算10%和90%分位数
        const __monthly10th__ = calculatePercentile(monthlyRSIValues, 10);
        const __monthly90th__ = calculatePercentile(monthlyRSIValues, 90);
        const __quarterly10th__ = calculatePercentile(quarterlyRSIValues, 10);
        const __quarterly90th__ = calculatePercentile(quarterlyRSIValues, 90);


        const startDate = monthlyData?.[0]?.[dateKey]; // 开始日期



        console.log('monthlyData 月度数据', monthlyData)
        console.log('monthlyData 月度数据 startDate', startDate)
        console.log('monthlyRSI6Data 月度RSI6数据', monthlyRSI6Data)
        console.log('quarterlyRSI6Data 季度RSI6数据', quarterlyRSI6Data)
        // console.log('月度RSI6 10%分位数:', __monthly10th__, '90%分位数:', __monthly90th__)
        // console.log('季度RSI6 10%分位数:', __quarterly10th__, '90%分位数:', __quarterly90th__)

        // console.log('leftFormat', leftFormat)
        // console.log('rightFormat', rightFormat)


        // 创建季度RSI映射：季度键 -> RSI值
        const quarterlyRSIMap = new Map<string, number>();
        quarterlyRSI6Data.forEach(item => {
          const date = item[dateKey];
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;
          quarterlyRSIMap.set(quarterKey, item['__RSI6__']);
        });

        // 合并RSI数据
        const RSI6Data = monthlyRSI6Data.map(item => {
          const date = item[dateKey];
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;
          const __monthlyRSI6__ = item['__RSI6__'];
          const __quarterlyRSI6__ = quarterlyRSIMap.get(quarterKey);

          console.log('item', item)
          console.log('leftFormat', leftFormat)
          console.log('rightFormat', rightFormat)
          // console.log('11111', leftFormat?.find(i => i['date'] === date))
          // console.log('22222', rightFormat?.find(i => i['date'] === date && i['key'] === '__年化收益率__'))

          // console.log('startDate', startDate)
          console.log('累计年限', moment(date).diff(moment(startDate), 'year', true))
          const ACCUMULATED_YEARS = moment(date).diff(moment(startDate), 'year', true); // 累计年限

          const __EXPECTED_RETURN_3Y_6PCT__ = Math.pow(1 + 0.06, ACCUMULATED_YEARS + 3) - 1; // 3年后【预期累计】收益率(%)(长期6%年化)
          const __EXPECTED_RETURN_3Y_8PCT__ = Math.pow(1 + 0.08, ACCUMULATED_YEARS + 3) - 1; // 3年后【预期累计】收益率(%)(长期8%年化)
          const __EXPECTED_RETURN_3Y_10PCT__ = Math.pow(1 + 0.1, ACCUMULATED_YEARS + 3) - 1; // 3年后【预期累计】收益率(%)(长期10%年化)
          const __EXPECTED_RETURN_3Y_12PCT__ = Math.pow(1 + 0.12, ACCUMULATED_YEARS + 3) - 1; // 3年后【预期累计】收益率(%)(长期12%年化)
          const __EXPECTED_RETURN_3Y_15PCT__ = Math.pow(1 + 0.15, ACCUMULATED_YEARS + 3) - 1; // 3年后【预期累计】收益率(%)(长期15%年化)

          const __RELATIVE_RETURN_3Y_6PCT__ = ((__EXPECTED_RETURN_3Y_6PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 3年后【预期相对】收益率(%)(长期6%年化)
          const __RELATIVE_RETURN_3Y_8PCT__ = ((__EXPECTED_RETURN_3Y_8PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 3年后【预期相对】收益率(%)(长期8%年化)
          const __RELATIVE_RETURN_3Y_10PCT__ = ((__EXPECTED_RETURN_3Y_10PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 3年后【预期相对】收益率(%)(长期10%年化)
          const __RELATIVE_RETURN_3Y_12PCT__ = ((__EXPECTED_RETURN_3Y_12PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 3年后【预期相对】收益率(%)(长期12%年化)
          const __RELATIVE_RETURN_3Y_15PCT__ = ((__EXPECTED_RETURN_3Y_15PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 3年后【预期相对】收益率(%)(长期15%年化)




          const __EXPECTED_RETURN_5Y_6PCT__ = Math.pow(1 + 0.06, ACCUMULATED_YEARS + 5) - 1; // 5年后【预期累计】收益率(%)(长期6%年化)
          const __EXPECTED_RETURN_5Y_8PCT__ = Math.pow(1 + 0.08, ACCUMULATED_YEARS + 5) - 1; // 5年后【预期累计】收益率(%)(长期8%年化)
          const __EXPECTED_RETURN_5Y_10PCT__ = Math.pow(1 + 0.1, ACCUMULATED_YEARS + 5) - 1; // 5年后【预期累计】收益率(%)(长期10%年化)
          const __EXPECTED_RETURN_5Y_12PCT__ = Math.pow(1 + 0.12, ACCUMULATED_YEARS + 5) - 1; // 5年后【预期累计】收益率(%)(长期12%年化)
          const __EXPECTED_RETURN_5Y_15PCT__ = Math.pow(1 + 0.15, ACCUMULATED_YEARS + 5) - 1; // 5年后【预期累计】收益率(%)(长期15%年化)

          const __RELATIVE_RETURN_5Y_6PCT__ = ((__EXPECTED_RETURN_5Y_6PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 5年后【预期相对】收益率(%)(长期6%年化)
          const __RELATIVE_RETURN_5Y_8PCT__ = ((__EXPECTED_RETURN_5Y_8PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 5年后【预期相对】收益率(%)(长期8%年化)
          const __RELATIVE_RETURN_5Y_10PCT__ = ((__EXPECTED_RETURN_5Y_10PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 5年后【预期相对】收益率(%)(长期10%年化)
          const __RELATIVE_RETURN_5Y_12PCT__ = ((__EXPECTED_RETURN_5Y_12PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 5年后【预期相对】收益率(%)(长期12%年化)
          const __RELATIVE_RETURN_5Y_15PCT__ = ((__EXPECTED_RETURN_5Y_15PCT__ + 1) / ((item[closeKey] / 100) + 1)) - 1; // 5年后【预期相对】收益率(%)(长期15%年化)


          return {
            日期: date,
            累计收益率: item[closeKey],
            __累计年限__: ACCUMULATED_YEARS,
            __年化收益率__: rightFormat?.find(i => i['date'] === date && i['key'] === '__年化收益率__')?.value,
            __EXPECTED_RETURN_3Y_6PCT__,
            __EXPECTED_RETURN_3Y_8PCT__,
            __EXPECTED_RETURN_3Y_10PCT__,
            __EXPECTED_RETURN_3Y_12PCT__,
            __EXPECTED_RETURN_3Y_15PCT__,

            __RELATIVE_RETURN_3Y_6PCT__,
            __RELATIVE_RETURN_3Y_8PCT__,
            __RELATIVE_RETURN_3Y_10PCT__,
            __RELATIVE_RETURN_3Y_12PCT__,
            __RELATIVE_RETURN_3Y_15PCT__,

            __EXPECTED_RETURN_5Y_6PCT__,
            __EXPECTED_RETURN_5Y_8PCT__,
            __EXPECTED_RETURN_5Y_10PCT__,
            __EXPECTED_RETURN_5Y_12PCT__,
            __EXPECTED_RETURN_5Y_15PCT__,
            __RELATIVE_RETURN_5Y_6PCT__,
            __RELATIVE_RETURN_5Y_8PCT__,
            __RELATIVE_RETURN_5Y_10PCT__,
            __RELATIVE_RETURN_5Y_12PCT__,
            __RELATIVE_RETURN_5Y_15PCT__,
            __monthlyRSI6__: __monthlyRSI6__,
            __quarterlyRSI6__: __quarterlyRSI6__,
            __recommendationLevel__: calculateRecommendationLevel({
              __monthlyRSI6__, __quarterlyRSI6__,
              __monthly10th__,
              __monthly90th__,
              __quarterly10th__,
              __quarterly90th__,
            }),
            __monthly10th__,
            __monthly90th__,
            __quarterly10th__,
            __quarterly90th__,
          };
        });
        console.log('RSI6Data ', RSI6Data)
        setRSI6Data(RSI6Data);
        setMacdData({
          montyly: calculateMACD({ data: monthlyData, closeKey, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
          quarterly: calculateMACD({ data: quarterlyData, closeKey, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
        })
      }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, period]);


  const RenderSearchCard = () => {
    return useMemo(() => (
      <Card style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>周期：</span>
            <Select
              style={{ width: 120 }}
              value={period}
              onChange={setPeriod}
              options={periodOptions}
            />
          </div>
          <Button type="primary" onClick={fetchData}>
            搜索
          </Button>
        </div>
      </Card>
    ), [period]);
  }

  // 计算MACD数据
  const MACDData = useMemo(() => {
    if (period === '成立来' && data.leftData.length > 0) {
      // 过滤每月数据，取每月的最后一天数据（收盘价）
      const monthlyMap = new Map<string, any>();
      data.leftData.forEach(item => {
        const monthKey = moment(item.date).format('YYYY-MM');
        const currentItem = monthlyMap.get(monthKey);

        if (!currentItem || moment(item.date).isAfter(moment(currentItem.date))) {
          monthlyMap.set(monthKey, item);
        }
      });

      // 将Map转换为数组并按日期排序
      const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => {
        return moment(a.date).valueOf() - moment(b.date).valueOf();
      });

      // 转换为MACD需要的数据格式
      const macdInputData = monthlyData.map(item => ({
        日期: item.date,
        收盘: item.value
      }));

      // 计算MACD
      const macdResult = calculateMACD({ data: macdInputData, closeKey: '收盘' });

      // 确保日期格式正确
      return macdResult.map(item => ({
        ...item,
        date: item.日期 // 添加date字段，与xField对应
      }));
    }
    return [];
  }, [data.leftData, period]);

  // console.log('macdData', macdData)
  // console.log('MACDData', MACDData)

  return (
    <Spin spinning={loading}>
      <RenderSearchCard />
      <Collapse defaultActiveKey={["1"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>累计收益率走势</span>} key="1">
          <Card>
            {useMemo(() => <DualAxes {...config} />, [config])}
          </Card>
        </Collapse.Panel>
      </Collapse>
      <Collapse defaultActiveKey={["1"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别 ({RSI6LevelData?.length}条)</span>} key="1">
          <Card style={{ marginTop: '16px' }}>
            <Table
              dataSource={RSI6LevelData}
              columns={tableColumns}
              rowKey={dateKey}
              pagination={false}
              scroll={{ x: 1800 }}
            />
          </Card>
          <Card style={{ marginTop: '16px' }}>
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>月度RSI6 10%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__monthly10th__']?.toFixed(2) || '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>月度RSI6 90%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__monthly90th__']?.toFixed(2) || '-'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>季度RSI6 10%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__quarterly10th__']?.toFixed(2) || '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>季度RSI6 90%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__quarterly90th__']?.toFixed(2) || '-'}</span>
                </div>
              </div>
            </div>
            {useMemo(() => {
              const leftData = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item[leftKey],
                label: leftName
              }));
              const rightDataMonthly = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item['__monthlyRSI6__'],
                label: 'RSI6（月）'
              }));
              const rightDataQuarterly = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item['__quarterlyRSI6__'],
                label: 'RSI6（季）'
              }));

              const annotationsData = RSI6LevelData?.map((item: any) => {
                const { color, fontSize } = getLevelStyle(item.__recommendationLevel__);
                return {
                  type: 'text' as const,
                  data: [new Date(item[dateKey]), item[leftKey]],
                  style: {
                    text: '●',
                    fontSize: fontSize,
                    dx: -(fontSize / 2),
                    stroke: color,
                    fill: color,
                  },
                };
              })
              // 添加分位数数据
              const percentileData = [];
              if (RSI6Data.length > 0) {
                const firstDate = RSI6Data[0][dateKey];
                const lastDate = RSI6Data[RSI6Data.length - 1][dateKey];
                const __monthly10th__ = RSI6Data[0]['__monthly10th__'];
                const __monthly90th__ = RSI6Data[0]['__monthly90th__'];
                const __quarterly10th__ = RSI6Data[0]['__quarterly10th__'];
                const __quarterly90th__ = RSI6Data[0]['__quarterly90th__'];

                // 月度分位数
                percentileData.push(
                  { date: firstDate, value: __monthly10th__, label: '月度10%分位' },
                  { date: lastDate, value: __monthly10th__, label: '月度10%分位' },
                  { date: firstDate, value: __monthly90th__, label: '月度90%分位' },
                  { date: lastDate, value: __monthly90th__, label: '月度90%分位' },
                  // 季度分位数
                  { date: firstDate, value: __quarterly10th__, label: '季度10%分位' },
                  { date: lastDate, value: __quarterly10th__, label: '季度10%分位' },
                  { date: firstDate, value: __quarterly90th__, label: '季度90%分位' },
                  { date: lastDate, value: __quarterly90th__, label: '季度90%分位' }
                );
              }

              return (
                <DualAxes
                  title={{ title: '累计收益率与RSI6走势' }}
                  xField={(d: { date: string }) => new Date(d.date)}
                  smooth={true}
                  children={[
                    {
                      data: leftData,
                      type: 'line',
                      yField: 'value',
                      colorField: 'label',
                      shapeField: 'smooth',
                      style: { stroke: '#5B8FF9', lineWidth: 2 },
                      axis: {
                        y: {
                          title: '累计收益率',
                          style: { titleFill: '#5B8FF9' },
                        },
                      },
                    },
                    {
                      data: [...rightDataMonthly, ...rightDataQuarterly, ...percentileData],
                      type: 'line',
                      yField: 'value',
                      colorField: 'label',
                      shapeField: 'smooth',
                      axis: {
                        y: {
                          position: 'right',
                          title: 'RSI6',
                          style: { titleFill: '#6c6868ff' },
                        },
                      },
                      style: (datum: any) => {
                        if (datum.label.includes('分位')) {
                          return { stroke: '#999', lineWidth: 1, lineDash: [5, 5] };
                        }
                        return {};
                      },
                    },
                  ]}
                  annotations={annotationsData}
                />
              );
            }, [RSI6Data, RSI6LevelData, macdData])}
          </Card>
        </Collapse.Panel>
      </Collapse>
      <Collapse defaultActiveKey={["1"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📊 MACD指标</span>} key="1">
          <Card style={{ marginTop: '16px' }}>
            {useMemo(() => {
              if (macdData?.montyly?.length === 0) return null;
              return (
                <DualAxes
                  title={{ title: 'MACD指标走势' }}
                  xField="日期"
                  data={macdData?.montyly}
                  legend={{
                    position: 'top',
                    items: [
                      { name: 'DIF', value: 'DIF' },
                      { name: 'DEA', value: 'DEA' },
                      { name: 'MACD柱', value: 'MACD柱' }
                    ]
                  }}
                  children={[
                    {
                      type: 'line',
                      yField: '__MACD_DIF__',
                      shapeField: 'smooth',
                      color: '#5B8FF9',
                      axis: {
                        y: {
                          title: 'DIF/DEA',
                          style: { titleFill: '#5B8FF9' },
                        },
                      },
                      style: { lineWidth: 2 },
                    },
                    {
                      type: 'line',
                      yField: '__MACD_DEA__',
                      shapeField: 'smooth',
                      color: '#6c6868ff',
                      axis: {
                        y: {
                          position: 'right',
                          title: 'MACD柱',
                          style: { titleFill: '#6c6868ff' },
                        },
                      },
                      style: { lineWidth: 2 },
                    },
                    {
                      type: 'interval',
                      yField: '__MACD_BAR__',
                      color: '#1890ff',
                      axis: {
                        y: {
                          position: 'right',
                        },
                      },
                      style: (datum: any) => {
                        return {
                          fill: datum.__MACD_BAR__ >= 0 ? '#52c41a' : '#ff4d4f',
                        };
                      },
                    },
                  ]}
                />
              );
            }, [macdData?.montyly])}
          </Card>
          <Card style={{ marginTop: '16px' }}>
            {useMemo(() => {
              if (macdData?.quarterly?.length === 0) return null;
              return (
                <DualAxes
                  title={{ title: 'MACD指标走势' }}
                  xField="日期"
                  data={macdData?.quarterly}
                  legend={{
                    position: 'top',
                    items: [
                      { name: 'DIF', value: 'DIF' },
                      { name: 'DEA', value: 'DEA' },
                      { name: 'MACD柱', value: 'MACD柱' }
                    ]
                  }}
                  children={[
                    {
                      type: 'line',
                      yField: '__MACD_DIF__',
                      shapeField: 'smooth',
                      color: '#5B8FF9',
                      axis: {
                        y: {
                          title: 'DIF/DEA',
                          style: { titleFill: '#5B8FF9' },
                        },
                      },
                      style: { lineWidth: 2 },
                    },
                    {
                      type: 'line',
                      yField: '__MACD_DEA__',
                      shapeField: 'smooth',
                      color: '#6c6868ff',
                      axis: {
                        y: {
                          position: 'right',
                          title: 'MACD柱',
                          style: { titleFill: '#6c6868ff' },
                        },
                      },
                      style: { lineWidth: 2 },
                    },
                    {
                      type: 'interval',
                      yField: '__MACD_BAR__',
                      color: '#1890ff',
                      axis: {
                        y: {
                          position: 'right',
                        },
                      },
                      style: (datum: any) => {
                        return {
                          fill: datum.__MACD_BAR__ >= 0 ? '#52c41a' : '#ff4d4f',
                        };
                      },
                    },
                  ]}
                />
              );
            }, [macdData?.quarterly])}
          </Card>
        </Collapse.Panel>
      </Collapse>
    </Spin>
  );
};

export default CumulativeReturn;