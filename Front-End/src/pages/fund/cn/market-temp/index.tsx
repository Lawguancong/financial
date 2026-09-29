import { Line } from '@ant-design/plots';
import { DualAxes } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { pick } from 'lodash-es';

interface FundAumData {
  date: string;
  value: number;
}

// 公募基金规模趋势
const FundAumTrend = ({ refreshKey }: { refreshKey: number }) => {
  const [data, setData] = useState<FundAumData[]>([]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/fund_aum_trend_em');
      console.log('基金规模趋势 -> response', response);
      
      const formattedData = (response?.data || []).map((item: FundAumData) => ({
        ...item,
        date: moment(item.date).format('YYYY-MM-DD'),
      }));
      
      setData(formattedData);
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  console.log('FundAumTrend -> data', data);

  const config = {
    title: {
      title: '公募基金规模趋势',
      subtitle: '公募基金市场总规模变化趋势',
    },
    data,
    xField: (d: FundAumData) => new Date(d.date),
    yField: 'value',
    legend: true,
    smooth: true,
    axis: {
      x: {
        title: '日期',
      },
      y: {
        title: '规模（亿元）',
      },
    },
    tooltip: {
      items: [
        {
          field: 'value',
          name: '基金规模',
          valueFormatter: (value: number) => `${value.toFixed(2)} 亿元`,
        },
      ],
    },
    style: {
      stroke: '#5B8FF9',
      lineWidth: 2,
    },
    area: {
      style: {
        fill: 'linear-gradient(-90deg, white 0%, #5B8FF9 100%)',
      },
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <Line {...config} />
    </div>
  );
};

// 基金规模走势
const FundAumTrendEm = ({ refreshKey }: { refreshKey: number }) => {
  const chartName = '基金规模走势'; // 图表名称
  const dateKey = 'date'; // 日期键名
  const dateName = '日期'; // 日期键名
  const leftKey = 'value'; // 左y轴键名
  const leftName = '元'; // 左y轴名称
  const rightKeys = { // 右y轴键名: 右y轴名称
    // congestion: '拥挤度',
  };
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
  };
  const [data, setData] = useState<{
    leftData: any[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/fund_aum_trend_em');
      console.log(`${chartName} -> response`, response);
      const dataFormat = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof DataRes],
      }))).flat();
      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey) || [],
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || []
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  console.log(`${chartName} -> data`, data);
  const config = {
    title: {
      title: chartName,
      subtitle: `${leftName} 与 ${chartName}`,
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

  return (
    <div style={{ padding: '24px' }}>
      <DualAxes {...config} />
    </div>
  );
};

const Index = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0,
    '2': 0,
  });

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>公募基金规模趋势</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '1': prev['1'] + 1 }))}
          />
        </div>
      ),
      children: <FundAumTrend refreshKey={refreshKeys['1']} />,
    },
    {
      key: '2',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>基金规模走势</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKeys(prev => ({ ...prev, '2': prev['2'] + 1 }))}
          />
        </div>
      ),
      children: <FundAumTrendEm refreshKey={refreshKeys['2']} />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;