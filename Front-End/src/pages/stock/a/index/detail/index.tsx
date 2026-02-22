import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Radio } from 'antd';
import { DualAxes } from '@ant-design/plots';
import axios from 'axios';
import moment from 'moment';
import { calculateMaxDrawdown } from '@/utils';

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
  最大回撤率: number;
}

const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const publishDate = searchParams.get('publishDate');
  const [data, setData] = useState<IndexDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('10年');
  const chartName = `${data?.[0]?.指数中文简称}-滚动市盈率`; // 图表名称
  const dateKey = '日期' // 日期键名
  const dateName = '日期' // 日期键名
  const leftKey = '收盘';
  const leftName = `${data?.[0]?.指数中文简称}`;

  const calculateStartDate = useCallback(() => {
    if (!publishDate) {
      return '';
    }

    const currentMoment = moment();
    const publishMoment = moment(publishDate, 'YYYYMMDD');
    let startDate = '';

    switch (timeRange) {
      case '上市以来':
        startDate = publishMoment.format('YYYYMMDD');
        break;
      case '20年':
        startDate = currentMoment.subtract(20, 'years').format('YYYYMMDD');
        break;
      case '10年':
        startDate = currentMoment.subtract(10, 'years').format('YYYYMMDD');
        break;
      case '5年':
        startDate = currentMoment.subtract(5, 'years').format('YYYYMMDD');
        break;
      case '3年':
        startDate = currentMoment.subtract(3, 'years').format('YYYYMMDD');
        break;
      default:
        startDate = currentMoment.subtract(10, 'years').format('YYYYMMDD');
    }

    if (startDate && startDate < publishDate) {
      startDate = publishDate;
    }

    return startDate;
  }, [timeRange, publishDate]);

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    setLoading(true);
    try {
      const startDate = calculateStartDate();
      const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
      console.log('指数详情 -> response', response);
      const dataWithDrawdown = calculateMaxDrawdown(response?.data || [], leftKey);
      setData(dataWithDrawdown);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [code, calculateStartDate]);

  console.log('指数详情 -> data', data);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartConfig = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }


    const rightKeys = {
      最大回撤率: '最大回撤率',
      滚动市盈率: '滚动市盈率(%)',
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
  }, [data, code]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

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
          <Radio.Button value="10年">最近10年</Radio.Button>
          <Radio.Button value="5年">最近5年</Radio.Button>
          <Radio.Button value="3年">最近3年</Radio.Button>
        </Radio.Group>
      </div>

      {data.length > 0 ? (
        <div>
          <div style={{ marginBottom: '16px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <p><strong>最新数据：</strong></p>
            <p>日期：{moment(data[0].日期).format('YYYY-MM-DD')}</p>
            <p>指数代码：{data[0].指数代码}</p>
            <p>指数中文全称：{data[0].指数中文全称}</p>
            <p>指数中文简称：{data[0].指数中文简称}</p>
            <p>指数英文全称：{data[0].指数英文全称}</p>
            <p>指数英文简称：{data[0].指数英文简称}</p>
            <p>开盘：{data[0].开盘}</p>
            <p>最高：{data[0].最高}</p>
            <p>最低：{data[0].最低}</p>
            <p>收盘：{data[0].收盘}</p>
            <p>涨跌：{data[0].涨跌}</p>
            <p>涨跌幅：{data[0].涨跌幅}%</p>
            <p>成交量：{data[0].成交量} 万手</p>
            <p>成交金额：{data[0].成交金额} 亿元</p>
            <p>样本数量：{data[0].样本数量}</p>
            <p>滚动市盈率：{data[0].滚动市盈率}</p>
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
    </div>
  );
};

export default IndexDetail;
