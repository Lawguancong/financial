import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/plots';
import moment from 'moment';
import apiClient from '@/utils/axios';

// 300成长 vs 300价值 对比图
const chartName = '300成长 vs 300价值';
const dateKey = '日期';
const closeKey = '收盘';
const growthName = '300成长';
const valueName = '300价值';
const ratioName = `${growthName}/${valueName}`;
const sampleRate = 5; // 抽样率（对齐后统一抽样，保证左右轴日期一致）

interface CsindexItem {
  日期: string;
  收盘: number;
  指数代码: string;
  指数中文简称: string;
}

interface ChartItem {
  date: string;
  key: string;
  label: string;
  value: number;
}

// 请求指数历史数据
const fetchIndexHist = async (symbol: string): Promise<CsindexItem[]> => {
  const response = await apiClient.get('/api/public/stock_zh_index_hist_csindex', {
    params: {
      symbol,
      start_date: '20041231',
      end_date: moment().format('YYYYMMDD'),
    },
  });
  return response?.data || [];
};

const GrowthVsValue: React.FC = () => {
  const [data, setData] = useState<{ leftData: ChartItem[]; rightData: ChartItem[] }>({
    leftData: [],
    rightData: [],
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [growthList, valueList] = await Promise.all([
        fetchIndexHist('000918'),
        fetchIndexHist('000919'),
      ]);
      console.log(`${chartName} -> 300成长`, growthList);
      console.log(`${chartName} -> 300价值`, valueList);

      // 按日期建立映射，取两者日期的交集，确保日期对得上
      const growthMap = new Map(
        growthList
          .filter((item) => Number.isFinite(Number(item[closeKey])))
          .map((item) => [item[dateKey], Number(item[closeKey])]),
      );
      const valueMap = new Map(
        valueList
          .filter((item) => Number.isFinite(Number(item[closeKey])))
          .map((item) => [item[dateKey], Number(item[closeKey])]),
      );
      const dates = [...growthMap.keys()].filter((date) => valueMap.has(date)).sort();

      // 对齐后统一抽样
      const sampledDates = dates.filter((_, index) => index % sampleRate === 0);

      const leftData: ChartItem[] = sampledDates.flatMap((date) => [
        { date, key: 'growth', label: growthName, value: growthMap.get(date) as number },
        { date, key: 'value', label: valueName, value: valueMap.get(date) as number },
      ]);
      const rightData: ChartItem[] = sampledDates.map((date) => ({
        date,
        key: 'ratio',
        label: ratioName,
        value: (growthMap.get(date) as number) / (valueMap.get(date) as number),
      }));

      setData({ leftData, rightData });
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const config = useMemo(
    () => ({
      title: { title: chartName },
      xField: (d: { date: string }) => new Date(d.date),
      children: [
        {
          data: data.leftData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          axis: { y: { title: '指数收盘', style: { titleFill: '#5B8FF9' } } },
        },
        {
          data: data.rightData,
          type: 'line' as const,
          yField: 'value',
          colorField: 'label',
          shapeField: 'smooth' as const,
          axis: {
            y: {
              position: 'right' as const,
              title: ratioName,
              style: { titleFill: '#6c6868ff' },
            },
          },
        },
      ],
    }),
    [data],
  );

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      </div>
      <DualAxes {...config} />
    </Spin>
  );
};

export default GrowthVsValue;
