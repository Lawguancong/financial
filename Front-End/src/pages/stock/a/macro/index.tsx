import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { pick } from 'lodash-es';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useSetState } from 'ahooks';
import {
  Macro_china_czsr,
  Macro_china_xfzxx,
  Macro_china_reserve_requirement_ratio,
  Macro_china_consumer_goods_retail,
  Macro_china_supply_of_money,
  Macro_china_foreign_exchange_gold,
  Macro_china_fx_gold,
  Macro_china_money_supply,
  Macro_china_stock_market_cap,
  Macro_rmb_loan,
  Macro_rmb_deposit,
} from './components';

import Macro_yjbb from './yjbb/index';



const Macro_china_gdp = ({ key }: { key: number }) => {
  const chartName = '国内生产总值GDP';
  const dateKey = '季度'
  const dateName = '季度'
  const leftKey = '国内生产总值-绝对值'
  const leftName = '国内生产总值-绝对值（亿元）'
  const rightKeys = {
    '国内生产总值-同比增长': '国内生产总值-同比增长（%）',
    "第一产业-绝对值": '第一产业-绝对值（亿元）',
    "第一产业-同比增长": '第一产业-同比增长（%）',
    "第二产业-绝对值": '第二产业-绝对值（亿元）',
    "第二产业-同比增长": '第二产业-同比增长（%）',
    "第三产业-绝对值": '第三产业-绝对值（亿元）',
    "第三产业-同比增长": '第三产业-同比增长（%）'
  }
  const sampleRate = 4;
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
      const response = await apiClient.get('/api/public/macro_china_gdp')
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
  }, [key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `,
    },
    xField: (d: { date: string }) => d.date,
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

const Index_pmi_render = ({ key }: { key: number }) => {
  const keysMapping = {
    '综合PMI': 'index_pmi_com_cx',
    '制造业PMI': 'index_pmi_man_cx',
    '服务业PMI': 'index_pmi_ser_cx',
  }

  return (Object.keys(keysMapping) as Array<keyof typeof keysMapping>).map((keyName) => (
    <Index_pmi_com_cx keyName={keyName} path={keysMapping[keyName]} key={key} />
  ))


}

const Index_pmi_com_cx = ({ keyName, path, key }: { keyName: string; path: string; key: number }) => {
  const chartName = keyName;
  const dateKey = '日期'
  const dateName = '日期'
  const leftKey = keyName
  const leftName = keyName
  const rightKeys = {
  }
  const sampleRate = 1;
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
      const response = await apiClient.get(`/api/public/${path}`)
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
  }, [key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `,
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

  return <>
    <DualAxes {...config} />
  </>
};

const Macro_china_ppi_yearly = ({ key }: { key: number }) => {
  const chartName = '中国 PPI 年率报告';
  const dateKey = '日期'
  const dateName = '日期'
  const leftKey = '今值'
  const leftName = '中国 PPI 年率报告'
  const rightKeys = {
  }
  const sampleRate = 1;
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
      const response = await apiClient.get('/api/public/macro_china_ppi_yearly')
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
  }, [key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `,
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

  return <>
    <DualAxes {...config} />
  </>
};

const Macro_china_cpi_yearly = ({ key }: { key: number }) => {
  const chartName = '中国 CPI 年率报告';
  const dateKey = '日期'
  const dateName = '日期'
  const leftKey = '今值'
  const leftName = '中国 CPI 年率报告'
  const rightKeys = {
  }
  const sampleRate = 1;
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
      const response = await apiClient.get('/api/public/macro_china_cpi_yearly')
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
  }, [key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `,
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

  return <>
    <DualAxes {...config} />
  </>
};

const Macro_china_lpr = ({ key }: { key: number }) => {
  const chartName = 'LPR品种数据';
  const dateKey = 'TRADE_DATE'
  const dateName = '日期'
  const leftKey = '';
  const leftName = ''
  const rightKeys = {
    LPR1Y: 'LPR_1Y利率(%)',
    LPR5Y: 'LPR_5Y利率(%)',
    RATE_1: '短期贷款利率:6个月至1年(含)(%)',
    RATE_2: '中长期贷款利率:5年以上(%)',
  }
  const sampleRate = 1;
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
      const response = await apiClient.get('/api/public/macro_china_lpr')
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
  }, [key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName} `,
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

  return <>
    <DualAxes {...config} />
  </>
};

const Macro_china_urban_unemployment = ({ key }: { key: number }) => {
  const [data, setData] = useState([]);
  const fetchData = async () => {
    try {
      const response = await apiClient.get(`/api/public/macro_china_urban_unemployment`)
      setData(response?.data || [])
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, [key]);

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

// 中国宏观杠杆率
const Macro_cnbs = ({ key }: { key: number }) => {
  const chartName = '中国宏观杠杆率';
  const [data, setData] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_cnbs');
      console.log(`${chartName} -> response`, response);

      // 转换数据格式用于图表展示
      const formattedData: any[] = [];
      (response?.data || []).forEach((item: any) => {
        const date = item['年份'];
        // 为每个指标创建数据点
        Object.keys(item).forEach((key) => {
          if (key !== '年份') {
            formattedData.push({
              date: date,
              item: key,
              value: item[key],
            });
          }
        });
      });

      setData(formattedData);
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const config = {
    title: {
      title: chartName,
      subtitle: '各部门杠杆率变化趋势（%）',
    },
    data,
    xField: 'date',
    yField: 'value',
    colorField: 'item',
    shapeField: 'smooth',
    axis: {
      x: {
        title: '年份',
      },
      y: {
        title: '杠杆率（%）',
      },
    },
    legend: {
      position: 'top',
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: '杠杆率',
          valueFormatter: (value: number) => `${value}%`,
        },
      ],
    },
  };

  return <Line {...config} />;
};

// 中国企业商品价格
const Macro_china_qyspjg = ({ key }: { key: number }) => {
  const chartName = '企业商品价格';
  const [indexData, setIndexData] = useState<any[]>([]);
  const [yoyData, setYoyData] = useState<any[]>([]);
  const [momData, setMomData] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_qyspjg');
      console.log(`${chartName} -> response`, response);

      // 转换数据格式用于图表展示
      const indexFormattedData: any[] = [];
      const yoyFormattedData: any[] = [];
      const momFormattedData: any[] = [];

      (response?.data || [])?.reverse().forEach((item: any) => {
        const date = item['月份'];
        // 指数值数据
        indexFormattedData.push(
          { date, item: '总指数', value: item['总指数-指数值'] },
          { date, item: '农产品', value: item['农产品-指数值'] },
          { date, item: '矿产品', value: item['矿产品-指数值'] },
          { date, item: '煤油电', value: item['煤油电-指数值'] }
        );
        // 同比增长数据
        yoyFormattedData.push(
          { date, item: '总指数', value: item['总指数-同比增长'] },
          { date, item: '农产品', value: item['农产品-同比增长'] },
          { date, item: '矿产品', value: item['矿产品-同比增长'] },
          { date, item: '煤油电', value: item['煤油电-同比增长'] }
        );
        // 环比增长数据
        momFormattedData.push(
          { date, item: '总指数', value: item['总指数-环比增长'] },
          { date, item: '农产品', value: item['农产品-环比增长'] },
          { date, item: '矿产品', value: item['矿产品-环比增长'] },
          { date, item: '煤油电', value: item['煤油电-环比增长'] }
        );
      });

      setIndexData(indexFormattedData);
      setYoyData(yoyFormattedData);
      setMomData(momFormattedData);
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, { indexData, yoyData, momData });

  const indexConfig = {
    title: {
      title: '价格指数',
      subtitle: '各类商品价格指数变化趋势',
    },
    data: indexData,
    xField: 'date',
    yField: 'value',
    colorField: 'item',
    shapeField: 'smooth',
    axis: {
      x: { title: '月份' },
      y: { title: '指数值' },
    },
    legend: { position: 'top' },
    tooltip: {
      items: [{ field: 'value', name: '指数值', valueFormatter: (value: number) => value?.toFixed(2) }],
    },
  };

  const yoyConfig = {
    title: {
      title: '同比增长率',
      subtitle: '各类商品价格指数同比增长率（%）',
    },
    data: yoyData,
    xField: 'date',
    yField: 'value',
    colorField: 'item',
    shapeField: 'smooth',
    axis: {
      x: { title: '月份' },
      y: { title: '同比增长率（%）' },
    },
    legend: { position: 'top' },
    tooltip: {
      items: [{ field: 'value', name: '同比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }],
    },
  };

  const momConfig = {
    title: {
      title: '环比增长率',
      subtitle: '各类商品价格指数环比增长率（%）',
    },
    data: momData,
    xField: 'date',
    yField: 'value',
    colorField: 'item',
    shapeField: 'smooth',
    axis: {
      x: { title: '月份' },
      y: { title: '环比增长率（%）' },
    },
    legend: { position: 'top' },
    tooltip: {
      items: [{ field: 'value', name: '环比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }],
    },
  };

  return (
    <div>
      <Line {...indexConfig} />
      <Line {...yoyConfig} />
      <Line {...momConfig} />
    </div>
  );
};

// 中国外商直接投资数据（FDI）
const Macro_china_fdi = ({ key }: { key: number }) => {
  const chartName = '外商直接投资';
  const [data, setData] = useSetState({
    monthData: [] as any[],
    monthYoyData: [] as any[],
    monthMomData: [] as any[],
    cumulativeData: [] as any[],
    cumulativeYoyData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_fdi');
      console.log(`${chartName} -> response`, response);

      const monthFormattedData: any[] = [];
      const monthYoyFormattedData: any[] = [];
      const monthMomFormattedData: any[] = [];
      const cumulativeFormattedData: any[] = [];
      const cumulativeYoyFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = item['月份'];
        // 当月实际使用外资
        monthFormattedData.push({ date, value: item['当月'] });
        // 当月同比增长（已经是百分比数值）
        monthYoyFormattedData.push({ date, value: item['当月-同比增长'] });
        // 当月环比增长（已经是百分比数值）
        monthMomFormattedData.push({ date, value: item['当月-环比增长'] });
        // 累计实际使用外资
        cumulativeFormattedData.push({ date, value: item['累计'] });
        // 累计同比增长（已经是百分比数值）
        cumulativeYoyFormattedData.push({ date, value: item['累计-同比增长'] });
      });

      setData({
        monthData: monthFormattedData,
        monthYoyData: monthYoyFormattedData,
        monthMomData: monthMomFormattedData,
        cumulativeData: cumulativeFormattedData,
        cumulativeYoyData: cumulativeYoyFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  // 当月实际使用外资
  const monthConfig = {
    title: { title: '当月实际使用外资', subtitle: '外商直接投资当月金额（万美元）' },
    data: data.monthData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '金额（万美元）' } },
    style: { stroke: '#5B8FF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '金额', valueFormatter: (value: number) => `${value?.toLocaleString()} 万美元` }] },
  };

  // 当月同比增长率
  const monthYoyConfig = {
    title: { title: '当月同比增长率', subtitle: '外商直接投资当月同比增长率（%）' },
    data: data.monthYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长率（%）' } },
    style: { stroke: '#5AD8A6', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 当月环比增长率
  const monthMomConfig = {
    title: { title: '当月环比增长率', subtitle: '外商直接投资当月环比增长率（%）' },
    data: data.monthMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '环比增长率（%）' } },
    style: { stroke: '#F6BD16', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 累计实际使用外资
  const cumulativeConfig = {
    title: { title: '累计实际使用外资', subtitle: '外商直接投资累计金额（万美元）' },
    data: data.cumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '金额（万美元）' } },
    style: { stroke: '#E8684A', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计金额', valueFormatter: (value: number) => `${value?.toLocaleString()} 万美元` }] },
  };

  // 累计同比增长率
  const cumulativeYoyConfig = {
    title: { title: '累计同比增长率', subtitle: '外商直接投资累计同比增长率（%）' },
    data: data.cumulativeYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长率（%）' } },
    style: { stroke: '#6F5EF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计同比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  return (
    <div>
      <Line {...monthConfig} />
      <Line {...monthYoyConfig} />
      <Line {...monthMomConfig} />
      <Line {...cumulativeConfig} />
      <Line {...cumulativeYoyConfig} />
    </div>
  );
};

// 中国工业增加值
const Macro_china_gyzjz = ({ key }: { key: number }) => {
  const chartName = '工业增加值';
  const [data, setData] = useSetState({
    yoyData: [] as any[],
    cumulativeData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_gyzjz');
      console.log(`${chartName} -> response`, response);

      const yoyFormattedData: any[] = [];
      const cumulativeFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = item['月份'];
        // 同比增长（已经是百分比数值）
        yoyFormattedData.push({ date, value: item['同比增长'] });
        // 累计增长（已经是百分比数值）
        cumulativeFormattedData.push({ date, value: item['累计增长'] });
      });

      setData({
        yoyData: yoyFormattedData,
        cumulativeData: cumulativeFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  // 同比增长率
  const yoyConfig = {
    title: { title: '工业增加值同比增长率', subtitle: '工业增加值同比增长率（%）' },
    data: data.yoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长率（%）' } },
    style: { stroke: '#5B8FF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 累计增长率
  const cumulativeConfig = {
    title: { title: '工业增加值累计增长率', subtitle: '工业增加值累计增长率（%）' },
    data: data.cumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '累计增长率（%）' } },
    style: { stroke: '#5AD8A6', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计增长率', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  return (
    <div>
      <Line {...yoyConfig} />
      <Line {...cumulativeConfig} />
    </div>
  );
};

// 中国规模以上工业增加值年率报告
const Macro_china_industrial_production_yoy = ({ key }: { key: number }) => {
  const chartName = '规模以上工业增加值年率';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    forecastData: [] as any[],
    previousData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_industrial_production_yoy');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const forecastFormattedData: any[] = [];
      const previousFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = moment(item['日期']).format('YYYY-MM-DD');
        // 今值
        currentFormattedData.push({ date, value: item['今值'] });
        // 预测值
        forecastFormattedData.push({ date, value: item['预测值'] });
        // 前值
        previousFormattedData.push({ date, value: item['前值'] });
      });

      setData({
        currentData: currentFormattedData,
        forecastData: forecastFormattedData,
        previousData: previousFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  // 合并所有数据用于图表展示
  const allData = [
    ...data.currentData.map((item: any) => ({ ...item, type: '今值' })),
    ...data.forecastData.map((item: any) => ({ ...item, type: '预测值' })),
    ...data.previousData.map((item: any) => ({ ...item, type: '前值' })),
  ];

  const config = {
    title: {
      title: chartName,
      subtitle: '今值、预测值、前值对比（%）',
    },
    data: allData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    shapeField: 'smooth',
    axis: {
      x: { title: '日期' },
      y: { title: '增长率（%）' },
    },
    legend: {
      position: 'top',
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: '增长率',
          valueFormatter: (value: number) => `${value?.toFixed(2)}%`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...config} />
    </div>
  );
};

const Macro_china_pmi_yearly = ({ key }: { key: number }) => {
  const chartName = '官方制造业PMI';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    forecastData: [] as any[],
    previousData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_pmi_yearly');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const forecastFormattedData: any[] = [];
      const previousFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = moment(item['日期']).format('YYYY-MM-DD');
        // 今值
        currentFormattedData.push({ date, value: item['今值'] });
        // 预测值
        forecastFormattedData.push({ date, value: item['预测值'] });
        // 前值
        previousFormattedData.push({ date, value: item['前值'] });
      });

      setData({
        currentData: currentFormattedData,
        forecastData: forecastFormattedData,
        previousData: previousFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  // 合并所有数据用于图表展示
  const allData = [
    ...data.currentData.map((item: any) => ({ ...item, type: '今值' })),
    ...data.forecastData.map((item: any) => ({ ...item, type: '预测值' })),
    ...data.previousData.map((item: any) => ({ ...item, type: '前值' })),
  ];

  const config = {
    title: {
      title: chartName,
      subtitle: '今值、预测值、前值对比',
    },
    data: allData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    shapeField: 'smooth',
    axis: {
      x: { title: '日期' },
      y: { title: 'PMI值' },
    },
    legend: {
      position: 'top',
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: 'PMI值',
          valueFormatter: (value: number) => `${value?.toFixed(2)}`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...config} />
    </div>
  );
};

const Macro_china_non_man_pmi = ({ key }: { key: number }) => {
  const chartName = '官方非制造业PMI';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    forecastData: [] as any[],
    previousData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_non_man_pmi');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const forecastFormattedData: any[] = [];
      const previousFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = moment(item['日期']).format('YYYY-MM-DD');
        currentFormattedData.push({ date, value: item['今值'] });
        forecastFormattedData.push({ date, value: item['预测值'] });
        previousFormattedData.push({ date, value: item['前值'] });
      });

      setData({
        currentData: currentFormattedData,
        forecastData: forecastFormattedData,
        previousData: previousFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const allData = [
    ...data.currentData.map((item: any) => ({ ...item, type: '今值' })),
    ...data.forecastData.map((item: any) => ({ ...item, type: '预测值' })),
    ...data.previousData.map((item: any) => ({ ...item, type: '前值' })),
  ];

  const config = {
    title: {
      title: chartName,
      subtitle: '今值、预测值、前值对比',
    },
    data: allData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    shapeField: 'smooth',
    axis: {
      x: { title: '日期' },
      y: { title: 'PMI值' },
    },
    legend: {
      position: 'top',
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: 'PMI值',
          valueFormatter: (value: number) => `${value?.toFixed(2)}`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...config} />
    </div>
  );
};

const Macro_china_fx_reserves_yearly = ({ key }: { key: number }) => {
  const chartName = '外汇储备';
  const [data, setData] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_fx_reserves_yearly');
      console.log(`${chartName} -> response`, response);

      const formattedData = (response?.data || []).map((item: any) => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['今值'],
      }));

      setData(formattedData);
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const config = {
    title: {
      title: chartName,
      subtitle: '外汇储备（亿美元）',
    },
    data,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: {
      x: { title: '日期' },
      y: { title: '金额（亿美元）' },
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: '外汇储备',
          valueFormatter: (value: number) => `${value?.toLocaleString()} 亿美元`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...config} />
    </div>
  );
};

const Macro_china_m2_yearly = ({ key }: { key: number }) => {
  const chartName = '中国M2货币供应年率';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    forecastData: [] as any[],
    previousData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_m2_yearly');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const forecastFormattedData: any[] = [];
      const previousFormattedData: any[] = [];

      (response?.data || [])?.forEach((item: any) => {
        const date = moment(item['日期']).format('YYYY-MM-DD');
        currentFormattedData.push({ date, value: item['今值'] });
        forecastFormattedData.push({ date, value: item['预测值'] });
        previousFormattedData.push({ date, value: item['前值'] });
      });

      setData({
        currentData: currentFormattedData,
        forecastData: forecastFormattedData,
        previousData: previousFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const allData = [
    ...data.currentData.map((item: any) => ({ ...item, type: '今值' })),
    ...data.forecastData.map((item: any) => ({ ...item, type: '预测值' })),
    ...data.previousData.map((item: any) => ({ ...item, type: '前值' })),
  ];

  const config = {
    title: {
      title: chartName,
      subtitle: '今值、预测值、前值对比（%）',
    },
    data: allData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    shapeField: 'smooth',
    axis: {
      x: { title: '日期' },
      y: { title: '增长率（%）' },
    },
    legend: {
      position: 'top',
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: '增长率',
          valueFormatter: (value: number) => `${value?.toFixed(2)}%`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...config} />
    </div>
  );
};

const Macro_china_enterprise_boom_index = ({ key }: { key: number }) => {
  const chartName = '企业景气及企业家信心指数';
  const [data, setData] = useSetState({
    boomIndexData: [] as any[],
    boomYoyData: [] as any[],
    boomMomData: [] as any[],
    confidenceIndexData: [] as any[],
    confidenceYoyData: [] as any[],
    confidenceMomData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_enterprise_boom_index');
      console.log(`${chartName} -> response`, response);

      const boomIndexFormattedData: any[] = [];
      const boomYoyFormattedData: any[] = [];
      const boomMomFormattedData: any[] = [];
      const confidenceIndexFormattedData: any[] = [];
      const confidenceYoyFormattedData: any[] = [];
      const confidenceMomFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['季度'];
        boomIndexFormattedData.push({ date, value: item['企业景气指数-指数'] });
        boomYoyFormattedData.push({ date, value: item['企业景气指数-同比'] });
        boomMomFormattedData.push({ date, value: item['企业景气指数-环比'] });
        confidenceIndexFormattedData.push({ date, value: item['企业家信心指数-指数'] });
        confidenceYoyFormattedData.push({ date, value: item['企业家信心指数-同比'] });
        confidenceMomFormattedData.push({ date, value: item['企业家信心指数-环比'] });
      });

      setData({
        boomIndexData: boomIndexFormattedData,
        boomYoyData: boomYoyFormattedData,
        boomMomData: boomMomFormattedData,
        confidenceIndexData: confidenceIndexFormattedData,
        confidenceYoyData: confidenceYoyFormattedData,
        confidenceMomData: confidenceMomFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  // 企业景气指数-指数
  const boomIndexConfig = {
    title: { title: '企业景气指数', subtitle: '企业景气指数变化趋势' },
    data: data.boomIndexData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '指数值' } },
    style: { stroke: '#5B8FF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '指数', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  // 企业景气指数-同比
  const boomYoyConfig = {
    title: { title: '企业景气指数同比', subtitle: '企业景气指数同比变化（%）' },
    data: data.boomYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '同比（%）' } },
    style: { stroke: '#5AD8A6', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 企业景气指数-环比
  const boomMomConfig = {
    title: { title: '企业景气指数环比', subtitle: '企业景气指数环比变化（%）' },
    data: data.boomMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '环比（%）' } },
    style: { stroke: '#F6BD16', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 企业家信心指数-指数
  const confidenceIndexConfig = {
    title: { title: '企业家信心指数', subtitle: '企业家信心指数变化趋势' },
    data: data.confidenceIndexData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '指数值' } },
    style: { stroke: '#E8684A', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '指数', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  // 企业家信心指数-同比
  const confidenceYoyConfig = {
    title: { title: '企业家信心指数同比', subtitle: '企业家信心指数同比变化（%）' },
    data: data.confidenceYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '同比（%）' } },
    style: { stroke: '#6DC8EC', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  // 企业家信心指数-环比
  const confidenceMomConfig = {
    title: { title: '企业家信心指数环比', subtitle: '企业家信心指数环比变化（%）' },
    data: data.confidenceMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '季度' }, y: { title: '环比（%）' } },
    style: { stroke: '#9270CA', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  return (
    <div>
      <Line {...boomIndexConfig} />
      <Line {...boomYoyConfig} />
      <Line {...boomMomConfig} />
      <Line {...confidenceIndexConfig} />
      <Line {...confidenceYoyConfig} />
      <Line {...confidenceMomConfig} />
    </div>
  );
};

const Macro_china_new_financial_credit = ({ key }: { key: number }) => {
  const chartName = '新增信贷数据';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    currentYoyData: [] as any[],
    currentMomData: [] as any[],
    cumulativeData: [] as any[],
    cumulativeYoyData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_new_financial_credit');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const currentYoyFormattedData: any[] = [];
      const currentMomFormattedData: any[] = [];
      const cumulativeFormattedData: any[] = [];
      const cumulativeYoyFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['月份'];
        currentFormattedData.push({ date, value: item['当月'] });
        currentYoyFormattedData.push({ date, value: item['当月-同比增长'] });
        currentMomFormattedData.push({ date, value: item['当月-环比增长'] });
        cumulativeFormattedData.push({ date, value: item['累计'] });
        cumulativeYoyFormattedData.push({ date, value: item['累计-同比增长'] });
      });

      setData({
        currentData: currentFormattedData,
        currentYoyData: currentYoyFormattedData,
        currentMomData: currentMomFormattedData,
        cumulativeData: cumulativeFormattedData,
        cumulativeYoyData: cumulativeYoyFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const currentConfig = {
    title: { title: '当月信贷', subtitle: '当月信贷金额（亿元）' },
    data: data.currentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '金额（亿元）' } },
    style: { stroke: '#5B8FF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '金额', valueFormatter: (value: number) => `${value?.toFixed(2)} 亿元` }] },
  };

  const currentYoyConfig = {
    title: { title: '当月同比增长', subtitle: '当月信贷同比增长（%）' },
    data: data.currentYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长（%）' } },
    style: { stroke: '#5AD8A6', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const currentMomConfig = {
    title: { title: '当月环比增长', subtitle: '当月信贷环比增长（%）' },
    data: data.currentMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '环比增长（%）' } },
    style: { stroke: '#F6BD16', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const cumulativeConfig = {
    title: { title: '累计信贷', subtitle: '累计信贷金额（亿元）' },
    data: data.cumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '金额（亿元）' } },
    style: { stroke: '#E8684A', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '金额', valueFormatter: (value: number) => `${value?.toFixed(2)} 亿元` }] },
  };

  const cumulativeYoyConfig = {
    title: { title: '累计同比增长', subtitle: '累计信贷同比增长（%）' },
    data: data.cumulativeYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长（%）' } },
    style: { stroke: '#6DC8EC', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  return (
    <div>
      <Line {...currentConfig} />
      <Line {...currentYoyConfig} />
      <Line {...currentMomConfig} />
      <Line {...cumulativeConfig} />
      <Line {...cumulativeYoyConfig} />
    </div>
  );
};

const Macro_china_cpi = ({ key }: { key: number }) => {
  const chartName = '居民消费价格指数';
  const [data, setData] = useSetState({
    nationalCurrentData: [] as any[],
    nationalYoyData: [] as any[],
    nationalMomData: [] as any[],
    nationalCumulativeData: [] as any[],
    cityCurrentData: [] as any[],
    cityYoyData: [] as any[],
    cityMomData: [] as any[],
    cityCumulativeData: [] as any[],
    ruralCurrentData: [] as any[],
    ruralYoyData: [] as any[],
    ruralMomData: [] as any[],
    ruralCumulativeData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_cpi');
      console.log(`${chartName} -> response`, response);

      const nationalCurrentFormattedData: any[] = [];
      const nationalYoyFormattedData: any[] = [];
      const nationalMomFormattedData: any[] = [];
      const nationalCumulativeFormattedData: any[] = [];
      const cityCurrentFormattedData: any[] = [];
      const cityYoyFormattedData: any[] = [];
      const cityMomFormattedData: any[] = [];
      const cityCumulativeFormattedData: any[] = [];
      const ruralCurrentFormattedData: any[] = [];
      const ruralYoyFormattedData: any[] = [];
      const ruralMomFormattedData: any[] = [];
      const ruralCumulativeFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['月份'];
        nationalCurrentFormattedData.push({ date, value: item['全国-当月'] });
        nationalYoyFormattedData.push({ date, value: item['全国-同比增长'] });
        nationalMomFormattedData.push({ date, value: item['全国-环比增长'] });
        nationalCumulativeFormattedData.push({ date, value: item['全国-累计'] });
        cityCurrentFormattedData.push({ date, value: item['城市-当月'] });
        cityYoyFormattedData.push({ date, value: item['城市-同比增长'] });
        cityMomFormattedData.push({ date, value: item['城市-环比增长'] });
        cityCumulativeFormattedData.push({ date, value: item['城市-累计'] });
        ruralCurrentFormattedData.push({ date, value: item['农村-当月'] });
        ruralYoyFormattedData.push({ date, value: item['农村-同比增长'] });
        ruralMomFormattedData.push({ date, value: item['农村-环比增长'] });
        ruralCumulativeFormattedData.push({ date, value: item['农村-累计'] });
      });

      setData({
        nationalCurrentData: nationalCurrentFormattedData,
        nationalYoyData: nationalYoyFormattedData,
        nationalMomData: nationalMomFormattedData,
        nationalCumulativeData: nationalCumulativeFormattedData,
        cityCurrentData: cityCurrentFormattedData,
        cityYoyData: cityYoyFormattedData,
        cityMomData: cityMomFormattedData,
        cityCumulativeData: cityCumulativeFormattedData,
        ruralCurrentData: ruralCurrentFormattedData,
        ruralYoyData: ruralYoyFormattedData,
        ruralMomData: ruralMomFormattedData,
        ruralCumulativeData: ruralCumulativeFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const nationalCurrentConfig = {
    title: { title: '全国-当月', subtitle: '全国居民消费价格指数当月' },
    data: data.nationalCurrentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '指数值' } },
    style: { stroke: '#5B8FF9', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '指数', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  const nationalYoyConfig = {
    title: { title: '全国-同比增长', subtitle: '全国居民消费价格指数同比增长（%）' },
    data: data.nationalYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长（%）' } },
    style: { stroke: '#5AD8A6', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const nationalMomConfig = {
    title: { title: '全国-环比增长', subtitle: '全国居民消费价格指数环比增长（%）' },
    data: data.nationalMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '环比增长（%）' } },
    style: { stroke: '#F6BD16', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const nationalCumulativeConfig = {
    title: { title: '全国-累计', subtitle: '全国居民消费价格指数累计' },
    data: data.nationalCumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '累计值' } },
    style: { stroke: '#E8684A', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  const cityCurrentConfig = {
    title: { title: '城市-当月', subtitle: '城市居民消费价格指数当月' },
    data: data.cityCurrentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '指数值' } },
    style: { stroke: '#6DC8EC', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '指数', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  const cityYoyConfig = {
    title: { title: '城市-同比增长', subtitle: '城市居民消费价格指数同比增长（%）' },
    data: data.cityYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长（%）' } },
    style: { stroke: '#9270CA', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const cityMomConfig = {
    title: { title: '城市-环比增长', subtitle: '城市居民消费价格指数环比增长（%）' },
    data: data.cityMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '环比增长（%）' } },
    style: { stroke: '#FF6B6B', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const cityCumulativeConfig = {
    title: { title: '城市-累计', subtitle: '城市居民消费价格指数累计' },
    data: data.cityCumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '累计值' } },
    style: { stroke: '#FF7D45', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  const ruralCurrentConfig = {
    title: { title: '农村-当月', subtitle: '农村居民消费价格指数当月' },
    data: data.ruralCurrentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '指数值' } },
    style: { stroke: '#00BFA5', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '指数', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  const ruralYoyConfig = {
    title: { title: '农村-同比增长', subtitle: '农村居民消费价格指数同比增长（%）' },
    data: data.ruralYoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '同比增长（%）' } },
    style: { stroke: '#00D2D3', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '同比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const ruralMomConfig = {
    title: { title: '农村-环比增长', subtitle: '农村居民消费价格指数环比增长（%）' },
    data: data.ruralMomData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '环比增长（%）' } },
    style: { stroke: '#00A8E8', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '环比增长', valueFormatter: (value: number) => `${value?.toFixed(2)}%` }] },
  };

  const ruralCumulativeConfig = {
    title: { title: '农村-累计', subtitle: '农村居民消费价格指数累计' },
    data: data.ruralCumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    axis: { x: { title: '月份' }, y: { title: '累计值' } },
    style: { stroke: '#00C4CC', lineWidth: 2 },
    tooltip: { items: [{ field: 'value', name: '累计', valueFormatter: (value: number) => `${value?.toFixed(2)}` }] },
  };

  return (
    <div>
      <h3 style={{ marginBottom: '24px' }}>全国居民消费价格指数</h3>
      <Line {...nationalCurrentConfig} />
      <Line {...nationalYoyConfig} />
      <Line {...nationalMomConfig} />
      <Line {...nationalCumulativeConfig} />
      <h3 style={{ marginBottom: '24px', marginTop: '48px' }}>城市居民消费价格指数</h3>
      <Line {...cityCurrentConfig} />
      <Line {...cityYoyConfig} />
      <Line {...cityMomConfig} />
      <Line {...cityCumulativeConfig} />
      <h3 style={{ marginBottom: '24px', marginTop: '48px' }}>农村居民消费价格指数</h3>
      <Line {...ruralCurrentConfig} />
      <Line {...ruralYoyConfig} />
      <Line {...ruralMomConfig} />
      <Line {...ruralCumulativeConfig} />
    </div>
  );
};

const Macro_china_ppi = ({ key }: { key: number }) => {
  const chartName = '工业品出厂价格指数';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    yoyData: [] as any[],
    cumulativeData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_ppi');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const yoyFormattedData: any[] = [];
      const cumulativeFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['月份'];
        currentFormattedData.push({ date, value: item['当月'] });
        yoyFormattedData.push({ date, value: item['当月同比增长'] });
        cumulativeFormattedData.push({ date, value: item['累计'] });
      });

      setData({
        currentData: currentFormattedData,
        yoyData: yoyFormattedData,
        cumulativeData: cumulativeFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const currentConfig = {
    title: { title: '当月', subtitle: '工业品出厂价格指数当月' },
    data: data.currentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5B8FF9',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '当月',
          valueFormatter: (v: any) => v?.toFixed(2),
        },
      ],
    },
  };

  const yoyConfig = {
    title: { title: '当月同比增长', subtitle: '工业品出厂价格指数当月同比增长' },
    data: data.yoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5AD8A6',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '当月同比增长',
          valueFormatter: (v: any) => `${v?.toFixed(2)}%`,
        },
      ],
    },
  };

  const cumulativeConfig = {
    title: { title: '累计', subtitle: '工业品出厂价格指数累计' },
    data: data.cumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#F6BD16',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '累计',
          valueFormatter: (v: any) => v?.toFixed(2),
        },
      ],
    },
  };

  return (
    <div>
      <Line {...currentConfig} />
      <Line {...yoyConfig} />
      <Line {...cumulativeConfig} />
    </div>
  );
};

const Macro_china_gdzctz = ({ key }: { key: number }) => {
  const chartName = '中国城镇固定资产投资';
  const [data, setData] = useSetState({
    currentData: [] as any[],
    yoyData: [] as any[],
    momData: [] as any[],
    cumulativeData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_gdzctz');
      console.log(`${chartName} -> response`, response);

      const currentFormattedData: any[] = [];
      const yoyFormattedData: any[] = [];
      const momFormattedData: any[] = [];
      const cumulativeFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['月份'];
        currentFormattedData.push({ date, value: item['当月'] });
        yoyFormattedData.push({ date, value: item['同比增长'] });
        momFormattedData.push({ date, value: item['环比增长'] });
        cumulativeFormattedData.push({ date, value: item['自年初累计'] });
      });

      setData({
        currentData: currentFormattedData,
        yoyData: yoyFormattedData,
        momData: momFormattedData,
        cumulativeData: cumulativeFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const currentConfig = {
    title: { title: '当月', subtitle: '中国城镇固定资产投资当月' },
    data: data.currentData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5B8FF9',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '当月',
          valueFormatter: (v: any) => `${v?.toFixed(2)} 亿元`,
        },
      ],
    },
  };

  const yoyConfig = {
    title: { title: '同比增长', subtitle: '中国城镇固定资产投资同比增长' },
    data: data.yoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5AD8A6',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '同比增长',
          valueFormatter: (v: any) => `${v?.toFixed(2)}%`,
        },
      ],
    },
  };

  const momConfig = {
    title: { title: '环比增长', subtitle: '中国城镇固定资产投资环比增长' },
    data: data.momData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#F6BD16',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '环比增长',
          valueFormatter: (v: any) => `${v?.toFixed(2)}%`,
        },
      ],
    },
  };

  const cumulativeConfig = {
    title: { title: '自年初累计', subtitle: '中国城镇固定资产投资自年初累计' },
    data: data.cumulativeData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#E8684A',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '自年初累计',
          valueFormatter: (v: any) => `${v?.toFixed(2)} 亿元`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...currentConfig} />
      <Line {...yoyConfig} />
      <Line {...momConfig} />
      <Line {...cumulativeConfig} />
    </div>
  );
};

const Macro_china_national_tax_receipts = ({ key }: { key: number }) => {
  const chartName = '全国税收收入';
  const [data, setData] = useSetState({
    totalData: [] as any[],
    yoyData: [] as any[],
    qoqData: [] as any[],
  });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_national_tax_receipts');
      console.log(`${chartName} -> response`, response);

      const totalFormattedData: any[] = [];
      const yoyFormattedData: any[] = [];
      const qoqFormattedData: any[] = [];

      (response?.data || [])?.reverse()?.forEach((item: any) => {
        const date = item['季度'];
        totalFormattedData.push({ date, value: item['税收收入合计'] });
        yoyFormattedData.push({ date, value: item['较上年同期'] });
        qoqFormattedData.push({ date, value: item['季度环比'] });
      });

      setData({
        totalData: totalFormattedData,
        yoyData: yoyFormattedData,
        qoqData: qoqFormattedData,
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [key]);

  console.log(`${chartName} -> data`, data);

  const totalConfig = {
    title: { title: '税收收入合计', subtitle: '全国税收收入合计' },
    data: data.totalData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5B8FF9',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '税收收入合计',
          valueFormatter: (v: any) => `${v?.toFixed(2)} 亿元`,
        },
      ],
    },
  };

  const yoyConfig = {
    title: { title: '较上年同期', subtitle: '全国税收收入较上年同期' },
    data: data.yoyData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#5AD8A6',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '较上年同期',
          valueFormatter: (v: any) => `${v?.toFixed(2)}%`,
        },
      ],
    },
  };

  const qoqConfig = {
    title: { title: '季度环比', subtitle: '全国税收收入季度环比' },
    data: data.qoqData,
    xField: 'date',
    yField: 'value',
    shapeField: 'smooth',
    colorField: '#F6BD16',
    smooth: true,
    tooltip: {
      items: [
        {
          field: 'date',
          name: '日期',
        },
        {
          field: 'value',
          name: '季度环比',
          valueFormatter: (v: any) => `${v?.toFixed(2)}%`,
        },
      ],
    },
  };

  return (
    <div>
      <Line {...totalConfig} />
      <Line {...yoyConfig} />
      <Line {...qoqConfig} />
    </div>
  );
};

const Index = () => {
  const [activeKey, setActiveKey] = useState('33');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0,
    '11': 0, '12': 0, '13': 0, '14': 0, '15': 0, '16': 0, '17': 0, '18': 0, '19': 0, '20': 0,
    '21': 0, '22': 0, '23': 0, '24': 0, '25': 0, '26': 0, '27': 0, '28': 0, '29': 0, '30': 0,
    '31': 0, '32': 0, '33': 0,
  });

  // console.log('refreshKeys, ', refreshKeys)

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>国内生产总值GDP</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '1': prev['1'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_gdp key={refreshKeys['1']} />, [refreshKeys['1']]),
    },
    {
      key: '12',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>官方制造业PMI</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '12': prev['12'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_pmi_yearly key={refreshKeys['12']} />, [refreshKeys['12']]),
    },
    {
      key: '13',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>官方非制造业PMI</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '13': prev['13'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_non_man_pmi key={refreshKeys['13']} />, [refreshKeys['13']]),
    },
    {
      key: '14',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中国M2货币供应年率</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '14': prev['14'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_m2_yearly key={refreshKeys['14']} />, [refreshKeys['14']]),
    },
    {
      key: '15',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>外汇储备</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '15': prev['15'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_fx_reserves_yearly key={refreshKeys['15']} />, [refreshKeys['15']]),
    },
    {
      key: '16',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>企业景气及企业家信心指数</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '16': prev['16'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_enterprise_boom_index key={refreshKeys['16']} />, [refreshKeys['16']]),
    },
    {
      key: '17',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>新增信贷数据</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '17': prev['17'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_new_financial_credit key={refreshKeys['17']} />, [refreshKeys['17']]),
    },
    {
      key: '18',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>居民消费价格指数</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '18': prev['18'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_cpi key={refreshKeys['18']} />, [refreshKeys['18']]),
    },
    {
      key: '19',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>工业品出厂价格指数</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '19': prev['19'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_ppi key={refreshKeys['19']} />, [refreshKeys['19']]),
    },
    {
      key: '20',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中国城镇固定资产投资</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '20': prev['20'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_gdzctz key={refreshKeys['20']} />, [refreshKeys['20']]),
    },
    {
      key: '21',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>全国税收收入</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '21': prev['21'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_national_tax_receipts key={refreshKeys['21']} />, [refreshKeys['21']]),
    },
    {
      key: '2',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>PMI</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '2': prev['2'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Index_pmi_render key={refreshKeys['2']} />, [refreshKeys['2']]),
    },
    {
      key: '3',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中国 PPI 年率报告</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '3': prev['3'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_ppi_yearly key={refreshKeys['3']} />, [refreshKeys['3']]),
    },
    {
      key: '4',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中国 CPI 年率报告</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '4': prev['4'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_cpi_yearly key={refreshKeys['4']} />, [refreshKeys['4']]),
    },
    {
      key: '5',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>LPR品种数据</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '5': prev['5'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_lpr key={refreshKeys['5']} />, [refreshKeys['5']]),
    },
    {
      key: '6',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>城镇调查失业率</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '6': prev['6'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_urban_unemployment key={refreshKeys['6']} />, [refreshKeys['6']]),
    },
    {
      key: '7',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>宏观杠杆率</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '7': prev['7'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_cnbs key={refreshKeys['7']} />, [refreshKeys['7']]),
    },
    {
      key: '8',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>企业商品价格</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '8': prev['8'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_qyspjg key={refreshKeys['8']} />, [refreshKeys['8']]),
    },
    {
      key: '9',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>外商直接投资</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '9': prev['9'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_fdi key={refreshKeys['9']} />, [refreshKeys['9']]),
    },
    {
      key: '10',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>工业增加值</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '10': prev['10'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_gyzjz key={refreshKeys['10']} />, [refreshKeys['10']]),
    },
    {
      key: '11',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>规模以上工业增加值年率</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '11': prev['11'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_industrial_production_yoy key={refreshKeys['11']} />, [refreshKeys['11']]),
    },
    {
      key: '22',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>财政收入</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '22': prev['22'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_czsr key={refreshKeys['22']} />, [refreshKeys['22']]),
    },
    {
      key: '23',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>消费者信心指数</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '23': prev['23'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_xfzxx key={refreshKeys['23']} />, [refreshKeys['23']]),
    },
    {
      key: '24',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>存款准备金率</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '24': prev['24'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_reserve_requirement_ratio key={refreshKeys['24']} />, [refreshKeys['24']]),
    },
    {
      key: '25',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>社会消费品零售总额</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '25': prev['25'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_consumer_goods_retail key={refreshKeys['25']} />, [refreshKeys['25']]),
    },
    {
      key: '26',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>货币供应量</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '26': prev['26'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_supply_of_money key={refreshKeys['26']} />, [refreshKeys['26']]),
    },
    {
      key: '27',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>央行黄金和外汇储备</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '27': prev['27'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_foreign_exchange_gold key={refreshKeys['27']} />, [refreshKeys['27']]),
    },
    {
      key: '28',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>外汇和黄金储备</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '28': prev['28'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_fx_gold key={refreshKeys['28']} />, [refreshKeys['28']]),
    },
    {
      key: '29',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中国货币供应量</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '29': prev['29'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_money_supply key={refreshKeys['29']} />, [refreshKeys['29']]),
    },

    {
      key: '31',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>新增人民币贷款</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '31': prev['31'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_rmb_loan key={refreshKeys['31']} />, [refreshKeys['31']]),
    },
    {
      key: '32',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>人民币存款余额</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '32': prev['32'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_rmb_deposit key={refreshKeys['32']} />, [refreshKeys['32']]),
    },
    {
      key: '33',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>业绩报表</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '33': prev['33'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_yjbb key={refreshKeys['33']} />, [refreshKeys['33']]),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;