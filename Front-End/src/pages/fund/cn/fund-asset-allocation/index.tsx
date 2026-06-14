import { DualAxes } from '@ant-design/plots';
import { useEffect, useState } from 'react';
import { pick } from 'lodash-es';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const Fund_report_asset_allocation_cninfo = () => {
  const chartName = '基金资产配置';
  const dateKey = '报告期';
  const dateName = '报告期';

  // 左轴：基金规模数据
  const leftKey = '基金市场净资产规模';
  const leftName = '基金市场净资产规模（亿元）';

  // 右轴：百分比数据
  const rightKeys = {
    '股票权益类占净资产比例': '股票权益类（%）',
    '债券固定收益类占净资产比例': '债券固定收益类（%）',
    '现金货币类占净资产比例': '现金货币类（%）',
  };

  // 基金覆盖家数单独处理，不在图表中展示，但可以在tooltip中显示
  const sampleRate = 1;

  type DataRes = {
    [dateKey]: string;
    [leftKey]: number;
  } & {
    [K in keyof typeof rightKeys]: number;
  } & {
    '基金覆盖家数': number;
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
      const response = await apiClient.get('/api/public/fund_report_asset_allocation_cninfo');
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
      subtitle: '基金市场资产配置趋势',
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

export default Fund_report_asset_allocation_cninfo;
