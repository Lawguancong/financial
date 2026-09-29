import { Line } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { Tabs, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface HousePriceData {
  日期: string;
  城市: string;
  '新建商品住宅价格指数-同比': number;
  '新建商品住宅价格指数-环比': number;
  '新建商品住宅价格指数-定基': number;
  '二手住宅价格指数-同比': number;
  '二手住宅价格指数-环比': number;
  '二手住宅价格指数-定基': number;
}

interface ChartData {
  date: string;
  value: number;
}

const NewHousePrice = () => {
  const [data, setData] = useState<HousePriceData[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeKey, setActiveKey] = useState('1');
  const [activeCity, setActiveCity] = useState<string>('');

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_new_house_price');
      console.log('新房价指数 -> response', response);
      
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  console.log('NewHousePrice -> data', data);

  const cities = useMemo(() => {
    const citySet = new Set<string>();
    data.forEach(item => citySet.add(item['城市']));
    return Array.from(citySet).sort();
  }, [data]);

  useEffect(() => {
    if (cities.length > 0 && !activeCity) {
      setActiveCity(cities[0]);
    }
  }, [cities, activeCity]);

  const cityTabs = useMemo(() => {
    return cities.map(city => {
      const cityData = data.filter(item => item['城市'] === city).sort((a, b) => 
        new Date(a['日期']).getTime() - new Date(b['日期']).getTime()
      );

      const yoyData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['新建商品住宅价格指数-同比'],
      }));

      const momData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['新建商品住宅价格指数-环比'],
      }));

      const baseData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['新建商品住宅价格指数-定基'],
      }));

      const usedYoyData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['二手住宅价格指数-同比'],
      }));

      const usedMomData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['二手住宅价格指数-环比'],
      }));

      const usedBaseData: ChartData[] = cityData.map(item => ({
        date: moment(item['日期']).format('YYYY-MM-DD'),
        value: item['二手住宅价格指数-定基'],
      }));

      return {
        key: city,
        label: city,
        children: (
          <div style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '24px' }}>{city} - 新建商品住宅价格指数</h3>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '新建商品住宅价格指数-同比',
                    subtitle: '同比变化趋势',
                  },
                  data: yoyData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '同比',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '新建商品住宅价格指数-环比',
                    subtitle: '环比变化趋势',
                  },
                  data: momData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '环比',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '新建商品住宅价格指数-定基',
                    subtitle: '定基变化趋势',
                  },
                  data: baseData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '定基',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
            <h3 style={{ marginBottom: '24px', marginTop: '48px' }}>{city} - 二手住宅价格指数</h3>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '二手住宅价格指数-同比',
                    subtitle: '同比变化趋势',
                  },
                  data: usedYoyData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '同比',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '二手住宅价格指数-环比',
                    subtitle: '环比变化趋势',
                  },
                  data: usedMomData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '环比',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
            <div>
              <Line
                {...{
                  title: {
                    title: '二手住宅价格指数-定基',
                    subtitle: '定基变化趋势',
                  },
                  data: usedBaseData,
                  xField: 'date',
                  yField: 'value',
                  shapeField: 'smooth',
                  axis: {
                    x: { title: '日期' },
                    y: { title: '指数值' },
                  },
                  tooltip: {
                    items: [
                      {
                        field: 'value',
                        name: '定基',
                        valueFormatter: (value: number) => `${value?.toFixed(2)}`,
                      },
                    ],
                  },
                }}
              />
            </div>
          </div>
        ),
      };
    });
  }, [data, cities]);

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>新房价指数</span>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => setRefreshKey(prev => prev + 1)}
          />
        </div>
      ),
      children: useMemo(() => (
        <Tabs
          activeKey={activeCity}
          items={cityTabs}
          onChange={setActiveCity}
        />
      ), [cityTabs, activeCity]),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeKey} items={items} />
    </div>
  );
};

export default NewHousePrice;
