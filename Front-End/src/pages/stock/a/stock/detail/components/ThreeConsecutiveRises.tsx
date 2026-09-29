import React, { useMemo, memo } from 'react';
import { Line, Column } from '@ant-design/plots';
import { Table, Typography } from 'antd';
import moment from 'moment';
import { findThreeConsecutiveRises } from '@/utils/stockUtils';

const { Title } = Typography;

interface StockDetailData {
  日期: string;
  股票代码: string;
  开盘: number;
  收盘: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  振幅?: number;
  涨跌幅?: number;
  涨跌额?: number;
  换手率?: number;
}

interface ThreeConsecutiveRisesProps {
  data: StockDetailData[];
}

interface TableRecord {
  key: string;
  groupIndex: number;
  startDate: string;
  endDate: string;
  dayDetails: SubTableRecord[];
}

interface SubTableRecord {
  key: string;
  dayIndex: number;
  日期: string;
  开盘: number;
  收盘: number;
  最高: number;
  最低: number;
  换手率?: number;
}

// 静态样式配置
const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const chartStyle: React.CSSProperties = { height: 400 };
const tableStyle: React.CSSProperties = { marginBottom: '16px' };

// 父表格列配置
const columns = [
  {
    title: '组别',
    dataIndex: 'groupIndex',
    key: 'groupIndex',
    width: 120,
    render: (text: number, record: TableRecord) => {
      // 防御性检查：确保 groupIndex 存在
      const groupIndex = record?.groupIndex ?? text ?? 0;
      const childrenCount = record?.dayDetails?.length ?? 0;
      return `第 ${groupIndex} 组 (${childrenCount} 天)`;
    },
  },
  {
    title: '开始日期',
    dataIndex: 'startDate',
    key: 'startDate',
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
  {
    title: '结束日期',
    dataIndex: 'endDate',
    key: 'endDate',
    render: (text: string) => moment(text).format('YYYY-MM-DD'),
  },
];

// 子表格列配置
const subColumns = [
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
];

// 图表共享配置 - 静态部分
const baseChartConfig = {
  xField: (d: any) => new Date(d.日期),
  axis: { x: false },
  height: 300,
};

const ThreeConsecutiveRisesComponent: React.FC<ThreeConsecutiveRisesProps> = ({ data }) => {
  // 使用 useMemo 缓存所有计算结果
  const { annotations, riseData, chartData } = useMemo(() => {
    if (data.length === 0) {
      return { annotations: [], riseData: [], chartData: [] };
    }

    const threeConsecutiveRises = findThreeConsecutiveRises({ rawData: data });
    
    const tableData: TableRecord[] = [];
    const riseAnnotations: any[] = [];
    
    // 优化循环，减少中间变量
    for (let i = 0; i < threeConsecutiveRises.length; i++) {
      const item = threeConsecutiveRises[i];
      const itemData = item.data;
      
      // 创建父级行数据
      const groupData: TableRecord = {
        key: `group-${i}`,
        groupIndex: i + 1,
        startDate: itemData[0]?.日期 || '',
        endDate: itemData[itemData.length - 1]?.日期 || '',
        dayDetails: [],
      };
      
      for (let j = 0; j < itemData.length; j++) {
        const dataPoint = itemData[j];
        
        // 添加标注
        riseAnnotations.push({
          type: 'text' as const,
          data: [new Date(dataPoint.日期), dataPoint.收盘],
          style: {
            text: '●',
            fontSize: 6,
            dx: -3,
            stroke: '#ff4d4f',
            fill: '#ff4d4f',
          },
        });
        
        // 添加子表格数据
        groupData.dayDetails.push({
          key: `${i}-${j}`,
          dayIndex: j + 1,
          日期: dataPoint.日期,
          开盘: dataPoint.开盘,
          收盘: dataPoint.收盘,
          最高: dataPoint.最高,
          最低: dataPoint.最低,
          换手率: dataPoint.换手率,
        });
      }
      
      tableData.push(groupData);
    }

    return {
      annotations: riseAnnotations,
      riseData: tableData,
      chartData: data,
    };
  }, [data]);

  // 缓存图表配置
  const lineConfig = useMemo(() => ({
    ...baseChartConfig,
    data: chartData,
    yField: '收盘',
    smooth: true,
    yAxis: {
      title: { text: '收盘价' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYY-MM-DD'),
      items: [
        { field: '收盘', name: '收盘价' },
        { field: '开盘', name: '开盘价' },
        { field: '最高', name: '最高价' },
        { field: '最低', name: '最低价' },
      ],
    },
    annotations,
    lineStyle: { lineWidth: 2 },
  }), [chartData, annotations]);

  const columnConfig = useMemo(() => ({
    ...baseChartConfig,
    data: chartData,
    yField: '换手率',
    yAxis: {
      title: { text: '换手率 (%)' },
    },
    tooltip: {
      title: (d: any) => moment(d.日期).format('YYYY-MM-DD'),
      items: [{ field: '换手率', name: '换手率(%)' }],
    },
    columnStyle: { fill: '#1890ff' },
  }), [chartData]);

  if (data.length === 0) {
    return <div>暂无数据</div>;
  }

  return (
    <div style={containerStyle}>
      <Title level={5}>三连阳数据</Title>
      <Table
        dataSource={riseData}
        columns={columns}
        expandable={{
          expandedRowRender: (record: TableRecord) => (
            <Table
              dataSource={record.dayDetails || []}
              columns={subColumns}
              pagination={false}
              size="small"
              rowKey="key"
            />
          ),
          defaultExpandAllRows: false,
        }}
        pagination={false}
        style={tableStyle}
        scroll={{ x: 'max-content' }}
        rowKey="key"
      />
      <div style={chartStyle}>
        <h4>收盘价趋势</h4>
        <Line {...lineConfig} />
      </div>
      <div style={chartStyle}>
        <h4>换手率趋势</h4>
        <Column {...columnConfig} />
      </div>
    </div>
  );
};

export default memo(ThreeConsecutiveRisesComponent);
