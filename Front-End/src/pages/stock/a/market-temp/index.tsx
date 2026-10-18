import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import { createRoot } from 'react-dom/client';
import { format } from 'fecha';
import moment from 'moment';
import { useSetState } from 'ahooks';
import { pick } from 'lodash-es';
import { Tabs, Button, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Macro_china_stock_market_cap } from '../macro/components';
import StockBelowNetAssetLg from './StockBelowNetAssetLg';
import IndexComparisonChart, { type IndexComparisonChartProps, type NormalizedPoint } from '@/components/IndexComparisonChart';
import { filterByFrequency } from '@/utils/stockUtils';

type CsindexRow = { 日期: string; 收盘: number };
type SinaIndexRow = { date: string; close: number };
type BondRateRow = { 日期: string; 中国国债收益率10年?: number | null; 中国国债收益率30年?: number | null };

/** 国债利率倒数（倍）= 100 ÷ 国债收益率(%)，即「债券的隐含市盈率」，与指数滚动市盈率同口径可比 */
const toInverse = (rate?: number | null) => (typeof rate === 'number' && rate > 0 ? Number((100 / rate).toFixed(2)) : null);

/** 中证源指数历史：调接口并按 {date, close} 归一化（未采样，月度采样由通用组件完成） */
const fetchCsindexHist = async (symbol: string, startDate: string): Promise<NormalizedPoint[]> => {
  const endDate = moment().format('YYYYMMDD');
  const res = await apiClient.get(
    `/api/public/stock_zh_index_hist_csindex?symbol=${symbol}&start_date=${startDate}&end_date=${endDate}`,
  );
  const list = (res?.data as CsindexRow[] | undefined) ?? [];
  return list.map((item) => ({ date: item['日期'], close: Number(item['收盘']) }));
};

/** 新浪源指数日线：调接口并按 {date, close} 归一化（未采样，月度采样由通用组件完成） */
const fetchSinaIndexDaily = async (symbol: string): Promise<NormalizedPoint[]> => {
  const res = await apiClient.get(`/api/public/stock_zh_index_daily?symbol=${symbol}`);
  const list = (res?.data as SinaIndexRow[] | undefined) ?? [];
  return list.map((item) => ({ date: item.date, close: Number(item.close) }));
};

/** 双指数比值对比：沪深300(000300) vs 债券基金(H11023)，自 2004-11 起对齐 */
const HS300_VS_BOND_CONFIG: IndexComparisonChartProps = {
  chartName: '沪深300 vs 债券基金',
  subtitle: '沪深300(000300) 与 债券基金(H11023) ',
  left: { name: '沪深300指数', color: '#d62728', axisTitleColor: '#6c6868ff', fetch: () => fetchCsindexHist('000300', '20041101') },
  right: { name: '债券基金指数', color: '#5AD8A6', fetch: () => fetchCsindexHist('H11023', '20041101') },
  ratioAxisTitle: '沪深300/债券基金',
  ratioLegend: '沪深300/债券基金(比值)',
  ratioColor: '#2516faff',
  ratioDomain: [0, 6],
  note: (
    <>沪深300 与 债券基金(H11023) 起始基点不同。为拟合两者起始数值更接近，数据统一从<strong> 2004-11</strong>开始，使两曲线起点对齐、比值起点≈1，更具可比性。</>
  ),
};

/** 双指数比值对比：中证全指(000985) vs 债券基金(H11023)，自 2005-02 起对齐 */
const CSI_ALL_VS_BOND_CONFIG: IndexComparisonChartProps = {
  chartName: '中证全指 vs 债券基金',
  subtitle: '中证全指(000985) 与 债券基金(H11023)',
  left: { name: '中证全指指数', color: '#722ed1', axisTitleColor: '#6c6868ff', fetch: () => fetchCsindexHist('000985', '20050201') },
  right: { name: '债券基金指数', color: '#5AD8A6', fetch: () => fetchCsindexHist('H11023', '20050201') },
  ratioAxisTitle: '中证全指/债券基金',
  ratioLegend: '中证全指/债券基金(比值)',
  ratioColor: '#fa8c16',
  ratioDomain: [0, 6],
  note: (
    <>中证全指(000985) 与 债券基金(H11023) 从 <strong>2005-02-01</strong> 开始，两曲线比值起点≈1，更具可比性。</>
  ),
};

/** 双指数比值对比：创业板(sz399006, 新浪源) vs 中证红利(000922, 中证源)，均自 2010-06 起 */
const CYB_VS_DIVIDEND_CONFIG: IndexComparisonChartProps = {
  chartName: '创业板 vs 中证红利',
  subtitle: '创业板(sz399006) 与 中证红利(000922)',
  left: { name: '创业板指数', color: '#1890ff', axisTitleColor: '#6c6868ff', fetch: () => fetchSinaIndexDaily('sz399006') },
  right: { name: '中证红利指数', color: '#cf1322', fetch: () => fetchCsindexHist('000922', '20100601') },
  ratioAxisTitle: '创业板/中证红利',
  ratioLegend: '创业板/中证红利(比值)',
  ratioColor: '#722ed1',
  ratioDomain: [0, 1],
  note: (
    <>
      创业板(sz399006) 与 中证红利(000922) 均自 <strong>2010-06</strong> 起，按同一交易日对齐。
      两者起始基点不同，起点比值≈0.37（创业板点位低于中证红利），比值非从 1 起步；比值&lt;1 表示创业板点位低于中证红利。
    </>
  ),
};

/** 双指数比值对比：300成长(000918) vs 300价值(000919)，均自 2004-12-31 起（比值≈1 附近自适应，右轴不固定区间） */
const GROWTH_VS_VALUE_CONFIG: IndexComparisonChartProps = {
  chartName: '300成长 vs 300价值',
  subtitle: '300成长(000918) 与 300价值(000919)',
  left: { name: '300成长', color: '#1890ff', axisTitleColor: '#6c6868ff', fetch: () => fetchCsindexHist('000918', '20041231') },
  right: { name: '300价值', color: '#cf1322', fetch: () => fetchCsindexHist('000919', '20041231') },
  ratioAxisTitle: '300成长/300价值',
  ratioLegend: '300成长/300价值(比值)',
  ratioColor: '#722ed1',
  note: (
    <>
      300成长(000918) 与 300价值(000919) 从 <strong>2004-12-31</strong> 开始，
      按同一交易日对齐。两者起始基点均为 1000 点，起点比值≈1，更具可比性；比值&gt;1 表示 300成长点位高于 300价值。
    </>
  ),
};

/** 中证全指-滚动市盈率（复制自 /stock/a/valuation 的 Stock_zh_index_hist_csindex） */
const Stock_zh_index_hist_csindex = () => {
  const chartName = '中证全指-滚动市盈率'; // 图表名称
  const bondChartName = '10年/30年期国债利率倒数&滚动市盈率走势'; // 国债利率倒数对比图名称
  const startDate = '20050101'; // 起始日：与中证全指数据起始日保持一致
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '收盘' // 左y轴键名
  const leftName = '中证全指' // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    滚动市盈率: '滚动市盈率',
  }
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
    leftData: { date: string; key: string; label: string; value: number }[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  // 国债收益率按月取样：key = YYYY-MM，value = 该月最后一条 10 年/30 年收益率(%)
  const [bondMonthly, setBondMonthly] = useState<Record<string, { ten?: number | null; thirty?: number | null }>>({});
  const fetchData = async () => {
    try {
      // 入参
      // symbol	str	symbol = "000928"; 指数代码
      // start_date	str	start_date = "20180526"
      // end_date	str	end_date = "20240604"
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=000985&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`)
      console.log(`${chartName} -> response`, response)
      const dataFormat = filterByFrequency(response?.data as DataRes[], dateKey, 'monthly')?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes] as number,
      }))).flat()
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey)
      })
    } catch (error) {
      console.log('error', error)
    }
    // 国债收益率：按月取样（每月取最后一条），供「国债利率倒数 vs 滚动市盈率」图与中证全指按月对齐
    try {
      const bondRes = await apiClient.get(`/api/public/bond_zh_us_rate?start_date=${startDate}`)
      console.log(`${bondChartName} -> response`, bondRes)
      const map: Record<string, { ten?: number | null; thirty?: number | null }> = {}
        ; (bondRes?.data as BondRateRow[] | undefined)?.forEach((item) => {
          const month = item['日期']?.slice(0, 7)
          if (!month) return
          map[month] = { ten: item['中国国债收益率10年'], thirty: item['中国国债收益率30年'] }
        })
      setBondMonthly(map)
    } catch (error) {
      console.log('error', error)
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 按「中证全指」月末日期对齐：左轴滚动市盈率 + 右轴 10 年/30 年国债利率倒数
  const bondChartData = useMemo(() => {
    const peData: { date: string; value: number; label: string }[] = []
    const inverseData: { date: string; value: number; label: string }[] = []
    data.rightData.forEach((item) => {
      const bond = bondMonthly[item.date.slice(0, 7)]
      if (!bond) return
      peData.push({ date: item.date, value: item.value, label: '滚动市盈率' })
      const ten = toInverse(bond.ten)
      const thirty = toInverse(bond.thirty)
      if (ten !== null) inverseData.push({ date: item.date, value: ten, label: '十年国债利率倒数' })
      if (thirty !== null) inverseData.push({ date: item.date, value: thirty, label: '三十年国债利率倒数' })
    })
    return { peData, inverseData }
  }, [data.rightData, bondMonthly]);

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

  // 十年&三十年期国债利率倒数 vs 中证全指滚动市盈率：左轴 PE、右轴国债利率倒数（与股票 PE 同口径）
  const bondConfig = {
    title: {
      title: bondChartName,
    },
    xField: (d: { date: string }) => new Date(d.date),
    legend: true,
    scale: {
      color: {
        domain: ['滚动市盈率', '十年国债利率倒数', '三十年国债利率倒数'],
        range: ['#d62728', '#1890ff', '#722ed1'],
      },
    },
    children: [
      {
        data: bondChartData.peData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: { lineWidth: 2 },
        axis: {
          y: {
            title: '滚动市盈率',
            style: { titleFill: '#d62728' },
          },
        },
      },
      {
        data: bondChartData.inverseData,
        type: 'line',
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth',
        style: { lineWidth: 2 },
        axis: {
          y: {
            position: 'right',
            title: '国债利率倒数（倍）',
            style: { titleFill: '#1890ff' },
          },
        },
      },
    ],
  };

  return <>
    <DualAxes {...config} />
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.8, marginBottom: 4 }}>
        说明：国债利率倒数（倍）= 100 ÷ 国债收益率(%)，即「债券的隐含市盈率」；左轴为中证全指滚动市盈率，
        当 PE 低于右轴倒数线时，代表股票相对债券更便宜。数据自中证全指起始日（2005-01）起按月取样。
      </div>
      <DualAxes {...bondConfig} />
    </div>
  </>
};

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
      const finalMergedData: DataRes[] = [];
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
      // 按月分组，仅保留每月最晚一条记录（三源已按当日对齐，所有字段/比率同取该日值）
      const monthlyDataMap = new Map<string, DataRes>();
      finalMergedData.forEach((item) => {
        const monthKey = String(item[dateKey]).slice(0, 7);
        const existed = monthlyDataMap.get(monthKey);
        if (!existed || String(existed[dateKey]) < String(item[dateKey])) {
          monthlyDataMap.set(monthKey, item);
        }
      });
      const monthlyData = [...monthlyDataMap.values()].sort((a, b) =>
        String(a[dateKey]).localeCompare(String(b[dateKey]))
      );
      console.log(`1111111 按月取最晚 monthlyData`, monthlyData);
      const dataFormat = monthlyData?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
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
  /** 拥挤度分位阈值（可配置），用于高亮展示历史分位水平 */
  const CONGESTION_PERCENTILE = 99;
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
  const [rawData, setRawData] = useState<DataRes[]>([]);
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/stock_a_congestion_lg')
      console.log(`${chartName} -> response`, response)
      const raw: DataRes[] = response?.data || [];
      setRawData(raw);
      const dataFormat = raw.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
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

  /** 计算拥挤度指定百分位值 */
  const calculatePercentile = (values: number[], percentile: number): number | null => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const percentileValue = useMemo(() => {
    const values = rawData.map((item: DataRes) => item.congestion).filter(v => typeof v === 'number' && !isNaN(v));
    return calculatePercentile(values, CONGESTION_PERCENTILE);
  }, [rawData]);

  const latestCongestion = useMemo(() => {
    if (!rawData.length) return null;
    return rawData[rawData.length - 1].congestion;
  }, [rawData]);

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
    <h5>大盘拥挤度:衡量市场微观结构恶化的指标，即成交额排名前5%的个股的成交额占全部A股占比创下历史极值，接近50%，预示着结构恶化，市场行情进入预警区域，或见顶，或风格发生转换。截止到2022年11月，历史上类似的情形出现过5次，市场均发生了巨大的反转，有2次市场进入牛市或维持牛市之中，且市场均发生了风格切换，分别是2008年10月和2015年1月。另三次发生了"牛转熊"现象。</h5>
    <div
      style={{
        marginTop: 16,
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #fffbe6 0%, #ffe58f 100%)',
        borderRadius: 12,
        border: '1px solid #ffd666',
        boxShadow: '0 4px 16px rgba(250, 173, 20, 0.2)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.3)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -30,
          left: 30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#ad6800', letterSpacing: 0.5 }}>
            历史 {CONGESTION_PERCENTILE}% 分位值
          </span>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#d46b08', lineHeight: 1.2 }}>
            {percentileValue !== null ? percentileValue.toFixed(4) : '--'}
          </span>
        </div>
        <div
          style={{
            width: 1,
            height: 40,
            background: 'rgba(212, 107, 8, 0.2)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#ad6800', letterSpacing: 0.5 }}>
              当前拥挤度
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.2,
                color: latestCongestion !== null && percentileValue !== null && latestCongestion >= percentileValue
                  ? '#cf1322'
                  : '#389e0d',
                textShadow: latestCongestion !== null && percentileValue !== null && latestCongestion >= percentileValue
                  ? '0 0 20px rgba(207, 19, 34, 0.3)'
                  : '0 0 20px rgba(82, 196, 26, 0.25)',
              }}
            >
              {latestCongestion !== null ? latestCongestion.toFixed(4) : '--'}
            </span>
          </div>
          {latestCongestion !== null && percentileValue !== null && (
            <Tag
              color={latestCongestion >= percentileValue ? 'red' : 'green'}
              style={{
                margin: 0,
                fontSize: 13,
                padding: '2px 10px',
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              {latestCongestion >= percentileValue
                ? `⚠ 高于 ${CONGESTION_PERCENTILE} 分位 · 警惕顶部风险`
                : `✓ 低于 ${CONGESTION_PERCENTILE} 分位 · 结构尚健康`}
            </Tag>
          )}
        </div>
      </div>
    </div>
    <DualAxes {...config} />

  </>;
};


const Index: React.FC = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7': 0,
    '8': 0,
    '9': 0,
    '10': 0,
    '11': 0,
    '12': 0,
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
      key: '9',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>沪深300 vs 债券基金</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '9': prev['9'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <IndexComparisonChart key={refreshKeys['9']} {...HS300_VS_BOND_CONFIG} />, [refreshKeys['9']]),
    },
    {
      key: '10',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>中证全指 vs 债券基金</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '10': prev['10'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <IndexComparisonChart key={refreshKeys['10']} {...CSI_ALL_VS_BOND_CONFIG} />, [refreshKeys['10']]),
    },

    {
      key: '11',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>创业板 vs 中证红利</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '11': prev['11'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <IndexComparisonChart key={refreshKeys['11']} {...CYB_VS_DIVIDEND_CONFIG} />, [refreshKeys['11']]),
    },
    {
      key: '8',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>300成长 vs 300价值</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '8': prev['8'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <IndexComparisonChart key={refreshKeys['8']} {...GROWTH_VS_VALUE_CONFIG} />, [refreshKeys['8']]),
    },
    {
      key: '5',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>大盘拥挤度(逃顶策略)</span>
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
          <span>沪深活跃度（逃顶策略）</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '6': prev['6'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Macro_china_stock_market_cap key={refreshKeys['6']} />, [refreshKeys['6']]),
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
      key: '12',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>国债倒数&滚动PE走势</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '12': prev['12'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <Stock_zh_index_hist_csindex key={refreshKeys['12']} />, [refreshKeys['12']]),
    },
    {
      key: '7',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>破净股统计</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '7': prev['7'] + 1 }))}
          />
        </div>
      ),
      children: useMemo(() => <StockBelowNetAssetLg key={refreshKeys['7']} />, [refreshKeys['7']]),
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



  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;