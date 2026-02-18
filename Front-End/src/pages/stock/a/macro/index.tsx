import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import moment from 'moment';
import { pick } from 'lodash-es';



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
    <DualAxes {...config} />
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
    <DualAxes {...config} />
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
    <DualAxes {...config} />
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
    <DualAxes {...config} />
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
    <DualAxes {...config} />
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
  return <Line {...config} />
}

const Index = () => {
  return <>
    {/* 国内生产总值GDP */}
    {useMemo(() => <Macro_china_gdp />, [])}

    {/* PMI */}
    {useMemo(() => <Index_pmi_render />, [])}

    {/* 中国 PPI 年率报告 */}
    {useMemo(() => <Macro_china_ppi_yearly />, [])}

    {/* 中国 CPI 年率报告 */}
    {useMemo(() => <Macro_china_cpi_yearly />, [])}

    {/* LPR品种数据 */}
    {useMemo(() => <Macro_china_lpr />, [])}

    {/* 城镇调查失业率 */}
    {useMemo(() => <Macro_china_urban_unemployment />, [])}

  </>
};

export default Index;
