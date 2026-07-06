import React, { useState, useEffect } from 'react';
import { Button, Table, Card, Spin, Input, Typography, Tabs, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import FundFilterPanel from './FundFilterPanel';
import type { TablePaginationConfig } from 'antd';

const { Link } = Typography;
const { TabPane } = Tabs;

interface ExchangeFundData {
  [key: string]: string | number;
  序号: number;
  基金代码: string;
  基金简称: string;
  类型: string;
  日期: string;
  单位净值: number;
  累计净值: number;
  近1周: number;
  近1月: number;
  近3月: number;
  近6月: number;
  近1年: number;
  近2年: number;
  近3年: number;
  今年来: number;
  成立来: number;
  成立日期: string;
}

interface ExchangeFundPanelProps {
  selectedFunds: ExchangeFundData[];
  onAddToSelected: (fund: ExchangeFundData) => void;
  onRemoveFromSelected: (fund: ExchangeFundData) => void;
  isFundSelected: (fundCode: string) => boolean;
}

const ExchangeFundPanel: React.FC<ExchangeFundPanelProps> = ({
  onAddToSelected,
  onRemoveFromSelected,
  isFundSelected,
}) => {
  const [data, setData] = useState<ExchangeFundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
  });
  const [activeSubTab, setActiveSubTab] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_exchange_rank_em');
      console.log('场内交易基金 -> response', response);

      const rawData = response?.data;
      if (Array.isArray(rawData)) {
        const formattedData = rawData.map(
          (item: Record<string, unknown>, index: number) => ({
            序号: Number(item['序号']) || index + 1,
            基金代码: String(item['基金代码'] || ''),
            基金简称: String(item['基金简称'] || '-'),
            类型: String(item['类型'] || ''),
            日期: String(item['日期'] || ''),
            单位净值: Number(item['单位净值']) || 0,
            累计净值: Number(item['累计净值']) || 0,
            近1周: Number(item['近1周']) || 0,
            近1月: Number(item['近1月']) || 0,
            近3月: Number(item['近3月']) || 0,
            近6月: Number(item['近6月']) || 0,
            近1年: Number(item['近1年']) || 0,
            近2年: Number(item['近2年']) || 0,
            近3年: Number(item['近3年']) || 0,
            今年来: Number(item['今年来']) || 0,
            成立来: Number(item['成立来']) || 0,
            成立日期: String(item['成立日期'] || ''),
          })
        );
        setData(formattedData);
      }
    } catch (error) {
      console.error('获取场内交易基金数据失败:', error);
      message.error('获取场内交易基金数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: any[] = [
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      fixed: 'left' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金代码"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90 }}>搜索</Button>
            <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: ExchangeFundData) =>
        String(record['基金代码'] || '').toLowerCase().includes(String(value).toLowerCase()),
      render: (code: string) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${code}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {code}
        </Link>
      ),
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 200,
      fixed: 'left' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金简称"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90 }}>搜索</Button>
            <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: ExchangeFundData) =>
        String(record['基金简称'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '类型',
      dataIndex: '类型',
      key: '类型',
      width: 100,
      filters: [
        { text: 'ETF', value: 'ETF' },
        { text: 'LOF', value: 'LOF' },
      ],
      onFilter: (value: string | number | boolean, record: ExchangeFundData) =>
        String(record['类型'] || '').includes(String(value)),
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '单位净值', dataIndex: '单位净值', key: '单位净值', width: 100,
      sorter: numberSorter('单位净值'), render: (v: number) => v?.toFixed(4),
      ...createRangeFilter('单位净值'),
    },
    {
      title: '累计净值', dataIndex: '累计净值', key: '累计净值', width: 100,
      sorter: numberSorter('累计净值'), render: (v: number) => v?.toFixed(4),
      ...createRangeFilter('累计净值'),
    },
    {
      title: '近1周', dataIndex: '近1周', key: '近1周', width: 100,
      sorter: numberSorter('近1周'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近1周'),
    },
    {
      title: '近1月', dataIndex: '近1月', key: '近1月', width: 100,
      sorter: numberSorter('近1月'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近1月'),
    },
    {
      title: '近3月', dataIndex: '近3月', key: '近3月', width: 100,
      sorter: numberSorter('近3月'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近3月'),
    },
    {
      title: '近6月', dataIndex: '近6月', key: '近6月', width: 100,
      sorter: numberSorter('近6月'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近6月'),
    },
    {
      title: '近1年', dataIndex: '近1年', key: '近1年', width: 100,
      sorter: numberSorter('近1年'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近1年'),
    },
    {
      title: '近2年', dataIndex: '近2年', key: '近2年', width: 100,
      sorter: numberSorter('近2年'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近2年'),
    },
    {
      title: '近3年', dataIndex: '近3年', key: '近3年', width: 100,
      sorter: numberSorter('近3年'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('近3年'),
    },
    {
      title: '今年来', dataIndex: '今年来', key: '今年来', width: 100,
      sorter: numberSorter('今年来'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('今年来'),
    },
    {
      title: '成立来', dataIndex: '成立来', key: '成立来', width: 100,
      sorter: numberSorter('成立来'), render: (v: number) => `${v?.toFixed(2)}%`,
      ...createRangeFilter('成立来'),
    },
    {
      title: '成立日期',
      dataIndex: '成立日期',
      key: '成立日期',
      width: 120,
      sorter: stringSorter('成立日期'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: ExchangeFundData) => {
        const isSelected = isFundSelected(record['基金代码']);
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={isSelected ? 'default' : 'primary'}
              size="small"
              onClick={() => isSelected ? onRemoveFromSelected(record) : onAddToSelected(record)}
            >
              {isSelected ? '取消自选' : '添加到自选'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Tabs activeKey={activeSubTab} onChange={setActiveSubTab}>
      <TabPane tab="列表" key="all">
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              刷新数据
            </Button>
          </div>
        </Card>
        <Spin spinning={loading}>
          <Card>
            <Table<ExchangeFundData>
              rowKey="序号"
              columns={columns}
              dataSource={data}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total: number, range: [number, number]) =>
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
                onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
              }}
              scroll={{ x: 1500 }}
              size="middle"
            />
          </Card>
        </Spin>
      </TabPane>
      <TabPane tab="筛选" key="filter">
        <FundFilterPanel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onAddToSelected={onAddToSelected as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onRemoveFromSelected={onRemoveFromSelected as any}
          isFundSelected={isFundSelected}
        />
      </TabPane>
    </Tabs>
  );
};

export default ExchangeFundPanel;
