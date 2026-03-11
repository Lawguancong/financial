import React, { useRef } from 'react';
import { Line, Column } from '@ant-design/plots';
import moment from 'moment';

interface StockDetailData {
  日期: string;
  收盘: number;
  换手率: number;
}

interface PriceAndTurnoverProps {
  data: StockDetailData[];
}

const CHART_MAP: any = {};

const PriceAndTurnover: React.FC<PriceAndTurnoverProps> = ({ data }) => {
  const dataRef = useRef(data);
  dataRef.current = data;

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  const sharedConfig = {
    data,
    // xField: (d) => moment(d.日期)?.format('YYYYMMDD'),
    xField: '日期',
    axis: {
      x: false,
    },
    height: 300,
    // xAxis: {
    //   type: 'time',
    //   tickFormatter: (value: any) => moment(value).format('YYYYMMDD'),
    // },
  };

  const showTooltip = (dataItem: StockDetailData) => {
    console.log('3333 showTooltip dataItem', dataItem);
    const { line, column } = CHART_MAP;
    if (line && column) {
      line.emit('tooltip:show', {
        data: { data: { x: dataItem.日期 } },
      });
      column.emit('tooltip:show', {
        data: { data: dataItem },
      });
    }
  };

  const hideTooltip = () => {
    const { line, column } = CHART_MAP;
    if (line) line.emit('tooltip:hide');
    if (column) column.emit('tooltip:hide');
  };

  const setTooltipPosition = (evt, chart) => {
    console.log('333 setTooltipPosition evt chart', evt, chart);
    const { x } = evt;
    const { layout } = chart.getView();
    // 根据位置粗略计算出 tooltip data
    const percent = x / layout.width;
    // showTooltip(dataRef.current[Math.floor(percent * dataRef.current.length)]);
    // showTooltip(dataRef.current[Math.ceil(percent * dataRef.current.length)]);
    showTooltip(dataRef.current[Math.round(percent * dataRef.current.length)]);

  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ height: 400 }}>
        <h4>收盘价趋势</h4>
        <Line
          {...sharedConfig}
          yField="收盘"
          smooth={true}
          // axis={
          //   { x: false, }
          // }
          yAxis={{
            title: {
              text: '收盘价',
            },
          }}
          tooltip={{
            title: (d: any) => moment(d.日期).format('YYYYMMDD'),
            items: [
              { field: '收盘', name: '收盘价' },
            ],
          }}
          lineStyle={{
            lineWidth: 2,
          }}
        // onReady={({ chart }) => {
        //   CHART_MAP['line'] = chart;
        //   chart.on('plot:pointermove', (evt: any) => {
        //     setTooltipPosition(evt, chart);
        //   });
        //   chart.on('plot:pointerout', hideTooltip);
        // }}
        />
      </div>
      <div style={{ height: 400 }}>
        <h4>换手率趋势</h4>
        <Column
          {...sharedConfig}
          yField="换手率"
          // axis={
          //   { x: false, }
          // }
          yAxis={{
            title: {
              text: '换手率 (%)',
            },
          }}
          tooltip={{
            title: (d: any) => moment(d.日期).format('YYYYMMDD'),
            items: [
              { field: '换手率', name: '换手率(%)' },
            ],
          }}
          columnStyle={{
            fill: '#1890ff',
          }}
        // onReady={({ chart }) => {
        //   CHART_MAP['column'] = chart;
        //   chart.on('plot:pointermove', (evt: any) => {
        //     setTooltipPosition(evt, chart);
        //   });
        //   chart.on('plot:pointerout', hideTooltip);
        // }}
        />
      </div>
    </div>
  );
};

export default PriceAndTurnover;