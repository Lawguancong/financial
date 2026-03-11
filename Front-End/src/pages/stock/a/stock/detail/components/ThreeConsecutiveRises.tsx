import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/plots';
import moment from 'moment';
import { findThreeConsecutiveRises } from '@/utils/stockUtils';

interface StockDetailData {
  日期: string;
  收盘: number;
  开盘: number;
  最高: number;
  最低: number;
}

interface ThreeConsecutiveRisesProps {
  data: StockDetailData[];
}

const ThreeConsecutiveRisesComponent: React.FC<ThreeConsecutiveRisesProps> = ({ data }) => {
  const [annotations, setAnnotations] = useState<any[]>([]);

  useEffect(() => {
    if (data.length > 0) {
      const threeConsecutiveRises = findThreeConsecutiveRises({ rawData: data });
      
      const riseAnnotations = [];
      threeConsecutiveRises.forEach((item, index) => {
        item.data.forEach((dataPoint, dataIndex) => {
          riseAnnotations.push({
            type: 'point',
            position: [dataPoint.日期, dataPoint.收盘],
            style: {
              stroke: '#4daf4a',
              fill: '#4daf4a',
              r: 6,
            },
            label: {
              content: dataIndex === 0 ? `三连阳 ${index + 1}` : '',
              position: 'top',
              style: {
                fill: '#4daf4a',
              },
            },
          });
        });
      });
      
      setAnnotations(riseAnnotations);
    }
  }, [data]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={{ height: 450 }}>
      <Line
        data={data}
        xField="日期"
        yField="收盘"
        smooth={true}
        xAxis={{
          type: 'time',
          tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
        }}
        yAxis={{
          title: {
            text: '收盘价',
          },
        }}
        tooltip={{
          title: (d: any) => moment(d.日期).format('YYYYMMDD'),
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
  );
};

export default ThreeConsecutiveRisesComponent;