import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Radio, Collapse } from 'antd';
import apiClient from '@/utils/axios';
import dayjs from 'dayjs';
import { calculateStartDate } from '@/utils';
import IndexMetrics from '@/components/IndexMetrics';

// RSI·推荐级别：与 /stock/a/index/detail、/stock/us/index 统一复用同一组件
const RsiFilterMark = React.lazy(() => import('@/components/RsiFilterMark'));

const HkIndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') || '';
  const name = decodeURIComponent(searchParams.get('name') || '') || '';
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [rawData, setRawData] = useState<Array<{ 日期: string; 收盘: number }>>([]);

  const dailyData = useMemo(() => {
    if (!rawData || rawData.length === 0) {
      return [];
    }
    const startDate = calculateStartDate(dayjs(rawData?.[0]?.日期).format('YYYYMMDD'), timeRange);
    return rawData.filter(item => dayjs(item.日期).isAfter(dayjs(startDate)));
  }, [timeRange, rawData]);

  useEffect(() => {
    if (!code) return;
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/api/public/stock_hk_index_daily_sina', {
          params: { symbol: code },
        });
        console.log('港股指数详情 -> response', response);
        setRawData(response?.data?.map((item: Record<string, unknown>) => ({
          日期: item.date,
          收盘: Number(item.close),
        })) || []);
      } catch (error) {
        console.log('error', error);
      }
    };
    fetchData();
  }, [code]);

  const metricsPanel = useMemo(() => <IndexMetrics data={dailyData} />, [dailyData]);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        {name || code} - 指数详情
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

      <Collapse defaultActiveKey={['2']} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>指数/年化收益率/回撤率/波动率</span>} key="2">
          {metricsPanel}
        </Collapse.Panel>
      </Collapse>

      <Collapse defaultActiveKey={['3']} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别</span>} key="3">
          <RsiFilterMark data={dailyData} type="index" />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default HkIndexDetail;
