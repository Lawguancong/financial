import { Line } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

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

const Index = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [refreshKeys, setRefreshKeys] = useState({
    '1': 0,
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
      children: useMemo(() => <FundAumTrend refreshKey={refreshKeys['1']} />, [refreshKeys['1']]),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} onChange={setActiveKey} />
    </div>
  );
};

export default Index;
