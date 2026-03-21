import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Radio, Tag, Collapse, Card, Table } from 'antd';
import { DualAxes } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { isNumber } from 'lodash-es'
import { calculateMaxDrawdown, calculateStartDate, calculatePercentiles, convertToKLine, calculateRSI, calculatePercentile } from '@/utils';
import { calculateRecommendationLevel, getLevelStyle } from '@/pages/fund/cn/open/detail/constants';

interface IndexDetailData {
  日期: string;
  指数代码: string;
  指数中文全称: string;
  指数中文简称: string;
  指数英文全称: string;
  指数英文简称: string;
  开盘: number;
  最高: number;
  最低: number;
  收盘: number;
  涨跌: number;
  涨跌幅: number;
  成交量: number;
  成交金额: number;
  样本数量: number;
  滚动市盈率: number;
  ['__最大回撤率__']: number;
  ['__年化收益率__']: number | null;
  // ['__monthlyRSI6__']: number | null;
  // ['__quarterlyRSI6__']: number | null;
}

const leftKey = '收盘';
const leftName = '收盘';
const dateKey = '日期';
const dateName = '日期';

const tableColumns = [
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
    title: dateName,
    dataIndex: dateKey,
    key: dateKey,
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
]


const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const publishDate = searchParams.get('publishDate');
  const [data, setData] = useState<IndexDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const { percentile15, percentile85 } = calculatePercentiles(data as unknown as { [key: string]: number }[], '滚动市盈率');
  const [RSI6Data, setRSI6Data] = useState<any[]>([]);
  const RSI6LevelData = useMemo(() => RSI6Data?.filter((item: any) => isNumber(item.__recommendationLevel__)), [RSI6Data]);

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    setLoading(true);
    try {
      const startDate = calculateStartDate(publishDate || '', timeRange);
      console.log('指数详情 -> startDate', startDate);
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
      const dailyData = response?.data || [];
      console.log('指数详情 -> dailyData', dailyData);



      // 计算不同周期的K线数据
      // const weeklyData = convertToKLine({ dailyData, period: 'weekly' });
      const monthlyData = convertToKLine({ dailyData, period: 'monthly' });
      const quarterlyData = convertToKLine({ dailyData, period: 'quarterly' });

      // 计算不同周期的RSI
      // const dailyRSIData = calculateRSI({ data, closeKey: '收盘', period: 6 });
      // const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
      const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 })?.map(item => {
        const date = moment(item.日期);
        const itemMonth = date.format('YYYY-MM');
        return {
          日期: item.日期,
          __RSI6__: item.__RSI6__,
          itemMonth,
        }
      });
      const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 })?.map(item => {
        const date = moment(item.日期);
        const year = date.year();
        const quarter = date.quarter();
        const itemQuarter = `${year}Q${quarter}`;
        return {
          日期: item.日期,
          __RSI6__: item.__RSI6__,
          itemQuarter
        }
      });
      console.log('月RSI6 -> monthlyRSIData', monthlyRSIData);
      console.log('季RSI6 -> quarterlyRSIData', quarterlyRSIData);


      // todo  日: dailyData 月: monthlyData 季: quarterlyData
      const dailyDataWithRSI = dailyData?.map((item: IndexDetailData) => {
        const date = moment(item.日期);
        const itemMonth = date.format('YYYY-MM');
        const year = date.year();
        const quarter = date.quarter();
        const itemQuarter = `${year}Q${quarter}`;
        const __monthlyRSI6__ = monthlyRSIData?.find(i => i?.itemMonth === itemMonth)?.__RSI6__;
        const __quarterlyRSI6__ = quarterlyRSIData?.find(i => i?.itemQuarter === itemQuarter)?.__RSI6__;
        return {
          ...item,
          // __monthlyRSI6__: __monthlyRSI6__,
          // __quarterlyRSI6__: __quarterlyRSI6__,
          // __recommendationLevel__: calculateRecommendationLevel({
          //   __monthlyRSI6__, __quarterlyRSI6__,
          // }),
        }
      });


       // 提取RSI6数值
        const monthlyRSIValues = monthlyRSIData.map(item => item['__RSI6__']).filter(value => typeof value === 'number' && !isNaN(value));
        const quarterlyRSIValues = quarterlyRSIData.map(item => item['__RSI6__']).filter(value => typeof value === 'number' && !isNaN(value));
        
      // 计算10%和90%分位数
      const __monthly10th__ = calculatePercentile(monthlyRSIValues, 10);
      const __monthly90th__ = calculatePercentile(monthlyRSIValues, 90);
      const __quarterly10th__ = calculatePercentile(quarterlyRSIValues, 10);
      const __quarterly90th__ = calculatePercentile(quarterlyRSIValues, 90);
      const monthlyDataWithRSI = monthlyData?.map((item: IndexDetailData) => {
        const date = moment(item.日期);
        const itemMonth = date.format('YYYY-MM');
        const year = date.year();
        const quarter = date.quarter();
        const itemQuarter = `${year}Q${quarter}`;
        const __monthlyRSI6__ = monthlyRSIData?.find(i => i?.itemMonth === itemMonth)?.__RSI6__;
        const __quarterlyRSI6__ = quarterlyRSIData?.find(i => i?.itemQuarter === itemQuarter)?.__RSI6__;
        return {
          ...item,
          __monthlyRSI6__: __monthlyRSI6__,
          __quarterlyRSI6__: __quarterlyRSI6__,
          __recommendationLevel__: calculateRecommendationLevel({
            __monthlyRSI6__, __quarterlyRSI6__,
            __monthly10th__,
            __monthly90th__,
            __quarterly10th__,
            __quarterly90th__,
          }),
          __monthly10th__,
          __monthly90th__,
          __quarterly10th__,
          __quarterly90th__,
        }
      });

      console.log('有RSI的数据 -> dailyDataWithRSI', dailyDataWithRSI);
      console.log('有RSI的数据 -> monthlyDataWithRSI', monthlyDataWithRSI);
      setRSI6Data(monthlyDataWithRSI);


      const dataWithDrawdown = calculateMaxDrawdown({
        data: dailyDataWithRSI,
        leftKey: '收盘',
        dateKey: '日期',
        percentKey: '滚动市盈率'
      });
      console.log('指数详情 -> dataWithDrawdown', dataWithDrawdown);
      setData(dataWithDrawdown as unknown as IndexDetailData[]);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [code, publishDate, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartConfig = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const latestData = data[data.length - 1];
    const chartName = `${latestData.指数中文简称}-滚动市盈率`;
    const dateKey = '日期';
    const dateName = '日期';
    const leftKey = '收盘';
    const leftName = `${latestData.指数中文简称}`;

    const rightKeys = {
      ['__最大回撤率__']: '最大回撤率(%)',
      ['__年化收益率__']: '年化收益率(%)',
      滚动市盈率: '滚动市盈率',
      [`__滚动市盈率15%百分位__`]: `滚动市盈率15%百分位`,
      [`__滚动市盈率85%百分位__`]: `滚动市盈率85%百分位`,
      // [`__monthlyRSI6__`]: `月RSI6`,
      // [`__quarterlyRSI6__`]: `季RSI6`,
    };

    const labelMap = {
      [dateKey]: dateName,
      [leftKey]: leftName,
      ...rightKeys
    };

    const dataFormat = data.map((item) => {
      const keys = Object.keys({ [leftKey]: leftName, ...rightKeys });
      return keys.map((key) => ({
        date: item[dateKey],
        key,
        label: labelMap[key as keyof typeof labelMap],
        value: item[key as keyof IndexDetailData],
      }));
    }).flat();

    const leftData = dataFormat.filter((item) => item.key === leftKey);
    const rightData = dataFormat.filter((item) => item.key !== leftKey);
    return {
      title: {
        title: chartName,
      },
      xField: (d: { date: string }) => new Date(d.date),
      children: [
        {
          data: leftData,
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
          data: rightData,
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
  }, [data]);

  // if (loading) {
  //   return (
  //     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
  //       <Spin size="large" />
  //     </div>
  //   );
  // }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        {data?.[0]?.指数中文简称} - 指数详情
      </h1>

      <div style={{ marginBottom: '16px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <p><strong>时间范围：</strong></p>
        <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <Radio.Button value="上市以来">上市以来</Radio.Button>
          <Radio.Button value="20年">最近20年</Radio.Button>
          <Radio.Button value="15年">最近15年</Radio.Button>
          <Radio.Button value="10年">最近10年</Radio.Button>
          <Radio.Button value="5年">最近5年</Radio.Button>
          <Radio.Button value="3年">最近3年</Radio.Button>
        </Radio.Group>
      </div>

      <Collapse defaultActiveKey={["1"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>基础信息</span>} key="1">
          <Card style={{ marginTop: '16px' }}>
            {data.length > 0 ? (
              <div>
                <div style={{
                  marginBottom: '16px',
                  padding: '20px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {(() => {
                    const latestData = data[data.length - 1];
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', fontSize: '13px', lineHeight: '1.6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px' }}>最新数据</span>
                          <Tag color="white" style={{
                            color: '#667eea',
                            fontWeight: '600',
                            padding: '2px 10px',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}>
                            {moment(latestData.日期).format('YYYY-MM-DD')}
                          </Tag>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '500' }}>{latestData.指数中文简称}({latestData.指数代码})</span>
                          <span>开盘：<span style={{ fontWeight: '600' }}>{latestData.开盘}</span></span>
                          <span>最高：<span style={{ fontWeight: '600' }}>{latestData.最高}</span></span>
                          <span>最低：<span style={{ fontWeight: '600' }}>{latestData.最低}</span></span>
                          <span style={{ fontWeight: 'bold', fontSize: '15px', marginLeft: '8px' }}>收盘：<span style={{ fontSize: '16px' }}>{latestData.收盘}</span></span>
                          <span style={{
                            color: latestData.涨跌 >= 0 ? '#95de64' : '#ff7875',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: latestData.涨跌 >= 0 ? 'rgba(149, 222, 100, 0.15)' : 'rgba(255, 120, 117, 0.15)'
                          }}>
                            {latestData.涨跌 >= 0 ? '+' : ''}{latestData.涨跌} ({latestData.涨跌幅 >= 0 ? '+' : ''}{latestData.涨跌幅}%)
                          </span>
                          <span>成交量：<span style={{ fontWeight: '600' }}>{latestData.成交量}</span>万手</span>
                          <span>成交额：<span style={{ fontWeight: '600' }}>{latestData.成交金额}</span>亿元</span>
                          <span>滚动市盈率：<span style={{ fontWeight: '600' }}>{latestData.滚动市盈率}</span></span>
                          <span>滚动市盈率(15%分位数)：<span style={{ fontWeight: '600' }}>{percentile15}</span></span>
                          <span>滚动市盈率(85%分位数)：<span style={{ fontWeight: '600' }}>{percentile85}</span></span>
                          <span>动态回撤率：<span style={{ fontWeight: '600' }}>{latestData['__最大回撤率__']}</span>%</span>
                          {/* <span>月RSI6：<span style={{ fontWeight: '600' }}>{latestData['__monthlyRSI6__']}</span>%</span> */}
                          {/* <span>季RSI6：<span style={{ fontWeight: '600' }}>{latestData['__quarterlyRSI6__']}</span>%</span> */}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ marginTop: '24px' }}>
                  {chartConfig && <DualAxes {...chartConfig} />}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Collapse.Panel>
      </Collapse>

      <Collapse defaultActiveKey={["1"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别 ({RSI6LevelData?.length}条)</span>} key="1">
          <Card style={{ marginTop: '16px' }}>
            <Table
              dataSource={RSI6LevelData}
              columns={tableColumns}
              rowKey={dateKey}
              pagination={false}
            />
          </Card>
          <Card>
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>月度RSI6 10%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__monthly10th__']?.toFixed(2) || '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>月度RSI6 90%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__monthly90th__']?.toFixed(2) || '-'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>季度RSI6 10%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__quarterly10th__']?.toFixed(2) || '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#666' }}>季度RSI6 90%分位:</span>
                  <span style={{ color: '#1890ff', fontWeight: '600' }}>{RSI6LevelData?.[0]?.['__quarterly90th__']?.toFixed(2) || '-'}</span>
                </div>
              </div>
            </div>
            {useMemo(() => {
              const leftData = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item[leftKey],
                label: leftName
              }));
              const rightDataMonthly = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item['__monthlyRSI6__'],
                label: 'RSI6（月）'
              }));
              const rightDataQuarterly = RSI6Data.map(item => ({
                date: item[dateKey],
                value: item['__quarterlyRSI6__'],
                label: 'RSI6（季）'
              }));

              const annotationsData = RSI6LevelData?.map((item: any) => {
                const { color, fontSize } = getLevelStyle(item.__recommendationLevel__);
                return {
                  type: 'text' as const,
                  data: [new Date(item[dateKey]), item[leftKey]],
                  style: {
                    text: '●',
                    fontSize: fontSize,
                    dx: -(fontSize / 2),
                    stroke: color,
                    fill: color,
                  },
                };
              })
              // todo
              // 添加分位数数据
              const percentileData = [];
              if (RSI6Data.length > 0) {
                const firstDate = RSI6Data[0][dateKey];
                const lastDate = RSI6Data[RSI6Data.length - 1][dateKey];
                const __monthly10th__ = RSI6Data[0]['__monthly10th__'];
                const __monthly90th__ = RSI6Data[0]['__monthly90th__'];
                const __quarterly10th__ = RSI6Data[0]['__quarterly10th__'];
                const __quarterly90th__ = RSI6Data[0]['__quarterly90th__'];

                // 月度分位数
                percentileData.push(
                  { date: firstDate, value: __monthly10th__, label: '月度10%分位' },
                  { date: lastDate, value: __monthly10th__, label: '月度10%分位' },
                  { date: firstDate, value: __monthly90th__, label: '月度90%分位' },
                  { date: lastDate, value: __monthly90th__, label: '月度90%分位' },
                  // 季度分位数
                  { date: firstDate, value: __quarterly10th__, label: '季度10%分位' },
                  { date: lastDate, value: __quarterly10th__, label: '季度10%分位' },
                  { date: firstDate, value: __quarterly90th__, label: '季度90%分位' },
                  { date: lastDate, value: __quarterly90th__, label: '季度90%分位' }
                );
              }
              console.log('1111 RSI6Data', RSI6Data)
              console.log('1111 分位数数据', percentileData)

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
                      data: [...rightDataMonthly, ...rightDataQuarterly, ...percentileData],
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
                      style: (datum: any) => {
                        if (datum.label.includes('分位')) {
                          return { stroke: '#999', lineWidth: 1, lineDash: [5, 5] };
                        }
                        return {};
                      },
                    },
                  ]}
                  annotations={annotationsData}
                />
              );
            }, [RSI6Data, RSI6LevelData])}

          </Card>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default IndexDetail;
