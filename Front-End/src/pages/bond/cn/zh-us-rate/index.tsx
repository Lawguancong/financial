import { Line } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const Bond_zh_us_rate = () => {
  const chartName = '中美国债收益率';
  const dateKey = '日期';
  const sampleRate = 30;

  // 所有收益率 / 增速字段（统一展示在一个 Line 图中）
  const lineKeys: Record<string, string> = {
    '中国国债收益率2年': '中国国债收益率2年（%）',
    '中国国债收益率5年': '中国国债收益率5年（%）',
    '中国国债收益率10年': '中国国债收益率10年（%）',
    '中国国债收益率30年': '中国国债收益率30年（%）',
    '中国国债收益率10年-2年': '中国10Y-2Y利差（%）',
    '中国GDP年增率': '中国GDP年增率（%）',
    '美国国债收益率2年': '美国国债收益率2年（%）',
    '美国国债收益率5年': '美国国债收益率5年（%）',
    '美国国债收益率10年': '美国国债收益率10年（%）',
    '美国国债收益率30年': '美国国债收益率30年（%）',
    '美国国债收益率10年-2年': '美国10Y-2Y利差（%）',
    '美国GDP年增率': '美国GDP年增率（%）',
  };

  const [data, setData] = useState<{ date: string; value: number | null; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/bond_zh_us_rate', {
        params: { start_date: '19901219' }, // 最早只能从1990年12月19日开始获取数据
      });
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
      console.error('获取中美国债收益率数据失败:', error);
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
      subtitle: '中美国债收益率与 GDP 增速对比',
    },
    data,
    xField: (d: { date: string }) => new Date(d.date),
    yField: 'value',
    colorField: 'label',
    shapeField: 'smooth' as const,
    scale: {
      color: {
        range: [
          '#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A',
          '#9270CA', '#6FB5E0',
          '#FF9D4D', '#269A99', '#9FB40F', '#BDD2FD',
          '#C1232B', '#E2C834',
        ],
      },
    },
    axis: {
      y: {
        title: '收益率 / 增速（%）',
      },
    },
    // slider: { x: { values: [0, 1] } },
    tooltip: { showMarkers: true, shared: true },
    legend: { color: { position: 'right' as const } },
    style: { lineWidth: 1 },
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

export default Bond_zh_us_rate;
