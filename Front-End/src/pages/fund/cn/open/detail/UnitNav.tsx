import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Button, Card, Spin, Table } from 'antd';
import { DualAxes, Line } from '@ant-design/plots';
import { pick } from 'lodash-es';
import { calculateMaxDrawdown, calculateRSI, calculateStartDate } from '@/utils';
import moment from 'moment';
import apiClient from '@/utils/axios';
import { timeRangeOptions, keyMap, rightKeys, calculateRecommendationLevel, getLevelStyle } from './constants';

interface UnitNavProps {
  symbol: string | null;
}

const UnitNav: React.FC<UnitNavProps> = ({ symbol }) => {
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [data, setData] = useState<{
    leftData: any[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });
  const [loading, setLoading] = useState(false);
  const [dailyRSIDataFund, setDailyRSIDataFund] = useState<any[]>([]);

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
    ...memoizedRightKeys
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

      let filteredData = response?.data || [];

      if (timeRange !== '上市以来' && filteredData.length > 0) {
        const firstDate = filteredData[0][keyMap[indicator].日期] as string;
        const startDate = calculateStartDate(firstDate, timeRange);
        filteredData = filteredData.filter((item: Record<string, unknown>) => {
          const itemDate = item[keyMap[indicator].日期] as string;
          return moment(itemDate).format('YYYYMMDD') >= moment(startDate).format('YYYYMMDD');
        });
      }

      // 计算每月数据的RSI6
      const dailyRSIData_fund = calculateRSI({ data: filteredData, closeKey: '累计收益率', period: 6 });
      setDailyRSIDataFund(dailyRSIData_fund);

      // 将RSI6数据合并到filteredData中
      const rsiMap = new Map(dailyRSIData_fund.map(item => [item.日期, item.__RSI6__]));
      const filteredDataWithRSI = filteredData.map(item => ({
        ...item,
        __RSI6__: rsiMap.get(item[keyMap[indicator].日期]) || null
      }));

      const dataFormat = calculateMaxDrawdown({
        data: filteredDataWithRSI,
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
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeRange, keyMap, indicator, dateKey, leftKey, leftName, memoizedRightKeys, sampleRate, labelMap]);

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, timeRange]);

  // 使用useMemo缓存过滤后的RSI数据，减少重复计算
  const filteredRSIData = useMemo(() => {
    return dailyRSIDataFund.map((item: any) => ({
      ...item,
      __recommendationLevel__: calculateRecommendationLevel(item.__RSI6__)
    })).filter((item: any) => {
      const level = item.__recommendationLevel__;
      return [5, 3, 1, -1, -3, -5].includes(level);
    });
  }, [dailyRSIDataFund]);

  // 使用useMemo缓存表格列配置，减少重复创建
  const tableColumns = useMemo(() => [
    {
      title: '推荐级别',
      dataIndex: '__recommendationLevel__',
      key: '__recommendationLevel__',
      render: (level: number) => {
        const { color, fontSize } = getLevelStyle(level);
        return <span style={{ color, fontSize }}>{'★'.repeat(Math.abs(level))}</span>;
      },
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      render: (text: string) => moment(text).format('YYYY-MM-DD'),
    },
    {
      title: 'RSI6',
      dataIndex: '__RSI6__',
      key: '__RSI6__',
      render: (value: number) => value?.toFixed(2),
    },
  ], []);

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
    <div>
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
          <Button type="primary" onClick={fetchData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        {indicator === '累计收益率走势' && filteredRSIData.length > 0 && (
          <Card style={{ marginBottom: '16px' }}>
            <Table
              dataSource={filteredRSIData}
              columns={tableColumns}
              rowKey="日期"
              pagination={false}
            />
          </Card>
        )}
        <Card>
          <DualAxes {...config} />
        </Card>
        {indicator === '累计收益率走势' && dailyRSIDataFund.length > 0 && (
          <Card style={{ marginBottom: '16px' }}>
            <Line
              data={dailyRSIDataFund}
              xField={(d: { date: string }) => new Date(d.日期)}
              yField="__RSI6__"
              title={{ text: 'RSI6（月） 走势' }}
              axis={{
                x: { title: '日期', size: 40 },
                y: { title: 'RSI6（月）', size: 60 },
              }}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default UnitNav;