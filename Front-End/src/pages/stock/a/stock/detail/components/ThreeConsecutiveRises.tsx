import React, { useState, useEffect, useMemo } from 'react';
import { Line, Column } from '@ant-design/plots';
import { Table, Typography } from 'antd';
import moment from 'moment';
import { findThreeConsecutiveRises } from '@/utils/stockUtils';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  收盘: number;
  开盘: number;
  最高: number;
  最低: number;
  换手率?: number;
}

interface ThreeConsecutiveRisesProps {
  data: StockDetailData[];
}

const ThreeConsecutiveRisesComponent: React.FC<ThreeConsecutiveRisesProps> = ({ data }) => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [riseData, setRiseData] = useState<any[]>([]);

  useEffect(() => {
    if (data.length > 0) {
      const threeConsecutiveRises = findThreeConsecutiveRises({ rawData: data });
      console.log('111 threeConsecutiveRises', threeConsecutiveRises);
      
      // 准备表格数据
      const tableData: any[] = [];
      
      // 参考 RsiFilterMark 的 rsiAnnotations 实现
      const riseAnnotations: any[] = [];
      threeConsecutiveRises.forEach((item, index) => {
        item.data.forEach((dataPoint, dataIndex) => {
          riseAnnotations.push({
            type: 'text',
            data: [new Date(dataPoint.日期), dataPoint.收盘],
            style: {
              text: '●',
              fontSize: 6,
              dx: -3,
              stroke: '#ff4d4f',
              fill: '#ff4d4f',
            },
          });
          
          // 添加表格数据
          tableData.push({
            key: `${index}-${dataIndex}`,
            groupIndex: index + 1,
            dayIndex: dataIndex + 1,
            日期: dataPoint.日期,
            开盘: dataPoint.开盘,
            收盘: dataPoint.收盘,
            最高: dataPoint.最高,
            最低: dataPoint.最低,
            换手率: dataPoint.换手率,
          });
        });
      });

      setAnnotations(riseAnnotations);
      setRiseData(tableData);
    }
  }, [data]);

  // 表格列定义
  const columns = useMemo(() => [
    {
      title: '组别',
      dataIndex: 'groupIndex',
      key: 'groupIndex',
      width: 60,
    },
    {
      title: '第几天',
      dataIndex: 'dayIndex',
      key: 'dayIndex',
      width: 70,
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      render: (text: string) => moment(text).format('YYYY-MM-DD'),
    },
    {
      title: '开盘价',
      dataIndex: '开盘',
      key: '开盘',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '收盘价',
      dataIndex: '收盘',
      key: '收盘',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '最高价',
      dataIndex: '最高',
      key: '最高',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '最低价',
      dataIndex: '最低',
      key: '最低',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '换手率(%)',
      dataIndex: '换手率',
      key: '换手率',
      render: (value: number) => value?.toFixed(2),
    },
  ], []);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  // 参考 PriceAndTurnover 的 sharedConfig
  const sharedConfig = {
    data,
    xField: (d: any) => new Date(d.日期),
    axis: {
      x: false,
    },
    height: 300,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Title level={5}>三连阳数据</Title>
      <Table
        dataSource={riseData}
        columns={columns}
        pagination={false}
        style={{ marginBottom: '16px' }}
        scroll={{ x: 'max-content' }}
      />
      <div style={{ height: 400 }}>
        <h4>收盘价趋势</h4>
        <Line
          {...sharedConfig}
          yField="收盘"
          smooth={true}
          yAxis={{
            title: {
              text: '收盘价',
            },
          }}
          tooltip={{
            title: (d: any) => moment(d.日期).format('YYYY-MM-DD'),
            items: [
              { field: '收盘', name: '收盘价' },
              { field: '开盘', name: '开盘价' },
              { field: '最高', name: '最高价' },
              { field: '最低', name: '最低价' },
            ],
          }}
          annotations={annotations}
          lineStyle={{
            lineWidth: 2,
          }}
        />
      </div>
      <div style={{ height: 400 }}>
        <h4>换手率趋势</h4>
        <Column
          {...sharedConfig}
          yField="换手率"
          yAxis={{
            title: {
              text: '换手率 (%)',
            },
          }}
          tooltip={{
            title: (d: any) => moment(d.日期).format('YYYY-MM-DD'),
            items: [
              { field: '换手率', name: '换手率(%)' },
            ],
          }}
          columnStyle={{
            fill: '#1890ff',
          }}
        />
      </div>
    </div>
  );
};

export default ThreeConsecutiveRisesComponent;
