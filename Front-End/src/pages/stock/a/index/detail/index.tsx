import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Radio, Tag } from 'antd';
import { DualAxes } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { calculateMaxDrawdown, calculateStartDate } from '@/utils';

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
  __最大回撤率__: number;
  __年化收益率__: number | null;
}

const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const publishDate = searchParams.get('publishDate');
  const [data, setData] = useState<IndexDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('10年');

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    setLoading(true);
    try {
      const startDate = calculateStartDate(publishDate || '', timeRange);
      const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
      console.log('指数详情 -> response', response);
      const dataWithDrawdown = calculateMaxDrawdown(response?.data || [], '收盘');
      setData(dataWithDrawdown as unknown as IndexDetailData[]);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [code, publishDate, timeRange]);

  console.log('指数详情 -> data', data);

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
      __最大回撤率__: '最大回撤率(%)',
      __年化收益率__: '年化收益率(%)',
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
  }, [data]);

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
          <Radio.Button value="15年">最近15年</Radio.Button>
          <Radio.Button value="10年">最近10年</Radio.Button>
          <Radio.Button value="5年">最近5年</Radio.Button>
          <Radio.Button value="3年">最近3年</Radio.Button>
        </Radio.Group>
      </div>

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
                    <span>动态回撤率：<span style={{ fontWeight: '600' }}>{latestData.__最大回撤率__}</span>%</span>
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
    </div>
  );
};

export default IndexDetail;
