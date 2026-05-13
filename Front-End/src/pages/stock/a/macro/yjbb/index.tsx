import React, { useState, useEffect, useMemo } from 'react';
import { Card, Spin, Table, Tag, Select, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

interface PerformanceReport {
  序号: number;
  股票代码: string;
  股票简称: string;
  每股收益: number;
  '营业总收入-营业总收入': number;
  '营业总收入-同比增长': number;
  '营业总收入-季度环比增长': number;
  '净利润-净利润': number;
  '净利润-同比增长': number;
  '净利润-季度环比增长': number;
  每股净资产: number;
  净资产收益率: number;
  每股经营现金流量: number;
  销售毛利率: number;
  所处行业: string;
  最新公告日期: string;
}

interface MedianData {
  '营业总收入-同比增长%(中位数)': number;
  '净利润-同比增长%(中位数)': number;
  '营业总收入-季度-环比增长%(中位数)': number;
  '净利润-季度-环比增长%(中位数)': number;
}

const PerformanceReportPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PerformanceReport[]>([]);
  const [reRunLoading, setReRunLoading] = useState(false);
  const [yjbbEmData, setYjbbEmData] = useState<Record<string, MedianData>>({});
  // const [medians, setMedians] = useState<MedianData | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState('20260331');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const calculateMedian = (arr: number[]): number => {
    const sorted = arr.filter(n => !isNaN(n)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const generateQuarters = () => {
    const quarters: { label: string; value: string }[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const startYear = 2010;
    // const startYear = 2025;
    const quarterMap = [
      { month: '0331', label: '第一季度', monthNum: 3 },
      { month: '0630', label: '第二季度', monthNum: 6 },
      { month: '0930', label: '第三季度', monthNum: 9 },
      { month: '1231', label: '第四季度', monthNum: 12 },
    ];

    for (let year = currentYear; year >= startYear; year--) {
      for (const quarter of quarterMap) {
        if (year < currentYear || quarter.monthNum <= currentMonth) {
          quarters.push({
            label: `${year}年${quarter.label}`,
            value: `${year}${quarter.month}`,
          });
        }
      }
    }
    return quarters;
  };

  const quarters = generateQuarters();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_yjbb_em', {
        params: { date: selectedQuarter },
      });
      const resultData = response?.data || [];
      setData(resultData);

      // 计算中位数
      const revenueGrowthRates = resultData?.map((item: PerformanceReport) => item['营业总收入-同比增长'] || 0);
      const profitGrowthRates = resultData?.map((item: PerformanceReport) => item['净利润-同比增长'] || 0);
      const revenueQuarterlyGrowthRates = resultData?.map((item: PerformanceReport) => item['营业总收入-季度环比增长'] || 0);
      const profitQuarterlyGrowthRates = resultData?.map((item: PerformanceReport) => item['净利润-季度环比增长'] || 0);

      const medianData: MedianData = {
        '营业总收入-同比增长%(中位数)': calculateMedian(revenueGrowthRates),
        '净利润-同比增长%(中位数)': calculateMedian(profitGrowthRates),
        '营业总收入-季度-环比增长%(中位数)': calculateMedian(revenueQuarterlyGrowthRates),
        '净利润-季度-环比增长%(中位数)': calculateMedian(profitQuarterlyGrowthRates),
      };
      // setMedians(medianData);
      console.log('selectedQuarter:', selectedQuarter);
      console.log('业绩报表 -> resultData', resultData);
      console.log('业绩报表中位数:', medianData);

      const savedYjbbEm = localStorage.getItem('yjbbEm');
      console.log('savedYjbbEm:', savedYjbbEm);

      // if (savedYjbbEm) {
        const savedYjbbEmData = JSON.parse(savedYjbbEm || '{}');
        savedYjbbEmData[selectedQuarter] = medianData;
        localStorage.setItem('yjbbEm', JSON.stringify(savedYjbbEmData));
      // }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  const reRunAllData = async () => {
    setReRunLoading(true);
    try {
      const allMedianData: Record<string, MedianData> = {};

      for (const quarter of quarters) {
        message.success(`获取【${quarter.label}】数据中...`);
        const response = await apiClient.get('/api/public/stock_yjbb_em', {
          params: { date: quarter.value },
        });
        const resultData = response?.data || [];

        const revenueGrowthRates = resultData?.map((item: PerformanceReport) => item['营业总收入-同比增长'] || 0);
        const profitGrowthRates = resultData?.map((item: PerformanceReport) => item['净利润-同比增长'] || 0);
        const revenueQuarterlyGrowthRates = resultData?.map((item: PerformanceReport) => item['营业总收入-季度环比增长'] || 0);
        const profitQuarterlyGrowthRates = resultData?.map((item: PerformanceReport) => item['净利润-季度环比增长'] || 0);

        const medianData: MedianData = {
          '营业总收入-同比增长%(中位数)': calculateMedian(revenueGrowthRates),
          '净利润-同比增长%(中位数)': calculateMedian(profitGrowthRates),
          '营业总收入-季度-环比增长%(中位数)': calculateMedian(revenueQuarterlyGrowthRates),
          '净利润-季度-环比增长%(中位数)': calculateMedian(profitQuarterlyGrowthRates),
        };

        allMedianData[quarter.value] = medianData;

      }
      localStorage.setItem('yjbbEm', JSON.stringify(allMedianData));


      console.log('所有季度中位数数据已缓存到localStorage:', allMedianData);
    } catch (error) {
      console.error('重跑所有数据失败:', error);
    } finally {
      setReRunLoading(false);
    }
  };


  // useEffect(() => {
  // }, [selectedQuarter]);

  useEffect(() => {
    const savedYjbbEm = localStorage.getItem('yjbbEm');
    if (savedYjbbEm) {
      try {
        const parsedData = JSON.parse(savedYjbbEm);
        setYjbbEmData(parsedData);
      } catch (e) {
        console.error('解析yjbbEm数据失败:', e);
      }
    }
  }, []);

  const chartConfig = useMemo(() => {
    if (Object.keys(yjbbEmData).length === 0) {
      return null;
    }

    const chartData: { date: Date; value: number; category: string }[] = [];
    Object.entries(yjbbEmData).forEach(([dateStr, values]) => {
      const date = moment(dateStr, 'YYYYMMDD').toDate();
      chartData.push(
        { date, value: values['营业总收入-同比增长%(中位数)'], category: '营业总收入-同比增长%(中位数)' },
        { date, value: values['净利润-同比增长%(中位数)'], category: '净利润-同比增长%(中位数)' },
        { date, value: values['营业总收入-季度-环比增长%(中位数)'], category: '营业总收入-季度-环比增长%(中位数)' },
        { date, value: values['净利润-季度-环比增长%(中位数)'], category: '净利润-季度-环比增长%(中位数)' }
      );
    });

    return {
      data: chartData,
      xField: (d: { date: Date }) => d.date,
      yField: 'value',
      colorField: 'category',
      smooth: true,
      color: ['#52c41a', '#ff4d4f', '#1890ff', '#722ed1'],
      legend: {
        position: 'bottom',
      },
      xAxis: {
        title: {
          text: '报告期',
        },
      },
      yAxis: {
        title: {
          text: '增长率%(中位数)',
        },
      },
    };
  }, [yjbbEmData]);

  const handleTableChange = (pagination: { current: number; pageSize: number }) => {
    setPagination({ current: pagination.current, pageSize: pagination.pageSize });
  };

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      align: 'center',
      sorter: numberSorter('序号'),
      render: (value: number) => <span style={{ fontWeight: 500, color: '#1890ff' }}>{value}</span>,
    },
    {
      title: '股票代码',
      dataIndex: '股票代码',
      key: '股票代码',
      width: 120,
      align: 'center',
      render: (value: string) => <span style={{ fontFamily: 'monospace', color: '#666' }}>{value}</span>,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: {
        setSelectedKeys: (keys: React.Key[]) => void;
        selectedKeys: React.Key[];
        confirm: () => void;
        clearFilters: () => void
      }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="输入股票代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block', padding: '4px 8px' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={confirm}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => { clearFilters(); confirm(); }}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#fff',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              重置
            </button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: PerformanceReport) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['股票代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '股票简称',
      dataIndex: '股票简称',
      key: '股票简称',
      width: 150,
      render: (value: string) => <span style={{ fontWeight: 600, color: '#333' }}>{value}</span>,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: {
        setSelectedKeys: (keys: React.Key[]) => void;
        selectedKeys: React.Key[];
        confirm: () => void;
        clearFilters: () => void
      }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="输入股票简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block', padding: '4px 8px' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={confirm}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => { clearFilters(); confirm(); }}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#fff',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              重置
            </button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: PerformanceReport) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['股票简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
    },
    {
      title: '每股收益',
      dataIndex: '每股收益',
      key: '每股收益',
      width: 120,
      align: 'right',
      sorter: numberSorter('每股收益'),
      ...createRangeFilter('每股收益'),
      render: (value: number) => <span style={{ fontWeight: 600 }}>{value?.toFixed(4)}</span>,
    },
    {
      title: '营业总收入(元)',
      dataIndex: '营业总收入-营业总收入',
      key: '营业总收入-营业总收入',
      width: 180,
      align: 'right',
      sorter: numberSorter('营业总收入-营业总收入'),
      ...createRangeFilter('营业总收入-营业总收入'),
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          {(value / 100000000).toFixed(2)}亿
        </span>
      ),
    },
    {
      title: '营业总收入-同比增长(%)',
      dataIndex: '营业总收入-同比增长',
      key: '营业总收入-同比增长',
      width: 160,
      align: 'right',
      sorter: numberSorter('营业总收入-同比增长'),
      ...createRangeFilter('营业总收入-同比增长'),
      render: (value: number) => {
        const color = value >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <span style={{ fontWeight: 600, color }}>
            {value >= 0 ? '+' : ''}{value?.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '营业总收入-季度环比增长(%)',
      dataIndex: '营业总收入-季度环比增长',
      key: '营业总收入-季度环比增长',
      width: 180,
      align: 'right',
      sorter: numberSorter('营业总收入-季度环比增长'),
      ...createRangeFilter('营业总收入-季度环比增长'),
      render: (value: number) => {
        const color = value >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <span style={{ fontWeight: 600, color }}>
            {value >= 0 ? '+' : ''}{value?.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '净利润(元)',
      dataIndex: '净利润-净利润',
      key: '净利润-净利润',
      width: 150,
      align: 'right',
      sorter: numberSorter('净利润-净利润'),
      ...createRangeFilter('净利润-净利润'),
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {(value / 100000000).toFixed(2)}亿
        </span>
      ),
    },
    {
      title: '净利润-同比增长(%)',
      dataIndex: '净利润-同比增长',
      key: '净利润-同比增长',
      width: 160,
      align: 'right',
      sorter: numberSorter('净利润-同比增长'),
      ...createRangeFilter('净利润-同比增长'),
      render: (value: number) => {
        const color = value >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <span style={{ fontWeight: 600, color }}>
            {value >= 0 ? '+' : ''}{value?.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '净利润-季度环比增长(%)',
      dataIndex: '净利润-季度环比增长',
      key: '净利润-季度环比增长',
      width: 180,
      align: 'right',
      sorter: numberSorter('净利润-季度环比增长'),
      ...createRangeFilter('净利润-季度环比增长'),
      render: (value: number) => {
        const color = value >= 0 ? '#52c41a' : '#ff4d4f';
        return (
          <span style={{ fontWeight: 600, color }}>
            {value >= 0 ? '+' : ''}{value?.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '每股净资产',
      dataIndex: '每股净资产',
      key: '每股净资产',
      width: 120,
      align: 'right',
      sorter: numberSorter('每股净资产'),
      ...createRangeFilter('每股净资产'),
      render: (value: number) => <span style={{ fontWeight: 600 }}>{value?.toFixed(4)}</span>,
    },
    {
      title: '净资产收益率(%)',
      dataIndex: '净资产收益率',
      key: '净资产收益率',
      width: 140,
      align: 'right',
      sorter: numberSorter('净资产收益率'),
      ...createRangeFilter('净资产收益率'),
      render: (value: number) => <span style={{ fontWeight: 600, color: '#1890ff' }}>{value?.toFixed(2)}</span>,
    },
    {
      title: '每股经营现金流量',
      dataIndex: '每股经营现金流量',
      key: '每股经营现金流量',
      width: 150,
      align: 'right',
      sorter: numberSorter('每股经营现金流量'),
      ...createRangeFilter('每股经营现金流量'),
      render: (value: number) => <span style={{ fontWeight: 600 }}>{value?.toFixed(4)}</span>,
    },
    {
      title: '销售毛利率(%)',
      dataIndex: '销售毛利率',
      key: '销售毛利率',
      width: 140,
      align: 'right',
      sorter: numberSorter('销售毛利率'),
      ...createRangeFilter('销售毛利率'),
      render: (value: number) => <span style={{ fontWeight: 600, color: '#722ed1' }}>{value?.toFixed(2)}</span>,
    },
    {
      title: '所处行业',
      dataIndex: '所处行业',
      key: '所处行业',
      width: 150,
      render: (value: string) => (
        <Tag color="blue" style={{ borderRadius: 4, padding: '0 8px' }}>
          {value}
        </Tag>
      ),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: {
        setSelectedKeys: (keys: React.Key[]) => void;
        selectedKeys: React.Key[];
        confirm: () => void;
        clearFilters: () => void
      }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="输入行业名称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block', padding: '4px 8px' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={confirm}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => { clearFilters(); confirm(); }}
              style={{
                width: 90,
                padding: '4px 8px',
                backgroundColor: '#fff',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              重置
            </button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: PerformanceReport) => {
        const searchValue = String(value).toLowerCase();
        const industryValue = String(record['所处行业'] || '').toLowerCase();
        return industryValue.includes(searchValue);
      },
    },
    {
      title: '最新公告日期',
      dataIndex: '最新公告日期',
      key: '最新公告日期',
      width: 160,
      align: 'center',
      render: (value: string) => {
        try {
          return moment(value).format('YYYY-MM-DD');
        } catch {
          return value;
        }
      },
    },
  ];

  return (
    <Spin spinning={loading || reRunLoading}>
      <div style={{ padding: '24px' }}>
        <Card title="A股业绩报图">
           <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={reRunAllData}
              disabled={reRunLoading}
              style={{
                padding: '6px 16px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ReloadOutlined />
              重跑所有数据
            </button>
          </div>
          {chartConfig ? (
            <div style={{ height: '400px' }}>
              <Line {...chartConfig} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              暂无数据，请先点击"重跑所有数据"按钮生成数据
            </div>
          )}
        </Card>


        <Card title="A股业绩报表" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>报告期：</span>
              <Select
                style={{ width: 200 }}
                value={selectedQuarter}
                onChange={setSelectedQuarter}
                options={quarters}
              />
            </div>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              style={{
                padding: '6px 16px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ReloadOutlined />
              刷新数据
            </button>
          </div>
          <Table
            dataSource={data}
            columns={columns}
            rowKey="序号"
            pagination={{
              ...pagination,
              total: data.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 2000 }}
            bordered
          />
        </Card>
      </div>
    </Spin>
  );
};

export default PerformanceReportPage;
