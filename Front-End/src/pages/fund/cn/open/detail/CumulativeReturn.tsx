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
  const [filteredDataWithRSI, setFilteredDataWithRSI] = useState<any[]>([]);

  const indicator = '累计收益率走势';
  const closeKey = '累计收益率';
  const chartName = indicator;
  const dateKey = '日期';
  const dateName = '日期';
  const leftKey = '累计收益率';
  const leftName = '累计收益率(%)';


  type DataRes = {
    [key: string]: string | number;
  };

  const labelMap = {
    [dateKey]: dateName,
    [leftKey]: leftName, // 左侧Y轴名称，避免与右侧重复
    ...rightKeys
  }

  const fetchData = async () => {
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

      const responseData = response?.data || [];
      console.log('基金返回数据filteredData', responseData);
      if (period === '成立来') {
        // 过滤每月数据，有重复月的取累计收益率小的值
        let momthData = []
        const monthlyMap = new Map<string, any>();
        responseData?.forEach(item => {
          const date = item[keyMap[indicator].日期];
          const monthKey = moment(date).format('YYYY-MM');
          const currentItem = monthlyMap.get(monthKey);

          if (!currentItem) {
            // 首次遇到该月，直接添加
            monthlyMap.set(monthKey, item);
          } else {
            // 已有该月数据，比较累计收益率，取较小值
            const currentValue = Number(currentItem[closeKey]) || 0;
            const newValue = Number(item[closeKey]) || 0;
            if (newValue < currentValue) {
              monthlyMap.set(monthKey, item);
            }
          }
        });

        // 将Map转换为数组并按日期排序
        momthData = Array.from(monthlyMap.values()).sort((a, b) => {
          const dateA = a[keyMap[indicator].日期];
          const dateB = b[keyMap[indicator].日期];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
        });

        // 季度数据处理：按季度分组，取每个季度的最后一天数据（收盘价）
        const quarterlyMap = new Map<string, any>();
        momthData?.forEach(item => {
          const date = item[keyMap[indicator].日期];
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;
          const currentItem = quarterlyMap.get(quarterKey);

          if (!currentItem) {
            // 首次遇到该季度，直接添加
            quarterlyMap.set(quarterKey, item);
          } else {
            // 已有该季度数据，比较日期，取较晚的日期（收盘价）
            const currentDate = moment(currentItem[keyMap[indicator].日期]);
            const newDate = moment(date);
            if (newDate.isAfter(currentDate)) {
              quarterlyMap.set(quarterKey, item);
            }
          }
        });

        // 将季度Map转换为数组并按日期排序
        const quarterlyData = Array.from(quarterlyMap.values()).sort((a, b) => {
          const dateA = a[keyMap[indicator].日期];
          const dateB = b[keyMap[indicator].日期];
          return moment(dateA).valueOf() - moment(dateB).valueOf();
        });
        console.log('月度数据 momthData', momthData);
        console.log('季度数据 quarterlyData', quarterlyData);


        // 计算每月数据的RSI6
        const monthlyRSI6Data = calculateRSI({ data: momthData, closeKey: closeKey, period: 6 });
        const quarterlyRSI6Data = calculateRSI({ data: quarterlyData, closeKey: closeKey, period: 6 });

        console.log('monthlyRSI6Data', monthlyRSI6Data);
        console.log('quarterlyRSI6Data', quarterlyRSI6Data);




        // 将RSI6数据合并到filteredData中
        const monthlyRSIMap = new Map(monthlyRSI6Data.map(item => [item.日期, item.__monthlyRSI6__]));

        // 创建季度RSI映射：季度键 -> RSI值
        const quarterlyRSIMap = new Map<string, number>();
        quarterlyRSI6Data.forEach(item => {
          const date = item.日期;
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;
          quarterlyRSIMap.set(quarterKey, item.__RSI6__);
        });

        const filteredDataWithRSI = monthlyRSI6Data.map(item => {
          const date = item[keyMap[indicator].日期];
          const year = moment(date).year();
          const quarter = moment(date).quarter();
          const quarterKey = `${year}-Q${quarter}`;

          return {
            ...item,
            // 日期: item['日期'],
            // 累计收益率: item[closeKey],
            __monthlyRSI6__: item['__RSI6__'],
            __quarterlyRSI6__: quarterlyRSIMap.get(quarterKey) || null
          };
        });


        setDailyRSIDataFund(monthlyRSI6Data);
        console.log('filteredDataWithRSI', filteredDataWithRSI);
        setFilteredDataWithRSI(filteredDataWithRSI);

        const dataFormat = calculateMaxDrawdown({
          data: filteredDataWithRSI,
          leftKey: keyMap[indicator].数据,
          dateKey: keyMap[indicator].日期,
        })?.map((item: DataRes) => Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => {
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

        console.log('dataFormat?.filter((item: { key: string }) => item.key === leftKey) || []', dataFormat?.filter((item: { key: string }) => item.key === leftKey) || []);
        console.log('dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || []', dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || []);

        setData({
          leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey) || [],
          rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey) || []
        });


      } else {

      }


    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, period]);

  console.log('dailyRSIDataFund', dailyRSIDataFund)


    const filteredRSIData = filteredDataWithRSI.map((item: any) => ({
      ...item,
      __recommendationLevel__: calculateRecommendationLevel({ __monthlyRSI6__: item.__monthlyRSI6__, __quarterlyRSI6__: item.__quarterlyRSI6__ })
    }))?.filter((item: any) =>  [1,3,5].includes(item.__recommendationLevel__));

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
      title: 'RSI6（月）',
      dataIndex: '__monthlyRSI6__',
      key: '__monthlyRSI6__',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: 'RSI6（季）',
      dataIndex: '__quarterlyRSI6__',
      key: '__quarterlyRSI6__',
      render: (value: number) => value?.toFixed(2),
    }
  ], []);

  // 使用useMemo缓存配置对象，减少重复创建
  const config = useMemo(() => {
    return {
      title: {
        title: chartName
      },
      smooth: true,
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
          {useMemo(() => <Collapse defaultActiveKey={["1"]}>
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
          {useMemo(() => {
            // 准备数据格式 - 使用 filteredDataWithRSI 作为数据源
            const leftData = filteredDataWithRSI.map(item => ({
              date: item['日期'],
              value: item['累计收益率'],
              label: '累计收益率'
            }));
            const rightDataMonthly = filteredDataWithRSI.map(item => ({
              date: item['日期'],
              value: item['__monthlyRSI6__'],
              label: 'RSI6（月）'
            }));
            const rightDataQuarterly = filteredDataWithRSI.map(item => ({
              date: item['日期'],
              value: item['__quarterlyRSI6__'],
              label: 'RSI6（季）'
            }));

            return (
              <DualAxes
                title={{ title: '累计收益率与RSI6走势' }}
                xField={(d: { date: string }) => new Date(d.date)}
                smooth={true}
                children={[
                  {
                    data: leftData,
                    type: 'line',
                    yField: 'value',
                    colorField: 'label',
                    shapeField: 'smooth',
                    style: { stroke: '#5B8FF9', lineWidth: 2 },
                    axis: {
                      y: {
                        title: '累计收益率',
                        style: { titleFill: '#5B8FF9' },
                      },
                    },
                  },
                  {
                    data: [...rightDataMonthly, ...rightDataQuarterly],
                    type: 'line',
                    yField: 'value',
                    colorField: 'label',
                    shapeField: 'smooth',
                    axis: {
                      y: {
                        position: 'right',
                        title: 'RSI6',
                        style: { titleFill: '#6c6868ff' },
                      },
                    },
                  },
                ]}
              />
            );
          }, [dailyRSIDataFund])}
        </Card>
      </Spin>
    </div>
  );
};

export default CumulativeReturn;