import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Button, Card, Spin, Table } from 'antd';
import { DualAxes } from '@ant-design/plots';
import { pick } from 'lodash-es';
import { calculateMaxDrawdown, calculateRSI, calculateStartDate, calculateVolatility, calculateAnnualizedVolatility } from '@/utils';
import moment from 'moment';
import apiClient from '@/utils/axios';
import { timeRangeOptions, keyMap, rightKeys, calculateRecommendationLevel, getLevelStyle } from './constants';

interface UnitNavProps {
  symbol: string | null;
}

const UnitNav: React.FC<UnitNavProps> = ({ symbol }) => {
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [responseData, setResponseData] = useState<any[]>([]);
  const [data, setData] = useState<{
    leftData: any[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const [loading, setLoading] = useState(false);

  const indicator = '单位净值走势';
  const chartName = indicator;
  const dateKey = keyMap[indicator].日期;
  const dateName = '日期';
  const leftKey = keyMap[indicator].数据;
  const leftName = keyMap[indicator].数据;
  const sampleRate = keyMap[indicator].sampleRate;

  const memoizedRightKeys = useMemo(() => rightKeys, []);

  type DataRes = {
    [key: string]: string | number;
  };

  const labelMap = useMemo(() => ({
    [dateKey]: dateName,
    [leftKey]: leftName,
    ...memoizedRightKeys,
  }), [dateKey, leftKey, leftName, memoizedRightKeys]);

  const fetchData = useCallback(async () => {
    if (!symbol) {
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        symbol,
        indicator,
      };

      const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
        params,
      });
      setResponseData(response?.data || []);

     
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);


  useEffect(() => {
    if (!responseData || responseData.length === 0) return;
    
    let filteredData = responseData;

      if (timeRange !== '上市以来' && filteredData.length > 0) {
        const firstDate = filteredData[0][keyMap[indicator].日期] as string;
        const startDate = calculateStartDate(firstDate, timeRange);
        filteredData = filteredData.filter((item: Record<string, unknown>) => {
          const itemDate = item[keyMap[indicator].日期] as string;
          return moment(itemDate).format('YYYYMMDD') >= moment(startDate).format('YYYYMMDD');
        });
      }

      // 使用公共方法计算波动率
      const dataWithVolatility = calculateVolatility({
        data: filteredData,
        navKey: keyMap[indicator].数据,
        dateKey: keyMap[indicator].日期,
        period: 20 // 20日滚动波动率
      });

      // 计算年化波动率
      const dataWithAnnualizedVolatility = dataWithVolatility.map(item => {
        const currentItem = { ...item };
        if (currentItem['__波动率__'] !== undefined && currentItem['__波动率__'] > 0) {
          // 年化波动率 = 日波动率 * sqrt(252)
          currentItem['__年化波动率__'] = calculateAnnualizedVolatility(currentItem['__波动率__']);
        }
        return currentItem;
      });

      const dataFormat = calculateMaxDrawdown({
        data: dataWithAnnualizedVolatility,
        leftKey: keyMap[indicator].数据,
        dateKey: keyMap[indicator].日期,
      })?.filter((_, index: number) => index % sampleRate === 0)?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...memoizedRightKeys }))).map((key) => {
        const value = item[key];
        if (value === null) {
          return null;
        }
        return {
          date: String(item[dateKey]),
          key,
          label: labelMap[key as keyof typeof labelMap],
          value: Number(value),
        };
      })).flat().filter((item): item is { date: string; key: string; label: string; value: number } => item !== null);

      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey) || [],
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || []
      });

  }, [responseData, timeRange])

  useEffect(() => {
    fetchData();
  }, []);

  // 使用useMemo缓存配置对象，减少重复创建
  const config = useMemo(() => {
    return {
      title: {
        title: `${chartName}`,
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
  }, [chartName, data.leftData, data.rightData, leftName]);

  return (
    <Spin spinning={loading}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>时间范围：</span>
            <Select
              style={{ width: 120 }}
              value={timeRange}
              onChange={setTimeRange}
              options={timeRangeOptions}
            />
          </div>
        </div>
      </Card>
      <Card>
        <DualAxes {...config} />
      </Card>
    </Spin>
  );
};

export default UnitNav;