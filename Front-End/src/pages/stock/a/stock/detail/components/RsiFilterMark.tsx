import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/plots';
import { Table, Typography } from 'antd';
import moment from 'moment';
import { calculateRSI, convertToKLine, filterKLineByRSI } from '@/utils/stockUtils';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  收盘: number;
  开盘: number;
  最高: number;
  最低: number;
}

interface RsiFilterMarkProps {
  data: StockDetailData[];
}

const RsiFilterMark: React.FC<RsiFilterMarkProps> = ({ data }) => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [filteredByRSI, setFilteredByRSI] = useState<any[]>([]);

  useEffect(() => {
    if (data.length > 0) {
      const weeklyData = convertToKLine({ dailyData: data, period: 'weekly' });
      const monthlyData = convertToKLine({ dailyData: data, period: 'monthly' });
      const quarterlyData = convertToKLine({ dailyData: data, period: 'quarterly' });

      const dailyRSIData = calculateRSI({ data, closeKey: '收盘', period: 6 });
      const weeklyRSIData = calculateRSI({ data: weeklyData, closeKey: '收盘', period: 6 });
      const monthlyRSIData = calculateRSI({ data: monthlyData, closeKey: '收盘', period: 6 });
      const quarterlyRSIData = calculateRSI({ data: quarterlyData, closeKey: '收盘', period: 6 });

      const filteredByRSI = filterKLineByRSI({
        dailyData: dailyRSIData,
        weeklyData: weeklyRSIData,
        monthlyData: monthlyRSIData,
        quarterlyData: quarterlyRSIData,
        rsiThreshold: 28,
      });

      // const rsiAnnotations = filteredByRSI.map(item => ({
      //   type: 'point',
      //   position: [item.日期, item.收盘],
      //   style: {
      //     stroke: '#ff4d4f',
      //     fill: '#ff4d4f',
      //     r: 6,
      //   },
      //   label: {
      //     content: 'RSI 过滤',
      //     position: 'top',
      //     style: {
      //       fill: '#ff4d4f',
      //     },
      //   },
      // }));
      const rsiAnnotations = filteredByRSI.map(item => ({
        type: 'text',
        data: [new Date(item.日期), item.收盘],
        style: {
          // todo 纠正位置
          text: '●',
          fontSize: 6,
          dx: -3,
          stroke: '#ff4d4f',
          fill: '#ff4d4f',
          // r: 6,
        },
        // label:'12312312321'
        // label: {
        //   content: 'RSI 过滤',
        //   position: 'top',
        //   style: {
        //     fill: '#ff4d4f',
        //   },
        // },
      }));
      console.log('1111 filteredByRSI', filteredByRSI);
      console.log('1111 rsiAnnotations', rsiAnnotations);
      setFilteredByRSI(filteredByRSI);
      setAnnotations(rsiAnnotations);
    }
  }, [data]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  const columns = [
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      render: (text: string) => moment(text).format('YYYY-MM-DD'),
    },
    {
      title: '收盘价',
      dataIndex: '收盘',
      key: '收盘',
    },
    {
      title: '日RSI6',
      dataIndex: '__RSI6__',
      key: '__RSI6__',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '周RSI6',
      dataIndex: '__weeklyRSI6__',
      key: '__weeklyRSI6__',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '月RSI6',
      dataIndex: '__monthlyRSI6__',
      key: '__monthlyRSI6__',
      render: (value: number) => value?.toFixed(2),
    },
    {
      title: '季RSI6',
      dataIndex: '__quarterlyRSI6__',
      key: '__quarterlyRSI6__',
      render: (value: number) => value?.toFixed(2),
    },
  ];

  return (
    <div>
      <Title level={5}>推荐买点</Title>
      {/* todo */}
      <Table
        dataSource={filteredByRSI}
        columns={columns}
        rowKey="日期"
        pagination={false}
        style={{ marginBottom: '16px' }}
      />
      <Title level={5}>RSI 过滤日期标记</Title>
      <div style={{ height: 450 }}>
        <Line
          data={data}
          xField={(d: any) => new Date(d.日期)}
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
    </div>
  );
};

export default RsiFilterMark;