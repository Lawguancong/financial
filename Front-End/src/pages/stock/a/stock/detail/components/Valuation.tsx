import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line } from '@ant-design/plots';
import { Radio, Spin } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio';
import apiClient from '@/utils/axios';
import moment from 'moment';

interface ValuationData {
  date: string;
  value: number;
}

interface ValuationProps {
  symbol: string;
}

const INDICATOR_OPTIONS = [
  { label: '总市值', value: '总市值' },
  { label: '市盈率(TTM)', value: '市盈率(TTM)' },
  { label: '市盈率(静)', value: '市盈率(静)' },
  { label: '市净率', value: '市净率' },
  { label: '市现率', value: '市现率' },
];

const PERIOD_OPTIONS = [
  { label: '近一年', value: '近一年' },
  { label: '近三年', value: '近三年' },
  { label: '近五年', value: '近五年' },
  { label: '近十年', value: '近十年' },
  { label: '全部', value: '全部' },
];

const sampleRate = 1;


const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
const controlsStyle: React.CSSProperties = { display: 'flex', gap: '32px', flexWrap: 'wrap' };
const controlItemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelStyle: React.CSSProperties = { fontWeight: 500 };
const chartStyle: React.CSSProperties = { height: 400 };
const loadingStyle: React.CSSProperties = { height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' };

const Valuation: React.FC<ValuationProps> = ({ symbol }) => {
  const [indicator, setIndicator] = useState<string>('总市值');
  const [period, setPeriod] = useState<string>('全部');
  const [data, setData] = useState<ValuationData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchValuationData = useCallback(async () => {
    if (!symbol) return;

    setLoading(true);
    try {
      const params = {
        symbol,
        indicator,
        period,
      };
      const response = await apiClient.get<ValuationData[]>('/api/public/stock_zh_valuation_baidu', { params });
      setData(response.data?.filter((_, index: number) => index % sampleRate === 0) || []);
    } catch (error) {
      console.error('fetchValuationData error:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, indicator, period]);

  useEffect(() => {
    fetchValuationData();
  }, [fetchValuationData]);

  const handleIndicatorChange = useCallback((e: RadioChangeEvent) => {
    setIndicator(e.target.value);
  }, []);

  const handlePeriodChange = useCallback((e: RadioChangeEvent) => {
    setPeriod(e.target.value);
  }, []);

  const chartConfig = useMemo(() => ({
    data,
    xField: (d: ValuationData) => new Date(d.date),
    yField: 'value',
    // axis: {
    //   x: {
    //     title: '日期',
    //     size: 40,
    //   },
    //   y: {
    //     title: indicator,
    //     size: 40,
    //   },
    // },
    slider: {
      x: { labelFormatter: (d: Date) => moment(d).format('YYYY-MM-DD') },
    },
    tooltip: {
      title: (d: ValuationData) => moment(d.date).format('YYYY-MM-DD'),
      items: [
        { field: 'value', name: indicator },
      ],
    },
    smooth: true,
    lineStyle: {
      stroke: '#1890ff',
      lineWidth: 1,
    },
    // point: {
    //   size: 3,
    //   shape: 'circle',
    //   style: {
    //     fill: '#1890ff',
    //     stroke: '#fff',
    //     lineWidth: 1,
    //   },
    // },
  }), [data, indicator]);

  return (
    <div style={containerStyle}>
      <div style={controlsStyle}>
        <div style={controlItemStyle}>
          <span style={labelStyle}>指标：</span>
          <Radio.Group
            options={INDICATOR_OPTIONS}
            value={indicator}
            onChange={handleIndicatorChange}
            optionType="button"
            buttonStyle="solid"
          />
        </div>
        <div style={controlItemStyle}>
          <span style={labelStyle}>周期：</span>
          <Radio.Group
            options={PERIOD_OPTIONS}
            value={period}
            onChange={handlePeriodChange}
            optionType="button"
            buttonStyle="solid"
          />
        </div>
      </div>

      {loading ? (
        <div style={loadingStyle}>
          <Spin size="large" />
        </div>
      ) : data.length === 0 ? (
        <div style={loadingStyle}>暂无数据</div>
      ) : (
        <div style={chartStyle}>
          <Line {...chartConfig} />
        </div>
      )}
    </div>
  );
};

export default Valuation;
