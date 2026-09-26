import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Radio, Tag, Collapse, Card } from 'antd';
import { DualAxes } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { calculateMaxDrawdown, calculateStartDate, calculatePercentiles } from '@/utils';
import dayjs from 'dayjs';

// RSI·推荐级别：与 /stock/us/index 统一复用同一组件（路由层提供 Suspense 边界）
const RsiFilterMark = React.lazy(() => import('@/pages/stock/a/stock/detail/components/RsiFilterMark'));
export interface IndexDetailData {
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

const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [rawData, setRawData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);

  const dataWithDrawdown = useMemo(() => calculateMaxDrawdown({
    data: dailyData,
    leftKey: '收盘',
    dateKey: '日期',
    percentKey: '滚动市盈率'
  }), [dailyData]);

  // const [data, setData] = useState<IndexDetailData[]>([]);
  const { percentile15, percentile85 } = useMemo(() => calculatePercentiles(dataWithDrawdown as unknown as { [key: string]: number }[], '滚动市盈率'), [dataWithDrawdown]);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      return;
    }
    const startDate = calculateStartDate(dayjs(rawData?.[0]?.日期).format('YYYYMMDD'), timeRange);
    setDailyData(rawData?.filter(item => dayjs(item.日期).isAfter(dayjs(startDate))))
  }, [timeRange, rawData]);

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    try {
      const startDate = '19800101'; // 默认从1980年1月1日开始查询，并去除第一个日期的空值
      console.log('指数详情 -> startDate', startDate);
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
      const data = response?.data || [];
      const firstNonMultipleIndex = data.findIndex((item: IndexDetailData) => Number(item.收盘) % 100 !== 0);
      console.log('111 firstNonMultipleIndex', firstNonMultipleIndex)
      setRawData((0 < firstNonMultipleIndex && firstNonMultipleIndex < 10) ? data.slice(firstNonMultipleIndex - 1) : data)
    } catch (error) {
      console.log('error', error);
    } finally {
      //
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const chartConfig = useMemo(() => {
    if (!dataWithDrawdown || dataWithDrawdown.length === 0) {
      return null;
    }
    const latestData = dataWithDrawdown[dataWithDrawdown.length - 1];
    const chartName = `${latestData.指数中文简称}-滚动市盈率`;
    const dateKey = '日期';
    const dateName = '日期';
    const leftKey = '收盘';
    const leftName = `${latestData.指数中文简称}`;

    const rightKeys = {
      ['__最大回撤率__']: '最大回撤率(%)',
      ['__年化收益率__']: '年化收益率(%)',
      滚动市盈率: '滚动市盈率',
      // [`__滚动市盈率15%百分位__`]: `滚动市盈率15%百分位`,
      // [`__滚动市盈率85%百分位__`]: `滚动市盈率85%百分位`,
      // [`__monthlyRSI6__`]: `月RSI6`,
      // [`__quarterlyRSI6__`]: `季RSI6`,
    };

    const labelMap = {
      [dateKey]: dateName,
      [leftKey]: leftName,
      ...rightKeys
    };

    const dataFormat = dataWithDrawdown.map((item) => {
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
  }, [dataWithDrawdown]);


  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        {dataWithDrawdown?.[0]?.指数中文简称} - 指数详情
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
            {dataWithDrawdown.length > 0 ? (
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
                    const latestData = dataWithDrawdown[dataWithDrawdown.length - 1];
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
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别</span>} key="1">
          <RsiFilterMark data={dailyData} type="index" />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default IndexDetail;
