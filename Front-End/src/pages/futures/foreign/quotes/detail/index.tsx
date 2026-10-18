import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Radio, Collapse } from 'antd';
import apiClient from '@/utils/axios';
import { calculateStartDate } from '@/utils';
import dayjs from 'dayjs';
import type { KLineData } from '@/utils/stockUtils';
import IndexMetrics from '@/components/IndexMetrics';

// RSI·推荐级别：与 /stock/a/index/detail 统一复用同一组件（路由层提供 Suspense 边界）
const RsiFilterMark = React.lazy(() => import('@/components/RsiFilterMark'));

/** futures_foreign_hist 接口返回的英文字段 */
interface ForeignFuturesHistItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  position: number;
  s: number;
  settlement: number;
}

const FuturesForeignQuotesDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const name = searchParams.get('name');
  const [timeRange, setTimeRange] = useState<string>('上市以来');
  const [rawData, setRawData] = useState<KLineData[]>([]);
  const [dailyData, setDailyData] = useState<KLineData[]>([]);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      return;
    }
    const startDate = calculateStartDate(dayjs(rawData?.[0]?.日期).format('YYYYMMDD'), timeRange);
    setDailyData(rawData?.filter(item => dayjs(item.日期).isAfter(dayjs(startDate))));
  }, [timeRange, rawData]);

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    try {
      const response = await apiClient.get('/api/public/futures_foreign_hist', {
        params: { symbol: code },
      });
      console.log('外盘期货详情 -> response', response);
      // 英文字段映射为 KLineData 所需的中文字段（日期/收盘/开盘/最高/最低/成交量）
      const list: KLineData[] = (response?.data || [])
        .map((item: ForeignFuturesHistItem) => ({
          日期: String(item.date).slice(0, 10),
          收盘: Number(item.close),
          开盘: Number(item.open),
          最高: Number(item.high),
          最低: Number(item.low),
          成交量: Number(item.volume),
        }))
        .filter((item: KLineData) => Number.isFinite(item.收盘));
      setRawData(list);
      setDailyData(list);
    } catch (error) {
      console.log('error', error);
    }
  }, [code]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>{name ? `${name}（${code}）` : code} - 外盘期货行情详情</h1>

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

      <Collapse defaultActiveKey={["2"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>行情/年化收益率/回撤率/波动率</span>} key="2">
          {useMemo(() => <IndexMetrics data={dailyData} />, [dailyData])}
        </Collapse.Panel>
      </Collapse>

      <Collapse defaultActiveKey={["3"]} style={{ marginTop: 16 }}>
        <Collapse.Panel header={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>📈📊📉 RSI·推荐级别</span>} key="3">
          <RsiFilterMark data={dailyData} type="commodity" />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default FuturesForeignQuotesDetail;
