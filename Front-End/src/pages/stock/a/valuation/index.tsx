import { DualAxes } from '@ant-design/plots';
import { useEffect, useState, useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { pick } from 'lodash-es';
import { Tabs, Button, } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import akshareApi from '@/utils/akshareApi';
import moment from 'moment';

const Stock_zh_index_hist_csindex = () => {
  const chartName = '中证全指-滚动市盈率'; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '收盘' // 左y轴键名
  const leftName = '中证全指' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    滚动市盈率: '滚动市盈率',
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
      // 入参
      // symbol	str	symbol = "000928"; 指数代码
      // start_date	str	start_date = "20180526"
      // end_date	str	end_date = "20240604"
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=000985&start_date=20050101&end_date=${moment().format('YYYYMMDD')}`)
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

const Stock_a_gxl_lg = () => {
  const symbols = ["上证A股", "深证A股", "创业板", "科创板"]
  const refs = useRef<({ fetchData: () => void })[]>([]);

  const handleRefresh = useCallback((symbol: string) => {
    const index = symbols.indexOf(symbol);
    refs.current[index]?.fetchData();
  }, [symbols]);

  const Stock_a_gxl_lg_Mapping = forwardRef<{ fetchData: () => void }, { symbol: string }>(({ symbol }, ref) => {
    const chartName = `${symbol} 股息率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '股息率'; // 左y轴键名
    const leftName = `${symbol} 股息率` // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称

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
        const response = await apiClient.get(`/api/public/stock_a_gxl_lg?symbol=${symbol}`)
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

    useImperativeHandle(ref, () => ({
      fetchData,
    }));

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

    return (
      <>
        <DualAxes {...config} />
      </>
    );
  });


  return <>
    {useMemo(() => <Tabs defaultActiveKey={symbols[0]} type="card" size="small" items={symbols.map((symbol, index) => ({
      key: symbol,
      label: (
        <span>
          {symbol}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRefresh(symbol)}
            style={{ marginLeft: 4 }}
          />
        </span>
      ),
      children: <Stock_a_gxl_lg_Mapping symbol={symbol} ref={(el) => { refs.current[index] = el as { fetchData: () => void } }} />,
    }))} />, [symbols])}
  </>
}


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
  const refs = useRef<({ fetchData: () => void })[]>([]);

  const handleRefresh = useCallback((symbol: string) => {
    const index = symbols.indexOf(symbol);
    refs.current[index]?.fetchData();
  }, [symbols]);

  const RenderDualAxes = forwardRef<{ fetchData: () => void }, { symbol: string }>(({ symbol }, ref) => {
    const chartName = `${symbol} 市盈率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '指数' // 左y轴键名
    const leftName = symbol // 左y轴名称
    const rightKeys = { // 右y轴键名: 右y轴名称
      平均市盈率: '平均市盈率',
      // 市盈率: '市盈率',
      // 总市值: '总市值',
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
        const dataFormat = response?.data?.map((item: DataRes) => ({
          ...item,
          平均市盈率: item.平均市盈率 || item.市盈率,
          指数: item.指数 || item.总市值, // 科创板：只有总市值、没有指数
        }))?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
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

    useImperativeHandle(ref, () => ({
      fetchData,
    }));

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
  });


  return <>
    {useMemo(() => <Tabs defaultActiveKey={symbols[0]} type="card" size="small" items={symbols.map((symbol, index) => ({
      key: symbol,
      label: (
        <span>
          {symbol}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRefresh(symbol)}
            style={{ marginLeft: 4 }}
          />
        </span>
      ),
      children: <RenderDualAxes symbol={symbol} ref={(el) => { refs.current[index] = el as { fetchData: () => void } }} />,
    }))} />, [symbols])}
  </>
};


const Stock_market_pb_lg = () => {
  const symbols = ["上证", "深证", "创业板", "科创版"]
  const refs = useRef<({ fetchData: () => void })[]>([]);

  const handleRefresh = useCallback((symbol: string) => {
    const index = symbols.indexOf(symbol);
    refs.current[index]?.fetchData();
  }, [symbols]);

  const RenderDualAxes = forwardRef<{ fetchData: () => void }, { symbol: string }>(({ symbol }, ref) => {
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

    useImperativeHandle(ref, () => ({
      fetchData,
    }));

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

    return (
      <>
        <DualAxes {...config} />
      </>
    );
  });


  return <>
    {useMemo(() => <Tabs defaultActiveKey={symbols[0]} type="card" size="small" items={symbols.map((symbol, index) => ({
      key: symbol,
      label: (
        <span>
          {symbol}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRefresh(symbol)}
            style={{ marginLeft: 4 }}
          />
        </span>
      ),
      children: <RenderDualAxes symbol={symbol} ref={(el) => { refs.current[index] = el as { fetchData: () => void } }} />,
    }))} />, [symbols])}
  </>
};

const Stock_index_pb_lg = () => {
  const symbols = ["上证50", "创业板50", "中证100",  "深证100", "上证180", "沪深300", "上证380", "中证500", "中证800", "中证1000","深证红利","上证红利" ]
  const refs = useRef<({ fetchData: () => void })[]>([]);

  const handleRefresh = useCallback((symbol: string) => {
    const index = symbols.indexOf(symbol);
    refs.current[index]?.fetchData();
  }, [symbols]);

  const RenderDualAxes = forwardRef<{ fetchData: () => void }, { symbol: string }>(({ symbol }, ref) => {
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

    useImperativeHandle(ref, () => ({
      fetchData,
    }));

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

    return (
      <>
        <DualAxes {...config} />
      </>
    );
  });


  return <>
    {useMemo(() => <Tabs defaultActiveKey={symbols[0]} type="card" size="small" items={symbols.map((symbol, index) => ({
      key: symbol,
      label: (
        <span>
          {symbol}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRefresh(symbol)}
            style={{ marginLeft: 4 }}
          />
        </span>
      ),
      children: <RenderDualAxes symbol={symbol} ref={(el) => { refs.current[index] = el as { fetchData: () => void } }} />,
    }))} />, [symbols])}
  </>
};


const Stock_index_pe_lg = () => {
  const symbols = ["上证50", "创业板50", "中证100",  "深证100", "上证180", "沪深300", "上证380", "中证500", "中证800", "中证1000","深证红利","上证红利" ]
  const refs = useRef<({ fetchData: () => void })[]>([]);

  const handleRefresh = useCallback((symbol: string) => {
    const index = symbols.indexOf(symbol);
    refs.current[index]?.fetchData();
  }, [symbols]);

  const RenderDualAxes = forwardRef<{ fetchData: () => void }, { symbol: string }>(({ symbol }, ref) => {
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

    useImperativeHandle(ref, () => ({
      fetchData,
    }));

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
  });


  return <>
    {useMemo(() => <Tabs defaultActiveKey={symbols[0]} type="card" size="small" items={symbols.map((symbol, index) => ({
      key: symbol,
      label: (
        <span>
          {symbol}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRefresh(symbol)}
            style={{ marginLeft: 4 }}
          />
        </span>
      ),
      children: <RenderDualAxes symbol={symbol} ref={(el) => { refs.current[index] = el as { fetchData: () => void } }} />,
    }))} />, [symbols])}
  </>
};


const Index = () => {
  const [activeCategory, setActiveCategory] = useState('pe');
  const [activeItemKey, setActiveItemKey] = useState('0');
  const [refreshKeys, setRefreshKeys] = useState({
    '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0,
  });

  // 创建带刷新按钮的 Tab label（stopPropagation 防止触发 Tab 切换）
  const createLabel = (text: string, key: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>{text}</span>
      <Button
        icon={<ReloadOutlined />}
        size="small"
        onClick={(e) => { e.stopPropagation(); setRefreshKeys(prev => ({ ...prev, [key]: prev[key] + 1 })); }}
      />
    </div>
  );

  // 各分类下的子 Tab 项
  const tabItemsMap: Record<string, { key: string; label: React.ReactNode; children: React.ReactNode }[]> = {
    pe: [
      { key: '0', label: createLabel('中证全指-滚动市盈率', '0'), children: useMemo(() => <Stock_zh_index_hist_csindex key={refreshKeys['0']} />, [refreshKeys['0']]) },
      { key: '1', label: createLabel('A 股等权重与中位数市盈率', '1'), children: useMemo(() => <Stock_a_ttm_lyr key={refreshKeys['1']} />, [refreshKeys['1']]) },
      { key: '3', label: createLabel('主板市盈率', '3'), children: useMemo(() => <Stock_market_pe_lg key={refreshKeys['3']} />, [refreshKeys['3']]) },
      { key: '5', label: createLabel('指数市盈率', '5'), children: useMemo(() => <Stock_index_pe_lg key={refreshKeys['5']} />, [refreshKeys['5']]) },
    ],
    pb: [
      { key: '2', label: createLabel('A 股等权重与中位数市净率', '2'), children: useMemo(() => <Stock_a_all_pb key={refreshKeys['2']} />, [refreshKeys['2']]) },
      { key: '4', label: createLabel('主板市净率', '4'), children: useMemo(() => <Stock_market_pb_lg key={refreshKeys['4']} />, [refreshKeys['4']]) },
      { key: '6', label: createLabel('指数市净率', '6'), children: useMemo(() => <Stock_index_pb_lg key={refreshKeys['6']} />, [refreshKeys['6']]) },
    ],
    dividend: [
      { key: '7', label: createLabel('A 股股息率', '7'), children: useMemo(() => <Stock_a_gxl_lg key={refreshKeys['7']} />, [refreshKeys['7']]) },
    ],
  };

  const categoryItems = [
    { key: 'pe', label: '市盈率' },
    { key: 'pb', label: '市净率' },
    { key: 'dividend', label: '股息率' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        activeKey={activeCategory}
        onChange={(key) => { setActiveCategory(key); setActiveItemKey(tabItemsMap[key]?.[0]?.key || ''); }}
        items={categoryItems}
        type="card"
        size="small"
        style={{ marginBottom: 16 }}
      />
      <Tabs
        activeKey={activeItemKey}
        onChange={setActiveItemKey}
        items={tabItemsMap[activeCategory] || []}
      />
    </div>
  );
};

export default Index;
