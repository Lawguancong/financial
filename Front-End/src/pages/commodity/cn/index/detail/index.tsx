import React, { useEffect, useState, useMemo } from 'react';
import { Button, Typography, Alert, Card, Spin } from 'antd';
import { useLocation } from 'react-router-dom';
import { DualAxes, Line } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import { calculateRSI } from '@/utils';

// todo 优化 统一 周期K线转化
// 封装K线转换方法
const convertKlineData = (data: any[], options: {
  period: 'week' | 'month' | 'quarter';
  dateField: string;
  fields: {
    open: string;
    high: string;
    low: string;
    close: string;
  };
}) => {
  const { period, dateField, fields } = options;

  // 按周期分组
    const groupedData = data.reduce((groups: any, item) => {
      const date = new Date(item[dateField]);
      let key: string;
      
      switch (period) {
        case 'week':
          // 获取本周的开始日期（周一）作为分组键
          const dayOfWeek = date.getDay() || 7; // 将周日(0)转换为7
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - dayOfWeek + 1);
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          // 按年月分组
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarter':
          // 按年季度分组
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
    
    // 计算每个周期的K线数据
    return Object.entries(groupedData).map(([key, items]: [string, any[]]) => {
      // 按日期排序
      items.sort((a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime());
      
      // 计算周期K线数据
      const open = Number(items[0][fields.open]);
      const close = Number(items[items.length - 1][fields.close]);
      const high = Math.max(...items.map(item => Number(item[fields.high])));
      const low = Math.min(...items.map(item => Number(item[fields.low])));
      
      // 计算周期的最后一天作为date字段
      let date: string;
      const lastItemDate = new Date(items[items.length - 1][dateField]);
      
      switch (period) {
        case 'week':
          // 周K线取最后一天（周日）
          date = lastItemDate.toISOString().split('T')[0];
          break;
        case 'month':
          // 月K线取最后一天
          date = lastItemDate.toISOString().split('T')[0];
          break;
        case 'quarter':
          // 季K线取最后一天
          date = lastItemDate.toISOString().split('T')[0];
          break;
        default:
          date = lastItemDate.toISOString().split('T')[0];
      }
      
      return {
        date,
        open,
        close,
        high,
        low,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};


const { Title } = Typography;

interface CommodityDetailData {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
}

const Detail: React.FC = () => {
  const location = useLocation();
  const [symbol, setSymbol] = useState<string>('');
  const [data, setData] = useState<CommodityDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const dataFormat = useMemo(() => {
    const weekKlineData = convertKlineData(data, {
      period: 'week',
      dateField: 'date',
      fields: {
        open: 'open',
        high: 'high',
        low: 'low',
        close: 'close'
      }
    });
    const monthKlineData = convertKlineData(data, {
      period: 'month',
      dateField: 'date',
      fields: {
        open: 'open',
        high: 'high',
        low: 'low',
        close: 'close'
      }
    });
    const quarterKlineData = convertKlineData(data, {
      period: 'quarter',
      dateField: 'date',
      fields: {
        open: 'open',
        high: 'high',
        low: 'low',
        close: 'close'
      }
    });
    // 计算不同周期的RSI
    const dailyRSIData = calculateRSI({ data: data, closeKey: 'close', period: 6 });
    const weeklyRSIData = calculateRSI({ data: weekKlineData, closeKey: 'close', period: 6 });
    const monthlyRSIData = calculateRSI({ data: monthKlineData, closeKey: 'close', period: 6 });
    const quarterlyRSIData = calculateRSI({ data: quarterKlineData, closeKey: 'close', period: 6 });

    return {
      KLineData: {
        weekKlineData,
        monthKlineData,
        quarterKlineData,
      },
      RSIData: {
        dailyRSIData,
        weeklyRSIData,
        monthlyRSIData,
        quarterlyRSIData
      }
    }
  }, [data]);

  console.log('dataFormat', dataFormat);

  // 解析URL参数
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      setSymbol(symbolParam);
    }
  }, [location.search]);

  // 品种代码到中文名称的映射
  const getCommodityName = (code: string): string => {
    const nameMap: Record<string, string> = {
      'Au99.99': '黄金99.99',
      'Au99.95': '黄金99.95',
      'Au100g': '黄金100克',
      'Pt99.95': '铂金99.95',
      'Ag(T+D)': '白银(T+D)',
      'Au(T+D)': '黄金(T+D)',
      'mAu(T+D)': '迷你黄金(T+D)',
      'Au(T+N1)': '黄金(T+N1)',
      'Au(T+N2)': '黄金(T+N2)',
      'Ag99.99': '白银99.99',
      'iAu99.99': '国际板黄金99.99',
      'Au99.5': '黄金99.5',
      'iAu100g': '国际板黄金100克',
      'iAu99.5': '国际板黄金99.5',
      'PGC30g': '钯金30克',
      'NYAuTN06': '纽约金TN06',
      'NYAuTN12': '纽约金TN12'
    };
    return nameMap[code] || code;
  };


  const fetchData = async () => {
    if (!symbol) {
      setError('请选择一个品种');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/public/spot_hist_sge', {
        params: { symbol }
      });
      console.log('大宗商品详情 -> response', response);
      const responseData = response?.data || [];


      setData(responseData);
    } catch (error) {
      console.log('error', error);
      setError('获取数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol]);

  // 准备图表数据
  const chartData = useMemo(() => {
    return data.map(item => ({
      date: new Date(item.date),
      open: item.open,
      close: item.close,
      low: item.low,
      high: item.high
    }));
  }, [data]);

  // 准备周K线图表数据
  const weekChartData = useMemo(() => {
    return dataFormat.KLineData.weekKlineData.map(item => ({
      date: new Date(item.date),
      close: item.close
    }));
  }, [dataFormat]);

  // 准备月K线图表数据
  const monthChartData = useMemo(() => {
    return dataFormat.KLineData.monthKlineData.map(item => ({
      date: new Date(item.date),
      close: item.close
    }));
  }, [dataFormat]);

  // 准备季K线图表数据
  const quarterChartData = useMemo(() => {
    return dataFormat.KLineData.quarterKlineData.map(item => ({
      date: new Date(item.date),
      close: item.close
    }));
  }, [dataFormat]);

  // 准备RSI图表数据
  const dailyRSIChartData = useMemo(() => {
    return dataFormat.RSIData.dailyRSIData.map(item => ({
      date: new Date(item.date),
      rsi: item.__RSI6__
    }));
  }, [dataFormat]);

  const weeklyRSIChartData = useMemo(() => {
    return dataFormat.RSIData.weeklyRSIData.map(item => ({
      date: new Date(item.date),
      rsi: item.__RSI6__
    }));
  }, [dataFormat]);

  const monthlyRSIChartData = useMemo(() => {
    return dataFormat.RSIData.monthlyRSIData.map(item => ({
      date: new Date(item.date),
      rsi: item.__RSI6__
    }));
  }, [dataFormat]);

  const quarterlyRSIChartData = useMemo(() => {
    return dataFormat.RSIData.quarterlyRSIData.map(item => ({
      date: new Date(item.date),
      rsi: item.__RSI6__
    }));
  }, [dataFormat]);

  // 图表配置
  const config = useMemo(() => {
    return {
      title: {
        title: '价格走势（元/克）'
      },
      xField: 'date',
      children: [
        {
          data: chartData,
          type: 'line',
          yField: 'close',
          // colorField: 'close',
          shapeField: 'smooth',
          // style: {
          //   stroke: '#5B8FF9',
          //   lineWidth: 2,
          // },
          // axis: {
          //   y: {
          //     title: '收盘价',
          //     style: { titleFill: '#5B8FF9' },
          //   },
          // },
        },
      ],
    };
  }, [chartData]);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4}>{getCommodityName(symbol)} - 历史数据</Title>

      {/* {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          style={{ marginTop: '16px' }}
        />
      )} */}

      <div style={{ marginTop: '16px', textAlign: 'right' }}>
        <Button type="primary" onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      </div>

      <Spin spinning={loading}>
        <Card style={{ marginTop: '24px' }}>
          <DualAxes {...config} />
        </Card>

        {/* 周K线图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>周K线</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: weekChartData,
                type: 'line',
                yField: 'close',
                shapeField: 'smooth',
                style: {
                  stroke: '#5B8FF9',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: '收盘价',
                    style: { titleFill: '#5B8FF9' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 月K线图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>月K线</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: monthChartData,
                type: 'line',
                yField: 'close',
                shapeField: 'smooth',
                style: {
                  stroke: '#5AD8A6',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: '收盘价',
                    style: { titleFill: '#5AD8A6' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 季K线图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>季K线</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: quarterChartData,
                type: 'line',
                yField: 'close',
                shapeField: 'smooth',
                style: {
                  stroke: '#F5A623',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: '收盘价',
                    style: { titleFill: '#F5A623' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 日K线RSI图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>日K线 RSI6</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: dailyRSIChartData,
                type: 'line',
                yField: 'rsi',
                shapeField: 'smooth',
                style: {
                  stroke: '#5B8FF9',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: 'RSI6',
                    style: { titleFill: '#5B8FF9' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 周K线RSI图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>周K线 RSI6</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: weeklyRSIChartData,
                type: 'line',
                yField: 'rsi',
                shapeField: 'smooth',
                style: {
                  stroke: '#5AD8A6',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: 'RSI6',
                    style: { titleFill: '#5AD8A6' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 月K线RSI图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>月K线 RSI6</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: monthlyRSIChartData,
                type: 'line',
                yField: 'rsi',
                shapeField: 'smooth',
                style: {
                  stroke: '#F5A623',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: 'RSI6',
                    style: { titleFill: '#F5A623' },
                  },
                },
              },
            ]}
          />
        </Card>

        {/* 季K线RSI图表 */}
        <Card style={{marginTop: '24px' }}>
          <Title level={5}>季K线 RSI6</Title>
          <DualAxes
            xField="date"
            children={[
              {
                data: quarterlyRSIChartData,
                type: 'line',
                yField: 'rsi',
                shapeField: 'smooth',
                style: {
                  stroke: '#722ED1',
                  lineWidth: 2,
                },
                axis: {
                  y: {
                    title: 'RSI6',
                    style: { titleFill: '#722ED1' },
                  },
                },
              },
            ]}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Detail;