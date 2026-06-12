import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, DatePicker, Select } from 'antd';
import { DualAxes } from '@ant-design/plots';
import { FundOutlined, CalendarOutlined, PieChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import apiClient from '@/utils/axios';

interface NewFundItem {
  序号: number;
  基金代码: string;
  基金简称: string;
  单位净值: number;
  总募集规模: number;
  最近总份额: number;
  成立日期: string;
  基金经理: string;
  更新日期: string;
}

interface MonthlyData {
  month: string;
  yearMonth: string;
  新发基金数量: number;
  总募集金额: number;
  单只最高金额: number;
}

const { RangePicker } = DatePicker;

const fundTypes = [
  { label: '股票型基金', value: '股票型基金' },
  { label: '混合型基金', value: '混合型基金' },
  { label: '债券型基金', value: '债券型基金' },
  { label: '货币型基金', value: '货币型基金' },
  { label: 'QDII基金', value: 'QDII基金' },
];

const FundNewIssue: React.FC = () => {
  const [data, setData] = useState<NewFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [fundType, setFundType] = useState<string>('股票型基金');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_scale_open_sina', {
        params: { symbol: fundType },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map((item: Record<string, unknown>) => ({
          序号: Number(item['序号']) || 0,
          基金代码: String(item['基金代码'] || ''),
          基金简称: String(item['基金简称'] || ''),
          单位净值: Number(item['单位净值']) || 0,
          总募集规模: Number(item['总募集规模']) || 0,
          最近总份额: Number(item['最近总份额']) || 0,
          成立日期: String(item['成立日期'] || ''),
          基金经理: String(item['基金经理'] || ''),
          更新日期: String(item['更新日期'] || ''),
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取新发基金数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [fundType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 按年月分组统计：按成立日期分组，统计基金数量，累计总募集金额，计算单只最高金额
  // 总募集金额 = 单位净值(元) * 总募集规模(万份) * 10000 = 单位净值 * 总募集规模 * 10000 元
  const monthlyData = useMemo(() => {
    const filtered = dateRange
      ? data.filter(item => {
        const date = dayjs(item.成立日期);
        return date.isAfter(dayjs(dateRange[0]).subtract(1, 'day')) && date.isBefore(dayjs(dateRange[1]).add(1, 'day'));
      })
      : data;

    const grouped = filtered.reduce((acc, item) => {
      if (!item.成立日期) return acc;
      const month = dayjs(item.成立日期).format('YYYY-MM');
      const fundAmount = 1 * item.总募集规模 * 10000; // 新基金发行期面值统一为 1.00 元 / 份
      if (!acc[month]) {
        acc[month] = { month, yearMonth: month, 新发基金数量: 0, 总募集金额: 0, 单只最高金额: 0 };
      }
      acc[month].新发基金数量 += 1;
      acc[month].总募集金额 += fundAmount;
      acc[month].单只最高金额 = Math.max(acc[month].单只最高金额, fundAmount);
      return acc;
    }, {} as Record<string, MonthlyData>);

    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, dateRange]);

  // 统计
  const stats = useMemo(() => {
    return {
      totalFunds: monthlyData.reduce((sum, item) => sum + item.新发基金数量, 0),
      totalAmount: monthlyData.reduce((sum, item) => sum + item.总募集金额, 0),
      avgAmount: monthlyData.length > 0
        ? monthlyData.reduce((sum, item) => sum + item.总募集金额, 0) / monthlyData.length
        : 0,
      maxMonthlyFunds: monthlyData.length > 0
        ? Math.max(...monthlyData.map(item => item.新发基金数量))
        : 0,
    };
  }, [monthlyData]);

  // 图表数据
  const chartData = useMemo(() => {
    return monthlyData.map(item => ({
      date: item.yearMonth,
      count: item.新发基金数量,
      amount: item.总募集金额 / 100000000, // 转换为亿元
      avgPerFund: item.新发基金数量 > 0 ? (item.总募集金额 / 100000000) / item.新发基金数量 : 0,
      maxPerFund: item.单只最高金额 / 100000000, // 转换为亿元
    }));
  }, [monthlyData]);

  const countData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.count,
    type: '新发基金数量',
  })), [chartData]);

  const amountData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.amount,
    type: '募集总金额(亿元)',
  })), [chartData]);

  const avgData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.avgPerFund,
    type: '平均募集金额(亿元)',
  })), [chartData]);

  const maxData = useMemo(() => chartData.map(item => ({
    date: item.date,
    value: item.maxPerFund,
    type: '单只最高金额(亿元)',
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
        text: '募集金额(亿元)',
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
        data: amountData,
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
          //   value: `${datum.value.toFixed(2)}亿`,
          // }),
        },
      },
      {
        data: avgData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#722ed1',
        smooth: true,
        style: { lineWidth: 2 },
        axis: { y: { position: 'right' } },
        tooltip: {
          // formatter: (datum: { type: string; value: number }) => ({
          //   name: datum.type,
          //   value: `${datum.value.toFixed(2)}亿`,
          // }),
        },
      },
      {
        data: maxData,
        type: 'line',
        yField: 'value',
        colorField: 'type',
        color: '#fa8c16',
        smooth: true,
        style: { lineWidth: 2 },
        axis: { y: { position: 'right' } },
        tooltip: {
          // formatter: (datum: { type: string; value: number }) => ({
          //   name: datum.type,
          //   value: `${datum.value.toFixed(2)}亿`,
          // }),
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
              每月新发基金数量与募集规模统计
            </p>
          </div>
        </div>
      </Card>

      {/* 基金类型选择 */}
      <Card style={{ marginBottom: '16px', borderRadius: '12px' }} bodyStyle={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontWeight: 500 }}>新发基金类型：</span>
          <Select
            value={fundType}
            onChange={setFundType}
            options={fundTypes}
            style={{ width: 200 }}
          />
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
              title={<span style={{ color: '#666' }}>募集总金额</span>}
              value={(stats.totalAmount / 100000000).toFixed(2)}
              suffix="亿元"
              prefix={<PieChartOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic
              title={<span style={{ color: '#666' }}>月均募集金额</span>}
              value={(stats.avgAmount / 100000000).toFixed(2)}
              suffix="亿元"
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
          <li>数据来源于新浪财经基金规模数据</li>
          <li>总募集金额 = 1.00 元 / 份 × 总募集规模</li>
          <li>可通过顶部时间范围选择器筛选不同时间段</li>
          <li>可通过基金类型下拉框筛选不同类型的基金</li>
        </ul>
      </Card>
    </div>
  );
};

export default FundNewIssue;
