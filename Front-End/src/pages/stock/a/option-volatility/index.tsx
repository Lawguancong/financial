import React, { useState, useMemo } from 'react';
import { Tabs, Button, Card, Spin, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import moment from 'moment';

const { TabPane } = Tabs;

interface OptionVolatilityData {
  date: string;
  value: number;
}
  const sampleRate = 1;

const OptionVolatilityChart = ({ apiName, key }: { apiName: string, key: number }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<OptionVolatilityData[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/public/${apiName}`);
      // 处理数据格式
      const formattedData: OptionVolatilityData[] = response?.data?.filter((_, index: number) => index % sampleRate === 0)?.map((item: any) => ({
        date: moment(item.date || item.trade_date || item.datetime).format('YYYY-MM-DD'),
        value: parseFloat(item.value || item.qvix || item.close) || 0,
      })).filter((item: OptionVolatilityData) => item.date && item.value > 0);
      
      setData(formattedData || []);
    } catch (error) {
      message.error('获取数据失败');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [apiName, key]);

  const config = {
    data,
    xField: 'date',
    yField: 'value',
    smooth: true,
    lineStyle: {
      stroke: '#8884d8',
      lineWidth: 1,
    },
    // point: {
    //   size: 4,
    //   shape: 'circle',
    //   style: {
    //     fill: '#8884d8',
    //   },
    // },
    // tooltip: {
    //   formatter: (datum: any) => {
    //     return {
    //       name: '波动率指数',
    //       value: datum.value,
    //     };
    //   },
    // },
    // grid: {
    //   line: {
    //     style: {
    //       stroke: '#f0f0f0',
    //     },
    //   },
    // },
  };

  return (
    <Spin spinning={loading} tip="加载中...">
      <div style={{ height: '400px' }}>
        <Line {...config} />
      </div>
    </Spin>
  );
};

const OptionVolatility: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string>('50etf');
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({
    '50etf': 0,
    '300etf': 0,
    '500etf': 0,
    'cyb': 0,
    'kcb': 0,
    '100etf': 0,
    '300index': 0,
    '1000index': 0,
    '50index': 0,
  });

  const apiMap: Record<string, string> = {
    '50etf': 'index_option_50etf_qvix',
    '300etf': 'index_option_300etf_qvix',
    '500etf': 'index_option_500etf_qvix',
    'cyb': 'index_option_cyb_qvix',
    'kcb': 'index_option_kcb_qvix',
    '100etf': 'index_option_100etf_qvix',
    '300index': 'index_option_300index_qvix',
    '1000index': 'index_option_1000index_qvix',
    '50index': 'index_option_50index_qvix',
  };

  const tabConfig = [
    { key: '50etf', label: '50ETF 期权波动率指数' },
    { key: '300etf', label: '300ETF 期权波动率指数' },
    { key: '500etf', label: '500ETF 期权波动率指数' },
    { key: 'cyb', label: '创业板 期权波动率指数' },
    { key: 'kcb', label: '科创板 期权波动率指数' },
    { key: '100etf', label: '深证100ETF 期权波动率指数' },
    { key: '300index', label: '中证300股指 期权波动率指数' },
    { key: '1000index', label: '中证1000股指 期权波动率指数' },
    { key: '50index', label: '上证50股指 期权波动率指数' },
  ];

  const items = tabConfig.map(tab => ({
    key: tab.key,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{tab.label}</span>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={() => setRefreshKeys(prev => ({ ...prev, [tab.key]: prev[tab.key] + 1 }))}
        />
      </div>
    ),
    children: useMemo(() => (
      <OptionVolatilityChart 
        apiName={apiMap[tab.key]} 
        key={refreshKeys[tab.key]} 
      />
    ), [refreshKeys[tab.key], apiMap[tab.key]]),
  }));

  return (
    <div style={{ padding: '24px' }}>
      <Card title="期权波动率指数">
        <Tabs 
          activeKey={activeKey} 
          items={items}
          onChange={setActiveKey}
        />
      </Card>
    </div>
  );
};

export default OptionVolatility;