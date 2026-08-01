import { Line } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const Stock_hk_gxl_lg = () => {
  const chartName = '恒生指数股息率';
  const dateKey = '日期';
  const valueKey = '股息率';
  const sampleRate = 1;

  const [data, setData] = useState<{ date: string; value: number | null; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_hk_gxl_lg');
      console.log(`${chartName} -> response`, response);

      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const dataFormat = rawData
          .filter((_: unknown, index: number) => index % sampleRate === 0)
          .map((item: Record<string, unknown>) => {
            const raw = item[valueKey];
            const numeric = raw === null || raw === undefined || raw === '' || raw === 'null' || raw === 'NaN'
              ? null
              : Number(raw);
            return {
              date: String(item[dateKey] || ''),
              value: numeric === null || isNaN(numeric) ? null : numeric,
              label: chartName,
            };
          });

        setData(dataFormat);
      }
    } catch (error) {
      console.error('获取恒生指数股息率失败:', error);
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
      subtitle: '港股恒生指数历史股息率走势',
    },
    data,
    xField: (d: { date: string }) => new Date(d.date),
    yField: 'value',
    colorField: 'label',
    shapeField: 'smooth' as const,
    style: {
      stroke: '#5B8FF9',
      lineWidth: 2,
    },
    axis: {
      y: {
        title: '股息率（%）',
      },
    },
    // slider: { x: { values: [0, 1] } },
    tooltip: { showMarkers: true, shared: true },
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

export default Stock_hk_gxl_lg;
