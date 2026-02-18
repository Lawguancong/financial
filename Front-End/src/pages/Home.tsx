import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';


const today = moment().format('YYYYMMDD'); // 获取当天日期并格式化为YYYYMMDD







const Stock_a_ttm_lyr = () => {
  interface DataRes {
    date: string; //日期
    close: number; //沪深300指数
    middlePETTM: number; //全A股滚动市盈率(TTM)中位数
    averagePETTM: number; //全A股滚动市盈率(TTM)等权平均
    middlePELYR: number; //全A股静态市盈率(LYR)中位数
    averagePELYR: number; //全A股静态市盈率(LYR)等权平均
    quantileInAllHistoryMiddlePeTtm: number; //当前"TTM(滚动市盈率)中位数"在历史数据上的分位数
    quantileInRecent10YearsMiddlePeTtm: number; //当前"TTM(滚动市盈率)中位数"在最近10年数据上的分位数
    quantileInAllHistoryAveragePeTtm: number; //当前"TTM(滚动市盈率)等权平均"在历史数据上的分位数
    quantileInRecent10YearsAveragePeTtm: number; //当前"TTM(滚动市盈率)等权平均"在在最近10年数据上的分位数
    quantileInAllHistoryMiddlePeLyr: number; //当前"LYR(静态市盈率)中位数"在历史数据上的分位数
    quantileInRecent10YearsMiddlePeLyr: number; //当前"LYR(静态市盈率)中位数"在最近10年数据上的分位数
    quantileInAllHistoryAveragePeLyr: number; //当前"LYR(静态市盈率)等权平均"在历史数据上的分位数
    quantileInRecent10YearsAveragePeLyr: number; //当前"LYR(静态市盈率)等权平均"在最近10年数据上的分位数
  }

  const labelMap = {
    close: '沪深300指数',
    middlePETTM: '全A股滚动市盈率(TTM)中位数',
    averagePETTM: '全A股滚动市盈率(TTM)等权平均',
    middlePELYR: '全A股静态市盈率(LYR)中位数',
    averagePELYR: '全A股静态市盈率(LYR)等权平均',
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/stock_a_ttm_lyr')
      const dataFormat = response?.data?.filter((_, index: number) => index % 10 === 0)?.map((item: DataRes) => Object.keys(pick(item, ['close', 'averagePELYR', 'averagePETTM', 'middlePELYR', 'middlePETTM'])).map((key) => ({
        date: item['date'],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat()
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === 'close'),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== 'close')
      })
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const config = {
    xField: (d: DataRes) => new Date(d['date']),
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
            title: '沪深300',
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
            title: '市盈率',
            style: { titleFill: '#000' },
          },
        },
      },



    ],
  };

  return <>
    <DualAxes {...config} />;
  </>
};


const Stock_a_all_pb = () => {
  interface DataRes {
    date: string; //	日期
    close: number; //	上证指数
    middlePB: number; //	全部A股市净率中位数
    equalWeightAveragePB: number; //	全部A股市净率等权平均
    quantileInAllHistoryMiddlePB: number; //	当前市净率中位数在历史数据上的分位数
    quantileInRecent10YearsMiddlePB: number; //	当前市净率中位数在最近10年数据上的分位数
    quantileInAllHistoryEqualWeightAveragePB: number; //	当前市净率等权平均在历史数据上的分位数
    quantileInRecent10YearsEqualWeightAveragePB: number; //	当前市净率等权平均在最近10年数据上的分位数
  }

  const labelMap = {
    close: '上证指数',
    middlePB: '全部A股市净率中位数',
    equalWeightAveragePB: '全部A股市净率等权平均',
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/stock_a_all_pb')
      console.log('stock_a_all_pb -> response', response)
      const dataFormat = response?.data?.filter((_, index: number) => index % 10 === 0)?.map((item: DataRes) => Object.keys(pick(item, ['close', 'middlePB', 'equalWeightAveragePB'])).map((key) => ({
        date: item['date'],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat()
      console.log('stock_a_all_pb -> dataFormat', dataFormat)
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === 'close'),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== 'close')
      })
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  console.log('stock_a_all_pb -> data', data)
  const config = {
    xField: (d: DataRes) => new Date(d['date']),
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
            title: '沪深300',
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
            title: '市净率',
            style: { titleFill: '#000' },
          },
        },
      },

    ],
  };

  return <>
    <DualAxes {...config} />;
  </>
};


const Stock_market_pe_lg = () => {

  const symbols = ["上证", "深证", "创业板", "科创版"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    interface DataRes {
      日期: string;
      指数: number;
      平均市盈率: number;
    }
    const [data, setData] = useState<DataRes[]>([]);
    const fetchData = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_market_pe_lg?symbol=${symbol}`)
        console.log('主板市盈率 -> response', symbol, response)
        setData(response.data)
      } catch (error) {
        console.log('error', error)
      }
    }

    console.log('主板市盈率 -> data', data)

    useEffect(() => {
      fetchData();
    }, []);

    const config = {
      title: {
        title: symbol, // 主标题的文本新秀丽
        subtitle: symbol, // 副标题的文本新秀丽
      },
      data,
      xField: (d: DataRes) => new Date(d['日期']),
      legend: true,
      children: [
        {
          type: 'line',
          yField: '指数',
          shapeField: 'smooth',
          style: {
            stroke: '#5B8FF9',
            lineWidth: 2,
          },
          axis: {
            y: {
              title: '指数',
              style: { titleFill: '#5B8FF9' },
            },
          },
        },
        {
          type: 'line',
          yField: '平均市盈率',
          shapeField: 'smooth',
          style: {
            stroke: 'darkgreen',
            lineWidth: 2,
          },
          axis: {
            y: {
              position: 'right',
              title: '平均市盈率',
              style: { titleFill: '#5AD8A6' },
            },
          },
          // area: {
          //   style: {
          //     fill: 'linear-gradient(-90deg, white 0%, darkgreen 100%)',
          //   },
          // },
        },
      ],
    };
    return <DualAxes {...config} />;
  }


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}

const Stock_market_pb_lg = () => {

  const symbols = ["上证", "深证", "创业板", "科创版"]
  // 科创版 返回的数据结构不统一

  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    interface DataRes {
      日期: string;
      指数: number;
      市净率: number;
      等权市净率: number;
      市净率中位数: number;
    }
    const labelMap = {
      指数: '指数',
      市净率: '市净率',
      等权市净率: '等权市净率',
      市净率中位数: '市净率中位数',
    }
    const [data, setData] = useState<{
      leftData: DataRes[];
      rightData: {
        ['日期']: string;
        key: string;
        value: number;
      }[];
    }>({ leftData: [], rightData: [] });
    const fetchData = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_market_pb_lg?symbol=${symbol}`)
        console.log('主板市净率 -> response', symbol, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % 10 === 0)?.map((item: DataRes) => Object.keys(pick(item, ['指数', '市净率', '等权市净率', '市净率中位数'])).map((key) => ({
          ['日期']: item['日期'],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === '指数'),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== '指数')
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    console.log('主板市净率 -> data', data)


    useEffect(() => {
      fetchData();
    }, []);

    const config = {
      xField: (d: DataRes) => new Date(d['日期']),
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
              title: symbol,
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
              title: '市净率',
              style: { titleFill: '#000' },
            },
          },
        },



      ],
    };
    return <DualAxes {...config} />;
  }


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}



const Stock_index_pb_lg = () => {

  const symbols = ["上证50", "沪深300", "上证380", "创业板50", "中证500", "上证180", "深证红利", "深证100", "中证1000", "上证红利", "中证100", "中证800"]
  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    interface DataRes {
      日期: string;
      指数: number;
      市净率: number;
      等权市净率: number;
      市净率中位数: number;
    }
    const labelMap = {
      指数: '指数',
      市净率: '市净率',
      等权市净率: '等权市净率',
      市净率中位数: '市净率中位数',
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
        const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_index_pb_lg?symbol=${symbol}`)
        console.log('指数市净率 -> response', symbol, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % 10 === 0)?.map((item: DataRes) => Object.keys(pick(item, ['指数', '市净率', '等权市净率', '市净率中位数'])).map((key) => ({
          ['日期']: item['日期'],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === '指数'),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== '指数')
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    console.log('指数市净率 -> data', data)


    useEffect(() => {
      fetchData();
    }, []);

    const config = {
      xField: (d: DataRes) => new Date(d['日期']),
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
              title: symbol,
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
              title: '市净率',
              style: { titleFill: '#000' },
            },
          },
        },
      ],
    };
    return <DualAxes {...config} />;
  }


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}

const Stock_index_pe_lg = () => {

  const symbols = ["上证50", "沪深300", "上证380", "创业板50", "中证500", "上证180", "深证红利", "深证100", "中证1000", "上证红利", "中证100", "中证800"]
  // const symbols = ["上证50"]
  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    interface DataRes {
      日期: string;
      指数: number;
      等权静态市盈率: number;
      静态市盈率: number;
      静态市盈率中位数: number;
      等权滚动市盈率: number;
      滚动市盈率: number;
      滚动市盈率中位数: number;
    }
    const labelMap = {
      指数: '指数',
      等权静态市盈率: '等权静态市盈率',
      静态市盈率: '静态市盈率',
      静态市盈率中位数: '静态市盈率中位数',
      等权滚动市盈率: '等权滚动市盈率',
      滚动市盈率: '滚动市盈率',
      滚动市盈率中位数: '滚动市盈率中位数',
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
        const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_index_pe_lg?symbol=${symbol}`)
        console.log('指数市盈率 -> response', symbol, response)
        const dataFormat = response?.data?.filter((_, index: number) => index % 10 === 0)?.map((item: DataRes) => Object.keys(pick(item, ['指数', '等权静态市盈率', '静态市盈率', '静态市盈率中位数', '等权滚动市盈率', '滚动市盈率', '滚动市盈率中位数'])).map((key) => ({
          ['日期']: item['日期'],
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: item[key as keyof DataRes],
        }))).flat()
        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === '指数'),
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== '指数')
        })
      } catch (error) {
        console.log('error', error)
      }
    }

    console.log('指数市净率 -> data', data)


    useEffect(() => {
      fetchData();
    }, []);

    const config = {
      xField: (d: DataRes) => new Date(d['日期']),
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
              title: symbol,
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
              title: '市盈率',
              style: { titleFill: '#000' },
            },
          },
        },
      ],
    };
    return <DualAxes {...config} />;
  }


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}

const Stock_a_gxl_lg = () => {

  const symbols = ["上证A股", "深证A股", "创业板", "科创板"]
  // const symbols = ["上证A股"]
  const RenderDualAxes = ({ symbol }: { symbol: string }) => {
    interface DataRes {
      日期: string;
      股息率: number;
    }
    const [data, setData] = useState<DataRes[]>([]);
    const fetchData = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_a_gxl_lg?symbol=${symbol}`)
        console.log('A 股股息率 -> response', symbol, response)
        setData(response.data)
      } catch (error) {
        console.log('error', error)
      }
    }

    console.log('A 股股息率 -> data', data)

    useEffect(() => {
      fetchData();
    }, []);

    const config = {
      title: {
        title: symbol, // 主标题的文本新秀丽
        subtitle: symbol, // 副标题的文本新秀丽
      },
      data,
      xField: (d: DataRes) => new Date(d['日期']),
      legend: true,
      children: [
        {
          type: 'line',
          yField: '股息率',
          shapeField: 'smooth',
          style: {
            stroke: '#5B8FF9',
            lineWidth: 2,
          },
          axis: {
            y: {
              title: '股息率',
              style: { titleFill: '#5B8FF9' },
            },
          },
        },
      ],
    };
    return <DualAxes {...config} />;
  }


  return <>
    {useMemo(() => symbols.map((symbol) => (
      <RenderDualAxes key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}


const DemoLine = (props) => {
  const { data = [] } = props;
  const config = {
    data,
    xField: (d) => new Date(d.date),
    yField: 'close',
    axis: {
      x: {
        title: 'x轴标题',
        // padding: 0, // todo 有bug
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
  return <Line {...config} />;
};



const Macro_china_gdp = () => {
  const chartName = '国内生产总值GDP'; // 图表名称
  const dateKey = '季度' // 日期键名
  const dateName = '季度' // 日期键名
  const leftKey = '国内生产总值-绝对值' // 左y轴键名
  const leftName = '国内生产总值-绝对值（亿元）' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    '国内生产总值-同比增长': '国内生产总值-同比增长（%）',
    "第一产业-绝对值": '第一产业-绝对值（亿元）',
    "第一产业-同比增长": '第一产业-同比增长（%）',
    "第二产业-绝对值": '第二产业-绝对值（亿元）',
    "第二产业-同比增长": '第二产业-同比增长（%）',
    "第三产业-绝对值": '第三产业-绝对值（亿元）',
    "第三产业-同比增长": '第三产业-同比增长（%）'
  }
  const sampleRate = 4; // 抽样率
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/macro_china_gdp')
      console.log(`${chartName} -> response`, response)
      const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat().reverse();
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
    },
    // xField: (d: { date: string }) => new Date(d.date),
    xField: (d: { date: string }) => d.date,

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
    <DualAxes {...config} />;
  </>
};

const Stock_a_congestion_lg = () => {
  const chartName = '大盘拥挤度'; // 图表名称
  const dateKey = 'date' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = 'close' // 左y轴键名
  const leftName = '上证指数' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    congestion: '拥挤度',
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/stock_a_congestion_lg')
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
};


const Index_pmi_render = () => {
  const keysMapping = {
    '综合PMI': 'index_pmi_com_cx',
    '制造业PMI': 'index_pmi_man_cx',
    '服务业PMI': 'index_pmi_ser_cx',
  }

  return (Object.keys(keysMapping) as Array<keyof typeof keysMapping>).map((keyName) => (
    <Index_pmi_com_cx keyName={keyName} path={keysMapping[keyName]} />
  ))


}

const Index_pmi_com_cx = ({ keyName, path }: { keyName: string; path: string }) => {

  console.log('Index_pmi_com_cx keyName, path', keyName, path)

  const chartName = keyName; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = keyName // 左y轴键名
  const leftName = keyName // 左y轴名称
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
      const response = await axios.get(`http://127.0.0.1:8080/api/public/${path}`)
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
};

const Macro_china_ppi_yearly = () => {
  const chartName = '中国 PPI 年率报告'; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '今值' // 左y轴键名
  const leftName = '中国 PPI 年率报告' // 左y轴名称
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/macro_china_ppi_yearly')
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
};

const Macro_china_cpi_yearly = () => {
  const chartName = '中国 CPI 年率报告'; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '今值' // 左y轴键名
  const leftName = '中国 CPI 年率报告' // 左y轴名称
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/macro_china_cpi_yearly')
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
};

const Macro_china_lpr = () => {
  const chartName = 'LPR品种数据'; // 图表名称
  const dateKey = 'TRADE_DATE' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = ''; // 左y轴键名
  const leftName = '' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    LPR1Y: 'LPR_1Y利率(%)',
    LPR5Y: 'LPR_5Y利率(%)',
    RATE_1: '短期贷款利率:6个月至1年(含)(%)',
    RATE_2: '中长期贷款利率:5年以上(%)',
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/macro_china_lpr')
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
};



const Macro_china_urban_unemployment = () => {
  const [data, setData] = useState([]);
  const fetchData = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8080/api/public/macro_china_urban_unemployment`) // 城镇调查失业率
      setData(response?.data || [])
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  console.log('Macro_china_urban_unemployment data', data)
  const config = {
    data,
    xField: (d) => new Date(moment(d.date).format('YYYY-MM-DD')),
    yField: 'value',
    colorField: 'item',
    shapeField: 'smooth',
  };
  return <Line {...config} />;
}

const Fund_aum_trend_em = () => {
  const chartName = '基金规模走势'; // 图表名称
  const dateKey = 'date' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = 'value' // 左y轴键名
  const leftName = '元' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    // congestion: '拥挤度',
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
      const response = await axios.get('http://127.0.0.1:8080/api/public/fund_aum_trend_em')
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
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
  return <DualAxes {...config} />;
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
  return <DualAxes {...config} />;
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
  return <DualAxes {...config} />;
};


const Stock_zh_index_hist_csindex = () => {
  const chartName = '中证全指'; // 图表名称
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
      const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_zh_index_hist_csindex?symbol=000985&start_date=20050101&end_date=${today}`)
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
      title: chartName, // 主标题的文本新秀丽
      subtitle: `${leftName} 与 ${chartName} `, // 副标题的文本新秀丽
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
    <DualAxes {...config} />;
  </>
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
  // 目标地址: 沪深京三个交易所
  // 描述: 沪深京 A 股股票代码和股票简称数据
  // 限量: 单次获取所有 A 股股票代码和简称数据
  // http://127.0.0.1:8080/api/public/stock_info_a_code_name


  // 个股估值
  // 接口: stock_value_em
  // 目标地址: https://data.eastmoney.com/gzfx/detail/300766.html
  // 描述: 东方财富网-数据中心-估值分析-每日互动-每日互动-估值分析
  // 限量: 单次获取指定 symbol 的所有历史数据
  // 入参: symbol	str	symbol="002044"; A 股代码
  // http://127.0.0.1:8080/api/public/stock_value_em?symbol=002044



  // 波动率指数


  // 创新高和新低的股票数量
  // 接口: stock_a_high_low_statistics
  // 目标地址: https://www.legulegu.com/stockdata/high-low-statistics
  // 描述: 不同市场的创新高和新低的股票数量
  // 限量: 单次获取指定 market 的近两年的历史数据
  // http://127.0.0.1:8080/api/public/stock_a_high_low_statistics



  // 筹码分布
  // 接口: stock_cyq_em
  // 目标地址: https://quote.eastmoney.com/concept/sz000001.html
  // 描述: 东方财富网 - 概念板 - 行情中心 - 日K - 筹码分布
  // 限量: 单次返回指定 symbol 和 adjust 的近 90 个交易日数据
  // http://127.0.0.1:8080/api/public/stock_cyq_em


  // 实时行情数据-雪球
  // 接口: stock_individual_spot_xq
  // 目标地址: https://xueqiu.com/S/SH513520
  // 描述: 雪球-行情中心-个股
  // 限量: 单次获取指定 symbol 的最新行情数据
  // http://127.0.0.1:8080/api/public/stock_individual_spot_xq


  // 股票行业成交
  // 接口: stock_szse_sector_summary
  // 目标地址: http://docs.static.szse.cn/www/market/periodical/month/W020220511355248518608.html
  // 描述: 深圳证券交易所-统计资料-股票行业成交数据
  // 限量: 单次返回指定 symbol 和 date 的统计资料-股票行业成交数据
  // http://127.0.0.1:8080/api/public/stock_szse_sector_summary



  // 上海证券交易所-每日概况
  // 接口: stock_sse_deal_daily
  // 目标地址: http://www.sse.com.cn/market/stockdata/overview/day/
  // 描述: 上海证券交易所-数据-股票数据-成交概况-股票成交概况-每日股票情况
  // 限量: 单次返回指定日期的每日概况数据, 当前交易日数据需要在收盘后获取; 注意仅支持获取在 20211227（包含）之后的数据
  // http://127.0.0.1:8080/api/public/stock_sse_deal_daily




  //  "stock_hk_indicator_eniu"  # 港股股个股市盈率、市净率和股息率指标
  //  "stock_a_high_low_statistics"  # 创新高和新低的股票数量



  return <>
    {/* Demo */}
    {useMemo(() => <DemoDualAxes />, [])}
    {useMemo(() => <DemoDualAxes1 />, [])}

    {/* 国内生产总值GDP */}
    {/* {useMemo(() => <Macro_china_gdp />, [])} */}

    {/* PMI */}
    {/* {useMemo(() => <Index_pmi_render />, [])} */}

    {/* 中国 PPI 年率报告 */}
    {/* {useMemo(() => <Macro_china_ppi_yearly />, [])} */}

    {/* 中国 CPI 年率报告 */}
    {/* {useMemo(() => <Macro_china_cpi_yearly />, [])} */}

    {/* LPR品种数据 */}
    {/* {useMemo(() => <Macro_china_lpr />, [])} */}


    {/* 城镇调查失业率 */}
    {/* {useMemo(() => <Macro_china_urban_unemployment />, [])} */}

    {/* todo 获取所有中证指数 stock_zh_index_hist_csindex */}
    {/* 中证全指 &市盈率 */}
    {/* {useMemo(() => <Stock_zh_index_hist_csindex />, [])} */}

    {/* A 股等权重与中位数市盈率 */}
    {/* {useMemo(() => <Stock_a_ttm_lyr />, [])} */}

    {/* A 股等权重与中位数市净率 */}
    {/* {useMemo(() => <Stock_a_all_pb />, [])} */}

    {/* 主板市盈率 */}
    {/* {useMemo(() => <Stock_market_pe_lg />, [])} */}

    {/* 主板市净率 */}
    {/* {useMemo(() => <Stock_market_pb_lg />, [])} */}

    {/* 指数市净率 */}
    {/* {useMemo(() => <Stock_index_pb_lg />, [])} */}

    {/* 指数市盈率 */}
    {/* {useMemo(() => <Stock_index_pe_lg />, [])} */}

    {/* A 股股息率 */}
    {/* {useMemo(() => <Stock_a_gxl_lg />, [])} */}

    {/* 大盘拥挤度：衡量市场微观结构恶化的指标，即成交额排名前5%的个股的成交额占全部A股占比创下历史极值，接近50%，预示着结构恶化，市场行情进入预警区域，或见顶，或风格发生转换。截止到2022年11月，历史上类似的情形出现过5次，市场均发生了巨大的反转，有2次市场进入牛市或维持牛市之中，且市场均发生了风格切换，分别是2008年10月和2015年1月。另三次发生了“牛转熊”现象。 */}
    {/* {useMemo(() => <Stock_a_congestion_lg />, [])} */}




    {/* todo 恒生 */}
    {/* 恒生指数股息率 */}
    {/* 接口: stock_hk_gxl_lg */}



    {/* todo 基金 */}
    {/* 基金基本信息-指数型 */}
    {/* 接口: fund_info_index_em */}

    {/* 基金规模走势 */}
    {/* {useMemo(() => <Fund_aum_trend_em />, [])} */}


  </>
};

export default Home;
