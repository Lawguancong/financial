import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import { DualAxes } from '@ant-design/plots';
import axios from 'axios';
import moment from 'moment';

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
}

const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const publishDate = searchParams.get('publishDate');
  const [data, setData] = useState<IndexDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexName, setIndexName] = useState('');

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${publishDate}&end_date=${moment().format('YYYYMMDD')}`);
      console.log('指数详情 -> response', response);
      setData(response?.data || []);
      setIndexName(code);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [code, publishDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartConfig = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const chartName = `${data[0].指数中文简称}-滚动市盈率`; // 图表名称
    const dateKey = '日期' // 日期键名
    const dateName = '日期' // 日期键名
    const leftKey = '收盘';
    const leftName = `${data[0].指数中文简称}`;
    const rightKeys = {
      滚动市盈率: '滚动市盈率',
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
  }, [data, indexName]);

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
