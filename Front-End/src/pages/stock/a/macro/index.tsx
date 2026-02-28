import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { pick } from 'lodash-es';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';



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
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;