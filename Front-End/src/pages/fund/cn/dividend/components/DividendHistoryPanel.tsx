import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Input, Select, Space, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import type { TablePaginationConfig } from 'antd';
import dayjs from 'dayjs';

const currentYear = dayjs().year();
const { Search } = Input;

interface DividendHistoryData extends Record<string, unknown> {
  序号: number;
  基金代码: string;
  基金简称: string;
  权益登记日: string;
  除息日期: string;
  分红: number;
  分红发放日: string;
}

const DividendHistoryPanel: React.FC = () => {
  const [data, setData] = useState<DividendHistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<string>(String(`${currentYear}`));
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
  });

  // 生成 1999-currentYear 年份选项
  const yearOptions = Array.from({ length: currentYear - 1999 + 1 }, (_, i) => {
    const y = 1999 + i;
    return { label: `${y}年`, value: String(y) };
  }).reverse();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_fh_em', {
        params: { year },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map(
          (item: Record<string, unknown>, index: number) => ({
            序号: Number(item['序号']) || index + 1,
            基金代码: String(item['基金代码'] || ''),
            基金简称: String(item['基金简称'] || '-'),
            权益登记日: String(item['权益登记日'] || ''),
            除息日期: String(item['除息日期'] || ''),
            分红: Number(item['分红']) || 0,
            分红发放日: String(item['分红发放日'] || ''),
          })
        );
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取基金历年分红数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchData();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any[] = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter<DividendHistoryData>('序号'),
    },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      sorter: stringSorter<DividendHistoryData>('基金代码'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索基金代码"
            value={selectedKeys[0] || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
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
      onFilter: (value: string, record: DividendHistoryData) => {
        return record.基金代码.toLowerCase().includes(value.toLowerCase());
      },
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 180,
      sorter: stringSorter<DividendHistoryData>('基金简称'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索基金简称"
            value={selectedKeys[0] || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
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
      onFilter: (value: string, record: DividendHistoryData) => {
        return record.基金简称.toLowerCase().includes(value.toLowerCase());
      },
    },
    {
      title: '权益登记日',
      dataIndex: '权益登记日',
      key: '权益登记日',
      width: 130,
      sorter: stringSorter<DividendHistoryData>('权益登记日'),
    },
    {
      title: '除息日期',
      dataIndex: '除息日期',
      key: '除息日期',
      width: 120,
      sorter: stringSorter<DividendHistoryData>('除息日期'),
    },
    {
      title: '分红(元/份)',
      dataIndex: '分红',
      key: '分红',
      width: 130,
      align: 'right' as const,
      sorter: numberSorter<DividendHistoryData>('分红'),
      ...createRangeFilter<DividendHistoryData>('分红'),
      render: (value: number) => (
        <span style={{ color: '#f5222d', fontWeight: 500 }}>
          {value > 0 ? `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })}` : '-'}
        </span>
      ),
    },
    {
      title: '分红发放日',
      dataIndex: '分红发放日',
      key: '分红发放日',
      width: 130,
      sorter: stringSorter<DividendHistoryData>('分红发放日'),
    },
  ];

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination(newPagination);
  };

  return (
    <Card
      style={{
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <Space>
          <span>选择年份：</span>
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 120 }}
            options={yearOptions}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新数据
          </Button>
        </Space>
      </div>

      <Table<DividendHistoryData>
        rowKey="序号"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default DividendHistoryPanel;
