import { DualAxes } from '@ant-design/plots';
import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { pick } from 'lodash-es';
import { Tabs ,Button,} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import akshareApi from '@/utils/akshareApi';


const Stock_a_ttm_lyr = () => {
  const chartName = 'A 股等权重与中位数市盈率'; // 图表名称
  const dateKey = 'date' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = 'close' // 左y轴键名
  const leftName = '沪深300指数' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    middlePETTM: '全A股滚动市盈率(TTM)中位数',
    averagePETTM: '全A股滚动市盈率(TTM)等权平均',
    middlePELYR: '全A股静态市盈率(LYR)中位数',
    averagePELYR: '全A股静态市盈率(LYR)等权平均',
    quantileInAllHistoryMiddlePeTtm: '当前"TTM(滚动市盈率)中位数"在历史数据上的分位数',
    quantileInRecent10YearsMiddlePeTtm: '当前"TTM(滚动市盈率)中位数"在最近10年数据上的分位数',
    quantileInAllHistoryAveragePeTtm: '当前"TTM(滚动市盈率)等权平均"在历史数据上的分位数',
    quantileInRecent10YearsAveragePeTtm: '当前"TTM(滚动市盈率)等权平均"在最近10年数据上的分位数',
    quantileInAllHistoryMiddlePeLyr: '当前"LYR(静态市盈率)中位数"在历史数据上的分位数',
    quantileInRecent10YearsMiddlePeLyr: '当前"LYR(静态市盈率)中位数"在最近10年数据上的分位数',
    quantileInAllHistoryAveragePeLyr: '当前"LYR(静态市盈率)等权平均"在历史数据上的分位数',
    quantileInRecent10YearsAveragePeLyr: '当前"LYR(静态市盈率)等权平均"在最近10年数据上的分位数',
  }
  const sampleRate = 10; // 抽样率
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
  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/stock_a_ttm_lyr')
      //  const response = await akshareApi.getStockATTMLYR({});
      // const response = await akshareApi.getStockAGxl({});
      console.log(`${chartName} -> response`, response)
      const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat()
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
      })
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `, // 
    },
    xField: (d: { date: string }) => new Date(d.date),
    // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

  return <>
    <DualAxes {...config} />
  </>
};

const Stock_a_all_pb = () => {
  const chartName = 'A 股等权重与中位数市净率'; // 图表名称
  const dateKey = 'date' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = 'close' // 左y轴键名
  const leftName = '上证指数' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    middlePB: '全部A股市净率中位数',
    equalWeightAveragePB: '全部A股市净率等权平均',
    quantileInAllHistoryMiddlePB: '当前市净率中位数在历史数据上的分位数',
    quantileInRecent10YearsMiddlePB: '当前市净率中位数在最近10年数据上的分位数',
    quantileInAllHistoryEqualWeightAveragePB: '当前市净率等权平均在历史数据上的分位数',
    quantileInRecent10YearsEqualWeightAveragePB: '当前市净率等权平均在最近10年数据上的分位数',
  }
  const sampleRate = 10; // 抽样率
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
  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/stock_a_all_pb')
      console.log(`${chartName} -> response`, response)
      const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat()
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
      })
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `, // 
    },
    xField: (d: { date: string }) => new Date(d.date),
    // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

  return <>
    <DualAxes {...config} />
  </>
};

const Stock_market_pe_lg = () => {
  const symbols = ["上证", "深证", "创业板", "科创版"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    const chartName = `${symbol} 市盈率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '指数' // 左y轴键名
    const leftName = symbol // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称
      平均市盈率: '平均市盈率',
    }
    const sampleRate = 1; // 抽样率
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
    const [data, setData] = useState<{
      leftData: DataRes[];
      rightData: {
        date: string;
        key: string;
        value: number;
      }[];
    }>({ leftData: [], rightData: [] });
    const fetchData = async () => {
      try {
        const response = await apiClient.get(`/api/public/stock_market_pe_lg?symbol=${symbol}`)
        console.log(`${chartName} -> response`, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
          date: item[dateKey],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    useEffect(() => {
      fetchData();
    }, []);

    console.log(`${chartName} -> data`, data)
    const config = {
      title: {
        title: chartName,
        subtitle: `${leftName} 与 ${chartName} `, // 
      },
      xField: (d: { date: string }) => new Date(d.date),
      // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

    return <>
      <DualAxes {...config} />
    </>
  };


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
};


const Stock_market_pb_lg = () => {
  const symbols = ["上证", "深证", "创业板", "科创版"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    const chartName = `${symbol} 市净率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '指数' // 左y轴键名
    const leftName = symbol // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称
      市净率: '市净率',
      等权市净率: '等权市净率',
      市净率中位数: '市净率中位数',
    }
    const sampleRate = 10; // 抽样率
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
    const [data, setData] = useState<{
      leftData: DataRes[];
      rightData: {
        date: string;
        key: string;
        value: number;
      }[];
    }>({ leftData: [], rightData: [] });
    const fetchData = async () => {
      try {
        const response = await apiClient.get(`/api/public/stock_market_pb_lg?symbol=${symbol}`)
        console.log(`${chartName} -> response`, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
          date: item[dateKey],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    useEffect(() => {
      fetchData();
    }, []);

    console.log(`${chartName} -> data`, data)
    const config = {
      title: {
        title: chartName,
        subtitle: `${leftName} 与 ${chartName} `, // 
      },
      xField: (d: { date: string }) => new Date(d.date),
      // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

    return <>
      <DualAxes {...config} />
    </>
  };


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
};

const Stock_index_pb_lg = () => {
  const symbols = ["上证50", "沪深300", "上证380", "创业板50", "中证500", "上证180", "深证红利", "深证100", "中证1000", "上证红利", "中证100", "中证800"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    const chartName = `${symbol} 市净率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '指数' // 左y轴键名
    const leftName = symbol // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称
      市净率: '市净率',
      等权市净率: '等权市净率',
      市净率中位数: '市净率中位数',
    }
    const sampleRate = 10; // 抽样率
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
    const [data, setData] = useState<{
      leftData: DataRes[];
      rightData: {
        date: string;
        key: string;
        value: number;
      }[];
    }>({ leftData: [], rightData: [] });
    const fetchData = async () => {
      try {
        const response = await apiClient.get(`/api/public/stock_index_pb_lg?symbol=${symbol}`)
        console.log(`${chartName} -> response`, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
          date: item[dateKey],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    useEffect(() => {
      fetchData();
    }, []);

    console.log(`${chartName} -> data`, data)
    const config = {
      title: {
        title: chartName,
        subtitle: `${leftName} 与 ${chartName} `, // 
      },
      xField: (d: { date: string }) => new Date(d.date),
      // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

    return <>
      <DualAxes {...config} />
    </>
  };


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
};


const Stock_index_pe_lg = () => {
  const symbols = ["上证50", "沪深300", "上证380", "创业板50", "中证500", "上证180", "深证红利", "深证100", "中证1000", "上证红利", "中证100", "中证800"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    const chartName = `${symbol} 市盈率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '指数' // 左y轴键名
    const leftName = symbol // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称
      等权静态市盈率: '等权静态市盈率',
      静态市盈率: '静态市盈率',
      静态市盈率中位数: '静态市盈率中位数',
      等权滚动市盈率: '等权滚动市盈率',
      滚动市盈率: '滚动市盈率',
      滚动市盈率中位数: '滚动市盈率中位数',
    }
    const sampleRate = 10; // 抽样率
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
    const [data, setData] = useState<{
      leftData: DataRes[];
      rightData: {
        date: string;
        key: string;
        value: number;
      }[];
    }>({ leftData: [], rightData: [] });
    const fetchData = async () => {
      try {
        const response = await apiClient.get(`/api/public/stock_index_pe_lg?symbol=${symbol}`)
        console.log(`${chartName} -> response`, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
          date: item[dateKey],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    useEffect(() => {
      fetchData();
    }, []);

    console.log(`${chartName} -> data`, data)
    const config = {
      title: {
        title: chartName,
        subtitle: `${leftName} 与 ${chartName} `, // 
      },
      xField: (d: { date: string }) => new Date(d.date),
      // scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
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

    return <>
      <DualAxes {...config} />
    </>
  };


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
};


const Index = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
  });

  console.log('refreshKeys, ', refreshKeys)

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>A 股等权重与中位数市盈率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '1': prev['1'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_a_ttm_lyr key={refreshKeys['1']} />, [refreshKeys['1']]),
    },
    {
      key: '2',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>A 股等权重与中位数市净率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '2': prev['2'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_a_all_pb key={refreshKeys['2']} />, [refreshKeys['2']]),
    },
    {
      key: '3',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>主板市盈率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '3': prev['3'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_market_pe_lg key={refreshKeys['3']} />, [refreshKeys['3']]),
    },
    {
      key: '4',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>主板市净率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '4': prev['4'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_market_pb_lg key={refreshKeys['4']} />, [refreshKeys['4']]),
    },
    {
      key: '5',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>指数市盈率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '5': prev['5'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_index_pe_lg key={refreshKeys['5']} />, [refreshKeys['5']]),
    },
    {
      key: '6',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>指数市净率</span>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            onClick={() => setRefreshKeys(prev => ({ ...prev, '6': prev['6'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_index_pb_lg key={refreshKeys['6']} />, [refreshKeys['6']]),
    },
    
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;
