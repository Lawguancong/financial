import { Line } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const Energy_oil_hist = () => {
  const chartName = '中国油价';
  const dateKey = '调整日期';
  const sampleRate = 1;

  // 多系列字段配置：字段名 -> 显示标签
  const lineKeys: Record<string, string> = {
    汽油价格: '汽油价格（元/吨）',
    柴油价格: '柴油价格（元/吨）',
  };

  const [data, setData] = useState<{ date: string; value: number | null; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/energy_oil_hist');
      console.log(`${chartName} -> response`, response);

      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const dataFormat = rawData
          .filter((_: unknown, index: number) => index % sampleRate === 0)
          .flatMap((item: Record<string, unknown>) =>
            Object.keys(lineKeys).map((key) => {
              const raw = item[key];
              const numeric = raw === null || raw === undefined || raw === '' || raw === 'null' || raw === 'NaN'
                ? null
                : Number(raw);
              return {
                date: String(item[dateKey] || ''),
                value: numeric === null || isNaN(numeric) ? null : numeric,
                label: lineKeys[key],
              };
            }),
          );

        setData(dataFormat);
      }
    } catch (error) {
      console.error('获取中国油价数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const config = {
    title: {
      title: chartName,
      subtitle: '国内成品油价格历次调整',
    },
    data,
    xField: (d: { date: string }) => new Date(d.date),
    yField: 'value',
    colorField: 'label',
    shapeField: 'smooth' as const,
    scale: {
      color: {
        range: ['#5B8FF9', '#E8684A'],
      },
    },
    axis: {
      y: {
        title: '价格（元/吨）',
      },
    },
    // slider: { x: { values: [0, 1] } },
    tooltip: { showMarkers: true, shared: true },
    legend: { color: { position: 'top' as const } },
    style: { lineWidth: 2 },
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      </div>
      <Line {...config} />
    </>
  );
};

export default Energy_oil_hist;
