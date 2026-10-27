import { Line } from '@ant-design/plots';
import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { Tabs, Button } from 'antd';
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';

// 链式计算指数图的说明文案样式（高亮信息条）
const indexNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '12px',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(24, 144, 255, 0.3)',
  borderLeft: '3px solid #1890ff',
  background: 'linear-gradient(90deg, rgba(24, 144, 255, 0.12) 0%, rgba(24, 144, 255, 0.03) 100%)',
  color: '#46536b',
  fontSize: '12.5px',
  lineHeight: 1.8,
};

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

// 由「环比」（上月=100）链式累乘还原「价格指数」：以首期已发布的定基值为锚点，
// 逐月乘以（环比/100），可复现已发布的定基值并把它补全到最新月份。
const buildPriceIndex = (
  rows: HousePriceData[],
  momKey: keyof HousePriceData,
  baseKey: keyof HousePriceData,
): ChartData[] => {
  if (rows.length === 0) return [];
  let level = Number(rows[0][baseKey]);
  if (!Number.isFinite(level)) level = 100;
  return rows.map((row, index) => {
    if (index > 0) {
      const mom = Number(row[momKey]);
      if (Number.isFinite(mom)) level = level * (mom / 100);
    }
    return {
      date: moment(row['日期']).format('YYYY-MM-DD'),
      value: Number(level.toFixed(2)),
    };
  });
};

const NewHousePrice = () => {
  const [data, setData] = useState<HousePriceData[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeKey, setActiveKey] = useState('1');
  const [activeCity, setActiveCity] = useState<string>('');

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/macro_china_new_house_price');
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

      const newIndexData = buildPriceIndex(
        cityData,
        '新建商品住宅价格指数-环比',
        '新建商品住宅价格指数-定基',
      );

      const usedIndexData = buildPriceIndex(
        cityData,
        '二手住宅价格指数-环比',
        '二手住宅价格指数-定基',
      );

      return {
        key: city,
        label: city,
        children: (
          <div style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '24px' }}>{city} - 新建商品住宅价格指数</h3>
            <div style={indexNoteStyle}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <span>
                数据说明：本图「价格指数」由
                <b style={{ color: '#1890ff' }}>「新建商品住宅价格指数-环比」</b>
                字段逐月链式累乘计算得出（以首期定基值为基点），
                <b style={{ color: '#fa8c16' }}>并非接口直接提供的字段</b>
                ，仅供趋势参考。
              </span>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <Line
                {...{
                  title: {
                    title: '新建商品住宅价格指数',
                    subtitle: '由环比链式计算（定基口径，首期定基为基）',
                  },
                  data: newIndexData,
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
                        name: '价格指数',
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
            <div style={indexNoteStyle}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <span>
                数据说明：本图「价格指数」由
                <b style={{ color: '#1890ff' }}>「二手住宅价格指数-环比」</b>
                字段逐月链式累乘计算得出（以首期定基值为基点），
                <b style={{ color: '#fa8c16' }}>并非接口直接提供的字段</b>
                ，仅供趋势参考。
              </span>
            </div>
            <div>
              <Line
                {...{
                  title: {
                    title: '二手住宅价格指数',
                    subtitle: '由环比链式计算（定基口径，首期定基为基）',
                  },
                  data: usedIndexData,
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
                        name: '价格指数',
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
          <span>新房/二手房价格指数</span>
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
