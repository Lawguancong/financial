import React, { useState, useEffect } from 'react';
import { Card, Tabs, Spin } from 'antd';
import { DualAxes } from '@ant-design/plots';
import apiClient from '@/utils/axios';

interface PositionData {
  date: string;
  close: number;
  position: number;
}

type PositionType = 'stock' | 'balance' | 'linghuo';

const positionConfig: Record<PositionType, { label: string; api: string }> = {
  stock: {
    label: '股票型基金仓位',
    api: 'fund_stock_position_lg',
  },
  balance: {
    label: '平衡混合型基金仓位',
    api: 'fund_balance_position_lg',
  },
  linghuo: {
    label: '灵活配置型基金仓位',
    api: 'fund_linghuo_position_lg',
  },
};

const FundPosition: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PositionType>('stock');
  const [data, setData] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (type: PositionType) => {
    setLoading(true);
    try {
      const result = await apiClient.get(`/api/public/${positionConfig[type].api}`);
      if (result && result.data) {
        const formattedData: PositionData[] = result.data.map((item: any) => ({
          date: item.date,
          close: parseFloat(item.close),
          position: parseFloat(item.position),
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取基金仓位数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const closeData = data.map(item => ({
    date: item.date,
    value: item.close,
    type: '沪深300收盘价',
  }));

  const positionData = data.map(item => ({
    date: item.date,
    value: item.position,
    type: '持仓比例',
  }));

  const config = {
    // xField: 'date',
    xField: (d) => new Date(d.date),
    // xAxis: {
    //   label: {
    //     formatter: (v: string) => {
    //       const date = new Date(v);
    //       return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    //     },
    //     autoRotate: true,
    //   },
    // },
    leftField: 'value',
    rightField: 'value',
    leftAxis: {
      title: {
        text: '沪深300收盘价',
        style: {
          fill: '#1890ff',
        },
      },
      label: {
        formatter: (v: number) => `${v}`,
      },
    },
    rightAxis: {
      title: {
        text: '持仓比例(%)',
        style: {
          fill: '#52c41a',
        },
      },
      label: {
        formatter: (v: number) => `${v}%`,
      },
    },
    children: [
      {
        data: closeData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#1890ff',
        smooth: true,
        style: {
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'left',
          },
        },
      },
      {
        data: positionData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#52c41a',
        smooth: true,
        style: {
          lineWidth: 2,
        },
        axis: {
          y: {
            position: 'right',
          },
        },
      },
    ],
    legend: {
      position: 'top',
    },
    // tooltip: {
    //   showMarkers: true,
    //   formatter: (datum: { date: string; value: number; type: string }) => {
    //     const valueStr = datum.type === '持仓比例' ? `${datum.value}%` : `${datum.value.toFixed(2)}`;
    //     return {
    //       name: datum.date,
    //       value: `${datum.type}: ${valueStr}`,
    //     };
    //   },
    // },
    tooltip: {
      // items: [
      //   {
      //     field: 'value',
      //     name: '沪深300收盘价',
      //     // valueFormatter: (value: number) => `${value.toFixed(2)}`,
      //   },
      //   {
      //     field: 'value',
      //     name: '持仓比例',
      //     // valueFormatter: (value: number) => `${value.toFixed(2)}%`,
      //   },
      // ],
    },
  };

  const tabItems = Object.keys(positionConfig).map((key) => ({
    key,
    label: positionConfig[key as PositionType].label,
  }));

  return (
    <div>
      <Card title={positionConfig[activeTab].label} style={{ marginBottom: 20 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as PositionType)}
          items={tabItems}
          style={{ marginBottom: 20 }}
        />
        <Spin spinning={loading}>
          <DualAxes {...config} style={{ height: 500 }} />
        </Spin>
      </Card>
    </div>
  );
};

export default FundPosition;
