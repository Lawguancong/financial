import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';

const Stock_buffett_index_lg = () => {
  const sampleRate = 10;
  interface DataRes {
    日期: string; //	object	交易日
    收盘价: number; //: number; //沪深300
    总市值: number; //: number; //A股收盘价*已发行股票总股本（A股+B股+H股）
    GDP: number; //: number; //上年度国内生产总值（例如：2019年，则取2018年GDP）
    近十年分位数: number; //: number; //当前"总市值/GDP"在历史数据上的分位数
    总历史分位数: number; //: number; //当前"总市值/GDP"在历史数据上的分位数
  }
  const [data, setData] = useState<DataRes[]>([]);
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/stock_buffett_index_lg')
      console.log('Stock_buffett_index_lg -> response', response)
      setData(response?.data.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => ({
        ...item,
        ['沪深300']: item['收盘价'],
        ['总市值/GDP']: Number((item['总市值'] / item['GDP'])?.toFixed(2)),
      })))
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  console.log('Stock_buffett_index_lg -> data', data)
  const config = {
    title: {
      title: '巴菲特指标',
      subtitle: `沪深300 与 总市值/GDP `, // 
    },
    data,
    xField: (d: DataRes) => new Date(d['日期']),
    legend: true,
    children: [
      {
        type: 'line',
        yField: '沪深300',
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
        type: 'line',
        yField: '总市值/GDP',
        shapeField: 'smooth',
        style: {
          stroke: 'darkgreen',
          lineWidth: 2,
        },
        axis: {
          y: false,
        },
        area: {
          axis: {
            y: {
              position: 'right',
              title: '总市值/GDP',
              style: { titleFill: '#5AD8A6' },
            },
          },
          style: {
            fill: 'linear-gradient(-90deg, white 0%, darkgreen 100%)',
          },
        },
      },
    ],
  };
  const config1 = {
    title: {
      title: '总市值 与 GDP',
      subtitle: `总市值 与 GDP`, // 
    },
    xField: (d: DataRes) => new Date(d['日期']),
    legend: true,
    scale: { color: { range: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#6F5EF9'] } },
    children: [
      {
        data: [...(data || []).map((item: DataRes) => ({
          ['日期']: item['日期'],
          value: item['总市值'],
          type: '总市值'
        })), ...(data || []).map((item: DataRes) => ({
          ['日期']: item['日期'],
          value: item['GDP'],
          type: 'GDP'
        }))],
        type: 'line',
        shapeField: 'smooth',
        yField: 'value',
        colorField: 'type',
      },
    ],
  };
  return <>
    <DualAxes {...config} />
    <DualAxes {...config1} />
  </>
};

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
  const Stock_a_gxl_lg_Mapping = ({ symbol }: { symbol: string }) => {
    const chartName =  `${symbol} 股息率`; // 图表名称
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
      <Stock_a_gxl_lg_Mapping key={symbol} symbol={symbol} />
    )), [symbols])}
  </>
}

const Stock_ebs_lg = () => {
  const chartName = '股债利差'; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '沪深300指数' // 左y轴键名
  const leftName = '沪深300指数' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    股债利差: '股债利差',
    股债利差均线: '股债利差均线',
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
      const response = await apiClient.get('/api/public/stock_ebs_lg')
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

const Stock_margin_account_info = () => {
  const chartName = '两融账户信息'; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = ''; // 左y轴键名
  const leftName = '' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    融资余额: '融资余额(亿)',
    融券余额: '融券余额(亿)',
    融资买入额: '融资买入额(亿)',
    融券卖出额: '融券卖出额(亿)',
    证券公司数量: '证券公司数量(家)',
    营业部数量: '营业部数量(家)',
    个人投资者数量: '个人投资者数量(万名)',
    机构投资者数量: '机构投资者数量(家)',
    参与交易的投资者数量: '参与交易的投资者数量(名)',
    有融资融券负债的投资者数量: '有融资融券负债的投资者数量(名)',
    担保物总价值: '担保物总价值(亿)',
    平均维持担保比例: '平均维持担保比例(%)',
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
      const response = await apiClient.get('/api/public/stock_margin_account_info')
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
      const response = await apiClient.get('/api/public/stock_a_congestion_lg')
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
    <h5>大盘拥挤度:衡量市场微观结构恶化的指标，即成交额排名前5%的个股的成交额占全部A股占比创下历史极值，接近50%，预示着结构恶化，市场行情进入预警区域，或见顶，或风格发生转换。截止到2022年11月，历史上类似的情形出现过5次，市场均发生了巨大的反转，有2次市场进入牛市或维持牛市之中，且市场均发生了风格切换，分别是2008年10月和2015年1月。另三次发生了“牛转熊”现象。</h5>
  </>
};

const Index: React.FC = () => {
  return <>
    {/* 巴菲特指标 */}
    {useMemo(() => <Stock_buffett_index_lg />, [])}

    {/* 股债利差 */}
    {useMemo(() => <Stock_ebs_lg />, [])}

    {/* 中证全指 &市盈率 */}
    {useMemo(() => <Stock_zh_index_hist_csindex />, [])}

    {/* A 股股息率 */}
    {useMemo(() => <Stock_a_gxl_lg />, [])}

    {/* todo 风险溢价 */}

    {/* todo 十年期国债利率倒数与A股PE中位数走势 */}

    {/* todo 破净统计 stock_a_below_net_asset_statistics */}

    {/* 两融账户信息 */}
    {useMemo(() => <Stock_margin_account_info />, [])}

    {/* 大盘拥挤度 */}
    {useMemo(() => <Stock_a_congestion_lg />, [])}

  </>
};

export default Index;
