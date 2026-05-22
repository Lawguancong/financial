import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Macro_china_stock_market_cap } from '../macro/components';

const Stock_buffett_index_lg = ({ key }: { key: number }) => {
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
  }, [key]);

  console.log('Stock_buffett_index_lg -> data', data)
  const config = {
    title: {
      title: '巴菲特指标',
      subtitle: `沪深300 与 总市值/GDP `,
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
      subtitle: `总市值 与 GDP`,
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


const Stock_ebs_lg = ({ key }: { key: number }) => {
  const chartName = '股债利差';
  const dateKey = '日期'
  const dateName = '日期'
  const leftKey = '沪深300指数'
  const leftName = '沪深300指数'
  const rightKeys = {
    股债利差: '股债利差',
    股债利差均线: '股债利差均线',
  }
  const sampleRate = 10;
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

const Stock_high_low_statistics = ({ symbol = 'all', label = '全部A股', key }: { symbol?: string, label?: string, key: number }) => {
  const chartName = '创新高和新低的股票数量';
  const dateKey = 'date'
  const dateName = '日期'
  const leftKey = 'close'
  const leftName = label
  const rightKeys = {
    high20: '20日新高',
    low20: '20日新低',
    high60: '60日新高',
    low60: '60日新低',
    high120: '120日新高',
    low120: '120日新低',
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
      const response = await apiClient.get(`/api/public/stock_a_high_low_statistics?symbol=${symbol}`)
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
  }, [symbol, key]);

  console.log(`${chartName} -> data`, data)
  const config = {
    title: {
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
            title: '创新高和新低的股票数量',
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

const Stock_margin_account_info = ({ key }: { key: number }) => {
  const chartName = '两融账户信息';
  const dateKey = '日期'
  const dateName = '日期'
  const leftKey = '中证全指';
  const leftName = '中证全指';
  const rightKeys = {
    沪深300: '沪深300',
    总市值: '总市值(A股+B股+H股)',//A股收盘价*已发行股票总股本（A股+B股+H股）
    GDP: 'GDP(上年)', //上年度国内生产总值（例如：2019年，则取2018年GDP）
    融资余额: '融资余额(亿)',
    融券余额: '融券余额(亿)',
    融资买入额: '融资买入额(亿)',
    融券卖出额: '融券卖出额(亿)',
    // 证券公司数量: '证券公司数量(家)',
    // 营业部数量: '营业部数量(家)',
    个人投资者数量: '个人投资者数量(名)',
    机构投资者数量: '机构投资者数量(家)',
    参与交易的投资者数量: '参与交易的投资者数量(名)',
    有融资融券负债的投资者数量: '有融资融券负债的投资者数量(名)',
    ['参与交易的投资者数量/个人投资者数量']: '参与交易的投资者数量/个人投资者数量(%)',
    ['有融资融券负债的投资者数量/个人投资者数量']: '有融资融券负债的投资者数量/个人投资者数量(%)',
    担保物总价值: '担保物总价值(亿)',
    平均维持担保比例: '平均维持担保比例(%)',
    ['两融余额/总市值']: '两融余额/总市值(%)',
    ['两融余额/GDP']: '两融余额/GDP(%)',
    ['融资余额/总市值']: '融资余额/总市值(%)',
    ['融券余额/总市值']: '融券余额/总市值(%)',
    ['融资买入额/总市值']: '融资买入额/总市值(%)',
    ['融券卖出额/总市值']: '融券卖出额/总市值(%)',
    ['融资余额/GDP']: '融资余额/GDP(%)',
    ['融券余额/GDP']: '融券余额/GDP(%)',
    ['融资买入额/GDP']: '融资买入额/GDP(%)',
    ['融券卖出额/GDP']: '融券卖出额/GDP(%)',
    // todo 流通市值
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
      console.log(`${chartName} -> response`)
      const [marginRes, buffettRes, csindexRes] = await Promise.all([
        apiClient.get('/api/public/stock_margin_account_info'),
        apiClient.get('/api/public/stock_buffett_index_lg'),
        apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=000985&start_date=20050101&end_date=${moment().format('YYYYMMDD')}`)
      ])

      console.log(`1111111 两融数据，巴菲特指标数据`, marginRes.data, buffettRes.data)
      console.log(`1111111 中证全指`, csindexRes.data)

      // 构建 buffettDataMap，同时格式化日期
      const buffettDataMap = new Map();
      (buffettRes.data || []).forEach(item => {
        const formattedDate = moment(item.日期).format('YYYY-MM-DD')
        buffettDataMap.set(formattedDate, { ...item, 日期: formattedDate })
      })

      // 合并 marginData 和 buffettData，同时格式化 margin 日期
      const mergedMarginBuffettData = [];
      (marginRes.data || []).forEach(item => {
        const formattedDate = moment(item.日期).format('YYYY-MM-DD')
        const buffettItem = buffettDataMap.get(formattedDate);
        if (buffettItem) {
          const marginItem = { ...item, 日期: formattedDate };
          mergedMarginBuffettData.push({
            ...buffettItem,
            ...marginItem,
            ['沪深300']: buffettItem['收盘价'] || null,
            ['个人投资者数量']: Number((marginItem['个人投资者数量'] * 10000).toFixed(2)) || null,
            ['参与交易的投资者数量/个人投资者数量']: Number((marginItem['参与交易的投资者数量'] / marginItem['个人投资者数量'] / 100).toFixed(2)) || null,
            ['有融资融券负债的投资者数量/个人投资者数量']: Number((marginItem['有融资融券负债的投资者数量'] / marginItem['个人投资者数量'] / 100).toFixed(2)) || null,
            ['两融余额/总市值']: Number(((marginItem['融资余额'] + marginItem['融券余额']) / buffettItem['总市值'] * 100).toFixed(2)) || null,
            ['融资余额/总市值']: Number((marginItem['融资余额'] / buffettItem['总市值'] * 100).toFixed(2)) || null,
            ['融券余额/总市值']: Number((marginItem['融券余额'] / buffettItem['总市值'] * 100).toFixed(2)) || null,
            ['融资买入额/总市值']: Number((marginItem['融资买入额'] / buffettItem['总市值'] * 100).toFixed(2)) || null,
            ['融券卖出额/总市值']: Number((marginItem['融券卖出额'] / buffettItem['总市值'] * 100).toFixed(2)) || null,
            ['两融余额/GDP']: Number(((marginItem['融资余额'] + marginItem['融券余额']) / buffettItem['GDP'] * 100).toFixed(2)) || null,
            ['融资余额/GDP']: Number((marginItem['融资余额'] / buffettItem['GDP'] * 100).toFixed(2)) || null,
            ['融券余额/GDP']: Number((marginItem['融券余额'] / buffettItem['GDP'] * 100).toFixed(2)) || null,
            ['融资买入额/GDP']: Number((marginItem['融资买入额'] / buffettItem['GDP'] * 100).toFixed(2)) || null,
            ['融券卖出额/GDP']: Number((marginItem['融券卖出额'] / buffettItem['GDP'] * 100).toFixed(2)) || null,
          });
        }
      });
      console.log(`1111111 mergedMarginBuffettData`, mergedMarginBuffettData);

      // 构建 csindexDataMap
      const csindexDataMap = new Map();
      (csindexRes.data || []).forEach(item => {
        const formattedDate = moment(item.日期).format('YYYY-MM-DD')
        csindexDataMap.set(formattedDate, item)
      });

      // 合并 mergedMarginBuffettData 和 csindexData
      const finalMergedData = [];
      mergedMarginBuffettData.forEach(mergedItem => {
        const csindexItem = csindexDataMap.get(mergedItem.日期);
        if (csindexItem) {
          finalMergedData.push({
            ...mergedItem,
            ['中证全指']: csindexItem['收盘'] || null,
          })
        }
      })
      console.log(`1111111 中证全指 finalMergedData`, finalMergedData);
      const dataFormat = finalMergedData?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
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


const Stock_a_congestion_lg = ({ key }: { key: number }) => {
  const chartName = '大盘拥挤度';
  const dateKey = 'date'
  const dateName = '日期'
  const leftKey = 'close'
  const leftName = '上证指数'
  const rightKeys = {
    congestion: '拥挤度',
  }
  const sampleRate = 10;
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
    <h5>大盘拥挤度:衡量市场微观结构恶化的指标，即成交额排名前5%的个股的成交额占全部A股占比创下历史极值，接近50%，预示着结构恶化，市场行情进入预警区域，或见顶，或风格发生转换。截止到2022年11月，历史上类似的情形出现过5次，市场均发生了巨大的反转，有2次市场进入牛市或维持牛市之中，且市场均发生了风格切换，分别是2008年10月和2015年1月。另三次发生了"牛转熊"现象。</h5>
  </>
};



const Index: React.FC = () => {
  const [activeKey, setActiveKey] = useState('4');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7': 0,
  });

  console.log('refreshKeys, ', refreshKeys)

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>巴菲特指标</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '1': prev['1'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_buffett_index_lg key={refreshKeys['1']} />, [refreshKeys['1']]),
    },
    {
      key: '2',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>股债利差</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '2': prev['2'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_ebs_lg key={refreshKeys['2']} />, [refreshKeys['2']]),
    },
    {
      key: '3',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>创新高和新低的股票数量</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '3': prev['3'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => {
        const symbolMap = {
          "all": "全部A股",
          "sz50": "上证50",
          "hs300": "沪深300",
          "zz500": "中证500"
        };
        return Object.entries(symbolMap).map(([symbol, label]) => (
          <div key={symbol} style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>{label}创新高和新低的股票数量</h3>
            <div><span>获取近两年的历史数据</span></div>
            <Stock_high_low_statistics symbol={symbol} label={label} key={refreshKeys['3']} />
          </div>
        ));
      }, [refreshKeys['3']]),
    },
    {
      key: '4',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>两融账户信息</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '4': prev['4'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_margin_account_info key={refreshKeys['4']} />, [refreshKeys['4']]),
    },
    {
      key: '5',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>大盘拥挤度</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '5': prev['5'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_a_congestion_lg key={refreshKeys['5']} />, [refreshKeys['5']]),
    },
    {
      key: '6',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>全国股票交易统计表</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '6': prev['6'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_stock_market_cap key={refreshKeys['6']} />, [refreshKeys['6']]),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;