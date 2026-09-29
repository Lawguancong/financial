import React, { useEffect, useState } from 'react';
import { DualAxes } from '@ant-design/plots';
import { Select } from 'antd';
import apiClient from '@/utils/axios';

interface BelowNetAssetItem {
  date: string;
  below_net_asset: number;
  total_company: number;
  below_net_asset_ratio: number;
}

const StockBelowNetAssetLg = ({ key }: { key: number }) => {
  const chartName = '破净股统计';
  const dateKey = 'date';
  const symbolMap: Record<string, string> = {
    "全部A股": "全部A股",
    "上证50": "上证50",
    "沪深300": "沪深300",
    "中证500": "中证500"
  };
  const [symbol, setSymbol] = useState<string>('全部A股');
  const [data, setData] = useState<BelowNetAssetItem[]>([]);

  const fetchData = async () => {
    const res: { data?: BelowNetAssetItem[] } = await apiClient.get(
      `/api/public/stock_a_below_net_asset_statistics?symbol=${symbolMap[symbol]}`,
    );
    const list: BelowNetAssetItem[] = Array.isArray(res?.data) ? res.data : [];
    setData(list);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, key]);

  console.log(`${chartName} ->`, symbol, data);

  const leftData = data.map((item) => ({
    [dateKey]: item.date,
    value: Number(item.below_net_asset ?? 0),
    type: '破净股家数',
  })).concat(data.map((item) => ({
    [dateKey]: item.date,
    value: Number(item.total_company ?? 0),
    type: '总公司数',
  })));

  const rightData = data.map((item) => ({
    [dateKey]: item.date,
    value: Number(item.below_net_asset_ratio ?? 0),
    type: '破净股比率(%)',
  }));

  const config = {
    title: {
      title: '破净股统计',
      subtitle: `${symbol} - 破净股家数 / 总公司数 / 破净股比率`,
    },
    xField: dateKey,
    legend: true,
    scale: { color: { range: ['#F6BD16', '#5B8FF9', '#F4664A'] } },
    children: [
      {
        data: leftData,
        type: 'line',
        shapeField: 'smooth',
        yField: 'value',
        colorField: 'type',
        axis: {
          y: {
            position: 'left',
            title: '家数',
            style: { titleFill: '#5B8FF9' },
          },
        },
      },
      {
        data: rightData,
        type: 'line',
        shapeField: 'smooth',
        yField: 'value',
        colorField: 'type',
        axis: {
          y: {
            position: 'right',
            title: '比率(%)',
            style: { titleFill: '#F4664A' },
          },
        },
      },
    ],
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>指数：</span>
        <Select
          value={symbol}
          onChange={setSymbol}
          style={{ width: 160 }}
          options={Object.keys(symbolMap).map(s => ({ label: s, value: s }))}
        />
      </div>
      <DualAxes {...config} />
    </>
  );
};

export default StockBelowNetAssetLg;