import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, Button, Card, Spin, Table, Collapse } from 'antd';
import { DualAxes, Line } from '@ant-design/plots';
import { pick } from 'lodash-es';
import { calculateMaxDrawdown, calculateRSI, calculateStartDate } from '@/utils';
import moment from 'moment';
import apiClient from '@/utils/axios';
import { timeRangeOptions, periodOptions, keyMap, rightKeys, calculateRecommendationLevel, getLevelStyle } from './constants';

interface CumulativeReturnProps {
  symbol: string | null;
}

const CumulativeReturn: React.FC<CumulativeReturnProps> = ({ symbol }) => {
  const [period, setPeriod] = useState<string>('成立来');
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

  const indicator = '累计收益率走势';
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
        period,
      };

      const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
        params,
      });

      let filteredData = response?.data || [];
      // 当指标为累计收益率走势时，过滤每月数据，有重复月的取累计收益率小的值
      if (filteredData.length > 0) {
        const monthlyMap = new Map<string, any>();

        filteredData.forEach(item => {
          const date = item[keyMap[indicator].日期];
          const monthKey = moment(date).format('YYYY-MM');
          const currentItem = monthlyMap.get(monthKey);

          if (!currentItem) {
            // 首次遇到该月，直接添加
            monthlyMap.set(monthKey, item);
          } else {
            // 已有该月数据，比较累计收益率，取较小值
            const currentValue = Number(currentItem['累计收益率']) || 0;
            const newValue = Number(item['累计收益率']) || 0;
            if (newValue < currentValue) {
              monthlyMap.set(monthKey, item);
            }
          }
        });

        // 将Map转换为数组并按日期排序
        filteredData = Array.from(monthlyMap.values()).sort((a, b) => {
          const dateA = a[keyMap[indicator].日期];
          const dateB = b[keyMap[indicator].日期];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
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
  }, [symbol, period, keyMap, indicator, dateKey, leftKey, leftName, memoizedRightKeys, sampleRate, labelMap]);

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, period]);

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
        title: chartName
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
      annotations: filteredRSIData?.map((item: any) => {
        const { color, fontSize } = getLevelStyle(item.__recommendationLevel__);
        return {
          type: 'text' as const,
          data: [new Date(item.日期), item.累计收益率],
          style: {
            text: '●',
            fontSize: fontSize,
            dx: -(fontSize / 2),
            stroke: color,
            fill: color,
          },
        };
      }),
    };
  }, [chartName, data.leftData, data.rightData, leftName, indicator, filteredRSIData]);

  return (
    <div>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>周期：</span>
            {useMemo(() => <Select
              style={{ width: 120 }}
              value={period}
              onChange={setPeriod}
              options={periodOptions}
            />, [period])}
          </div>
          <Button type="primary" onClick={fetchData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        <Card style={{ marginBottom: '16px' }}>
          {useMemo(() => <Collapse defaultActiveKey={[]}>
            <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别 ({filteredRSIData?.length}条)</span>} key="1">
              <Table
                dataSource={filteredRSIData}
                columns={tableColumns}
                rowKey="日期"
                pagination={false}
              />
            </Collapse.Panel>
          </Collapse>, [filteredRSIData])}
        </Card>
        <Card>
          {useMemo(() => <DualAxes {...config} />, [config])}
        </Card>
        <Card style={{ marginBottom: '16px' }}>
          {useMemo(() => <Line
            data={dailyRSIDataFund}
            xField={(d: { date: string }) => new Date(d.日期)}
            yField="__RSI6__"
            title={{ text: 'RSI6（月） 走势' }}
            axis={{
              x: { title: '日期', size: 40 },
              y: { title: 'RSI6（月）', size: 60 },
            }}
          />, [dailyRSIDataFund])}
        </Card>
      </Spin>
    </div>
  );
};

export default CumulativeReturn;