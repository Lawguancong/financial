import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, DatePicker } from 'antd';
import { DualAxes } from '@ant-design/plots';
import { FundOutlined, CalendarOutlined, PieChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import apiClient from '@/utils/axios';

interface NewFundItem {
  基金代码: string;
  基金简称: string;
  发行公司: string;
  基金类型: string;
  集中认购期: string;
  募集份额: number;
  成立日期: string;
  成立来涨幅: number;
  基金经理: string;
  申购状态: string;
  优惠费率: number;
}

interface MonthlyData {
  month: string;
  yearMonth: string;
  新发基金数量: number;
  募集份额: number;
}

const { RangePicker } = DatePicker;

const FundNewIssue: React.FC = () => {
  const [data, setData] = useState<NewFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_new_found_em');
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map((item: Record<string, unknown>) => ({
          基金代码: String(item['基金代码'] || ''),
          基金简称: String(item['基金简称'] || ''),
          发行公司: String(item['发行公司'] || ''),
          基金类型: String(item['基金类型'] || ''),
          集中认购期: String(item['集中认购期'] || ''),
          募集份额: Number(item['募集份额']) || 0,
          成立日期: String(item['成立日期'] || ''),
          成立来涨幅: Number(item['成立来涨幅']) || 0,
          基金经理: String(item['基金经理'] || ''),
          申购状态: String(item['申购状态'] || ''),
          优惠费率: Number(item['优惠费率']) || 0,
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取新发基金数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 按年月分组统计
  const monthlyData = useMemo(() => {
    const filtered = dateRange
      ? data.filter(item => {
        const date = dayjs(item.成立日期);
        return date.isAfter(dayjs(dateRange[0])) && date.isBefore(dayjs(dateRange[1]).endOf('month'));
      })
      : data;

    const grouped = filtered.reduce((acc, item) => {
      if (!item.成立日期) return acc;
      const month = dayjs(item.成立日期).format('YYYY-MM');
      if (!acc[month]) {
        acc[month] = { month, yearMonth: month, 新发基金数量: 0, 募集份额: 0 };
      }
      acc[month].新发基金数量 += 1;
      acc[month].募集份额 += item.募集份额;
      return acc;
    }, {} as Record<string, MonthlyData>);

    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, dateRange]);

  // 统计
  const stats = useMemo(() => {
    return {
      totalFunds: monthlyData.reduce((sum, item) => sum + item.新发基金数量, 0),
      totalShares: monthlyData.reduce((sum, item) => sum + item.募集份额, 0),
      avgShares: monthlyData.length > 0
        ? monthlyData.reduce((sum, item) => sum + item.募集份额, 0) / monthlyData.length
        : 0,
      maxMonthlyFunds: monthlyData.length > 0
        ? Math.max(...monthlyData.map(item => item.新发基金数量))
        : 0,
    };
  }, [monthlyData]);

  // 图表配置
  const chartData = useMemo(() => {
    return monthlyData.map(item => ({
      date: item.yearMonth,
      count: item.新发基金数量,
      share: item.募集份额,
    }));
  }, [monthlyData]);

  const countData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.count,
    type: '新发基金数量',
  })), [chartData]);

  const shareData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.share,
    type: '募集份额(亿)',
  })), [chartData]);

  const config = {
    xField: 'date',
    xAxis: {
      label: {
        formatter: (v: string) => v,
        autoRotate: false,
      },
    },
    leftField: 'value',
    rightField: 'value',
    leftAxis: {
      title: {
        text: '新发基金数量',
        style: { fill: '#1890ff' },
      },
      label: {
        formatter: (v: number) => `${v}只`,
      },
    },
    rightAxis: {
      title: {
        text: '募集份额',
        style: { fill: '#52c41a' },
      },
      label: {
        formatter: (v: number) => `${v.toFixed(2)}亿`,
      },
    },
    children: [
      {
        data: countData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#1890ff',
        smooth: true,
        style: { lineWidth: 2 },
        axis: { y: { position: 'left' } },
        tooltip: {
          // formatter: (datum: { type: string; value: number }) => ({
          //   name: datum.type,
          //   value: `${datum.value}只`,
          // }),
        },
      },
      {
        data: shareData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#52c41a',
        smooth: true,
        style: { lineWidth: 2 },
        axis: { y: { position: 'right' } },
        tooltip: {
          // formatter: (datum: { type: string; value: number }) => ({
          //   name: datum.type,
          //   value: `${datum.value.toFixed(1)}亿`,
          // }),
          items: [
            {
              field: 'value',
              name: '募集份额（亿）',
              valueFormatter: (value: number) => `${value?.toFixed(2)}`,
            },
          ],
        },
      },
    ],
    legend: {
      position: 'top-right' as const,
    },
    tooltip: {
      // showMarkers: true,
    },
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 页面标题 */}
      <Card
        style={{
          marginBottom: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FundOutlined style={{ fontSize: '32px' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
              新发基金
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
              每月新发基金数量与募集份额统计
            </p>
          </div>
        </div>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>新发基金总数</span>}
              value={stats.totalFunds}
              suffix="只"
              prefix={<FundOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>募集份额总计</span>}
              value={stats.totalShares.toFixed(2)}
              suffix="亿"
              prefix={<PieChartOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>月均募集份额</span>}
              value={stats.avgShares.toFixed(2)}
              suffix="亿"
              prefix={<CalendarOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>单月最高新发</span>}
              value={stats.maxMonthlyFunds}
              suffix="只"
              prefix={<FundOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FundOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>新发基金趋势图</span>
          </div>
        }
        extra={
          <RangePicker
            picker="month"
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([
                  dates[0].startOf('month').format('YYYY-MM-DD'),
                  dates[1].endOf('month').format('YYYY-MM-DD'),
                ]);
              } else {
                setDateRange(null);
              }
            }}
            style={{ borderRadius: '8px' }}
          />
        }
        style={{ borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      >
        <Spin spinning={loading}>
          {monthlyData.length === 0 ? (
            <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <DualAxes {...config} style={{ height: 450 }} />
          )}
        </Spin>
      </Card>

      {/* 数据说明 */}
      <Card
        title={
          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#666' }}>
            数据说明
          </div>
        }
        style={{ marginTop: '16px', borderRadius: '12px' }}
      >
        <ul style={{ color: '#999', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
          <li>数据来源于东方财富网新发基金列表</li>
          <li>募集份额单位为亿份</li>
          <li>图表展示每月新发基金数量与募集份额变化趋势</li>
          <li>可通过顶部时间范围选择器筛选不同时间段</li>
        </ul>
      </Card>
    </div>
  );
};

export default FundNewIssue;
