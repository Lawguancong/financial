import { DualAxes } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { pick } from 'lodash-es';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const Fund_scale_change_em = () => {
  const chartName = '基金规模变动';
  const dateKey = '截止日期';
  const dateName = '截止日期';

  // 左轴：期末净资产（亿元）
  const leftKey = '期末净资产';
  const leftName = '期末净资产（亿元）';

  // 右轴：基金家数（只）
  const rightKeys = {
    基金家数: '基金家数',
    期间申购: '期间申购(亿份)',
    期间赎回: '期间赎回(亿份)',
    期末总份额: '期末总份额(亿份)',
  }


  const sampleRate = 1;

  type DataRes = {
    [dateKey]: string;
    [leftKey]: number;
  } & {
    [K in keyof typeof rightKeys]: number;
  } & {
    '基金家数': number;
  };

  const labelMap = {
    [dateKey]: dateName,
    [leftKey]: leftName,
    ...rightKeys,
  };

  const [data, setData] = useState<{
    leftData: DataRes[];
    rightData: {
      date: string;
      key: string;
      value: number;
    }[];
  }>({ leftData: [], rightData: [] });

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/api/public/fund_scale_change_em');
      console.log(`${chartName} -> response`, response);

      const dataFormat = response?.data
        ?.filter((_: unknown, index: number) => index % sampleRate === 0)
        ?.map((item: DataRes) =>
          Object.keys(pick(item, Object.keys({ [leftKey]: leftName, ...rightKeys }))).map((key) => ({
            date: item[dateKey],
            key,
            label: labelMap[key as keyof typeof labelMap],
            value: item[key as keyof DataRes],
          })),
        )
        .flat();

      setData({
        leftData: dataFormat?.filter((item: { key: string }) => item.key === leftKey),
        rightData: dataFormat?.filter((item: { key: string }) => item.key !== leftKey),
      });
    } catch (error) {
      console.log('error', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  console.log(`${chartName} -> data`, data);

  const config = {
    title: {
      title: chartName,
      subtitle: '基金市场规模变动趋势',
    },
    xField: (d: { date: string }) => new Date(d.date),
    // legend: {
    //   color: {
    //     title: '',
    //     position: 'right' as const,
    //   },
    // },
    children: [
      {
        data: data.leftData,
        type: 'line' as const,
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth' as const,
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
        data: data.rightData,
        type: 'line' as const,
        yField: 'value',
        colorField: 'label',
        shapeField: 'smooth' as const,
        axis: {
          y: {
            position: 'right' as const,
             title: '占比（%）',
            style: { titleFill: '#6c6868ff' },
          },
        },
      },
    ],
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>
          刷新数据
        </Button>
      </div>
      <DualAxes {...config} />
    </>
  );
};

export default Fund_scale_change_em;
