import React from 'react';
import { Area } from '@ant-design/plots';
import moment from 'moment';

interface StockDetailData {
  日期: string;
  换手率: number;
}

interface TurnoverTrendProps {
  data: StockDetailData[];
}

const TurnoverTrend: React.FC<TurnoverTrendProps> = ({ data }) => {
  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  const turnoverRates = data.map(d => d.换手率).sort((a, b) => a - b);
  const lowThreshold = turnoverRates[Math.floor(turnoverRates.length * 0.1)];
  const highThreshold = turnoverRates[Math.floor(turnoverRates.length * 0.9)];

  const processedData = data.map(item => {
    let turnoverLevel = 'normal';
    if (item.换手率 <= lowThreshold) {
      turnoverLevel = 'low';
    } else if (item.换手率 >= highThreshold) {
      turnoverLevel = 'high';
    }
    return {
      ...item,
      turnoverLevel
    };
  });

  return (
    <div style={{ height: 450 }}>
      <Area
        data={processedData}
        xField="日期"
        yField="换手率"
        colorField="turnoverLevel"
        xAxis={{
          type: 'time',
          tickFormatter: (value: string) => moment(value).format('YYYYMMDD'),
        }}
        yAxis={{
          title: {
            text: '换手率 (%)',
          },
        }}
        tooltip={{
          title: (d: any) => moment(d.日期).format('YYYYMMDD'),
          items: [
            { field: '换手率', name: '换手率' },
            {
              field: 'turnoverLevel',
              name: '换手率水平',
              formatter: (value: string) => {
                switch (value) {
                  case 'low': return `低换手 (≤ ${lowThreshold.toFixed(2)}%)`;
                  case 'high': return `高换手 (≥ ${highThreshold.toFixed(2)}%)`;
                  default: return `正常换手 (${(lowThreshold + 0.01).toFixed(2)}% - ${(highThreshold - 0.01).toFixed(2)}%)`;
                }
              }
            }
          ],
        }}
        legend={{
          position: 'top',
          items: [
            { value: 'low', name: `低换手 (后10%) ≤ ${lowThreshold.toFixed(2)}%` },
            { value: 'normal', name: '正常换手' },
            { value: 'high', name: `高换手 (前10%) ≥ ${highThreshold.toFixed(2)}%` }
          ]
        }}
      />
    </div>
  );
};

export default TurnoverTrend;