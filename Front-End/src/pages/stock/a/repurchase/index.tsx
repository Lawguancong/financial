import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import type { TablePaginationConfig } from 'antd';

const { Search } = Input;

interface RepurchaseData extends Record<string, unknown> {
  序号: number;
  股票代码: string;
  股票简称: string;
  最新价: number;
  计划回购价格区间: number;
  计划回购数量区间下限: number;
  计划回购数量区间上限: number;
  占公告前一日总股本比例下限: number;
  占公告前一日总股本比例上限: number;
  计划回购金额区间下限: number;
  计划回购金额区间上限: number;
  回购起始时间: string;
  实施进度: string;
  已回购股份价格区间下限: number;
  已回购股份价格区间上限: number;
  已回购股份数量: number;
  已回购金额: number;
  最新公告日期: string;
}

const StockRepurchase: React.FC = () => {
  const [data, setData] = useState<RepurchaseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_repurchase_em');
      console.log('股票回购数据 -> response', response);

      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map((item: Record<string, unknown>, index: number) => ({
          序号: Number(item['序号']) || index + 1,
          股票代码: String(item['股票代码'] || ''),
          股票简称: String(item['股票简称'] || ''),
          最新价: Number(item['最新价']) || 0,
          计划回购价格区间: Number(item['计划回购价格区间']) || 0,
          计划回购数量区间下限: Number(item['计划回购数量区间-下限']) || 0,
          计划回购数量区间上限: Number(item['计划回购数量区间-上限']) || 0,
          占公告前一日总股本比例下限: Number(item['占公告前一日总股本比例-下限']) || 0,
          占公告前一日总股本比例上限: Number(item['占公告前一日总股本比例-上限']) || 0,
          计划回购金额区间下限: Number(item['计划回购金额区间-下限']) || 0,
          计划回购金额区间上限: Number(item['计划回购金额区间-上限']) || 0,
          回购起始时间: String(item['回购起始时间'] || ''),
          实施进度: String(item['实施进度'] || ''),
          已回购股份价格区间下限: Number(item['已回购股份价格区间-下限']) || 0,
          已回购股份价格区间上限: Number(item['已回购股份价格区间-上限']) || 0,
          已回购股份数量: Number(item['已回购股份数量']) || 0,
          已回购金额: Number(item['已回购金额']) || 0,
          最新公告日期: String(item['最新公告日期'] || ''),
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取股票回购数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetchData();
  }, []);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter<RepurchaseData>('序号'),
    },
    {
      title: '股票代码',
      dataIndex: '股票代码',
      key: '股票代码',
      width: 120,
      sorter: stringSorter<RepurchaseData>('股票代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索股票代码"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: RepurchaseData) => {
        return record.股票代码.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: '股票简称',
      dataIndex: '股票简称',
      key: '股票简称',
      width: 120,
      sorter: stringSorter<RepurchaseData>('股票简称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索股票简称"
            value={selectedKeys[0] || ''}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              确定
            </Button>
            <Button onClick={() => clearFilters()} size="small">
              重置
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string, record: RepurchaseData) => {
        return record.股票简称.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: '最新价(元)',
      dataIndex: '最新价',
      key: '最新价',
      width: 160,
      sorter: numberSorter<RepurchaseData>('最新价'),
      ...createRangeFilter<RepurchaseData>('最新价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '计划回购价格区间(元)',
      dataIndex: '计划回购价格区间',
      key: '计划回购价格区间',
      width: 220,
      sorter: numberSorter<RepurchaseData>('计划回购价格区间'),
      ...createRangeFilter<RepurchaseData>('计划回购价格区间'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '计划回购数量下限(股)',
      dataIndex: '计划回购数量区间下限',
      key: '计划回购数量区间下限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('计划回购数量区间下限'),
      ...createRangeFilter<RepurchaseData>('计划回购数量区间下限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '计划回购数量上限(股)',
      dataIndex: '计划回购数量区间上限',
      key: '计划回购数量区间上限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('计划回购数量区间上限'),
      ...createRangeFilter<RepurchaseData>('计划回购数量区间上限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '占总股本比例下限(%)',
      dataIndex: '占公告前一日总股本比例下限',
      key: '占公告前一日总股本比例下限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('占公告前一日总股本比例下限'),
      ...createRangeFilter<RepurchaseData>('占公告前一日总股本比例下限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '占总股本比例上限(%)',
      dataIndex: '占公告前一日总股本比例上限',
      key: '占公告前一日总股本比例上限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('占公告前一日总股本比例上限'),
      ...createRangeFilter<RepurchaseData>('占公告前一日总股本比例上限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '计划回购金额下限(元)',
      dataIndex: '计划回购金额区间下限',
      key: '计划回购金额区间下限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('计划回购金额区间下限'),
      ...createRangeFilter<RepurchaseData>('计划回购金额区间下限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '计划回购金额上限(元)',
      dataIndex: '计划回购金额区间上限',
      key: '计划回购金额区间上限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('计划回购金额区间上限'),
      ...createRangeFilter<RepurchaseData>('计划回购金额区间上限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '回购起始时间',
      dataIndex: '回购起始时间',
      key: '回购起始时间',
      width: 150,
      sorter: stringSorter<RepurchaseData>('回购起始时间'),
    },
    {
      title: '实施进度',
      dataIndex: '实施进度',
      key: '实施进度',
      width: 120,
      sorter: stringSorter<RepurchaseData>('实施进度'),
    },
    {
      title: '已回购价格下限(%)',
      dataIndex: '已回购股份价格区间下限',
      key: '已回购股份价格区间下限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('已回购股份价格区间下限'),
      ...createRangeFilter<RepurchaseData>('已回购股份价格区间下限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '已回购价格上限(%)',
      dataIndex: '已回购股份价格区间上限',
      key: '已回购股份价格区间上限',
      width: 220,
      sorter: numberSorter<RepurchaseData>('已回购股份价格区间上限'),
      ...createRangeFilter<RepurchaseData>('已回购股份价格区间上限'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '已回购股份数量(股)',
      dataIndex: '已回购股份数量',
      key: '已回购股份数量',
      width: 220,
      sorter: numberSorter<RepurchaseData>('已回购股份数量'),
      ...createRangeFilter<RepurchaseData>('已回购股份数量'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '已回购金额(元)',
      dataIndex: '已回购金额',
      key: '已回购金额',
      width: 160,
      sorter: numberSorter<RepurchaseData>('已回购金额'),
      ...createRangeFilter<RepurchaseData>('已回购金额'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最新公告日期',
      dataIndex: '最新公告日期',
      key: '最新公告日期',
      width: 150,
      sorter: stringSorter<RepurchaseData>('最新公告日期'),
    },
  ];

  return (
    <Card
      title="股票回购数据"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      }
    >
      <Table
          rowKey="序号"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={(newPagination) => {
            setPagination(newPagination);
          }}
          scroll={{ x: 'max-content' }}
        />
    </Card>
  );
};

export default StockRepurchase;