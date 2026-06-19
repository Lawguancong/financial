import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Tabs, Typography, Input, Spin } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';

const { Link } = Typography;
const { TabPane } = Tabs;

export interface IndexFundData {
  [key: string]: string | number;
}

interface IndexFundPanelProps {
  selectedFunds: IndexFundData[];
  onAddToSelected: (fund: IndexFundData) => void;
  onRemoveFromSelected: (fund: IndexFundData) => void;
  isFundSelected: (fundCode: string) => boolean;
}

const indexSymbolOptions = [
  { label: '全部', value: '全部' },
  { label: '沪深指数', value: '沪深指数' },
  { label: '行业主题', value: '行业主题' },
  { label: '大盘指数', value: '大盘指数' },
  { label: '中盘指数', value: '中盘指数' },
  { label: '小盘指数', value: '小盘指数' },
  { label: '股票指数', value: '股票指数' },
  { label: '债券指数', value: '债券指数' },
];

const indexIndicatorOptions = [
  { label: '全部', value: '全部' },
  { label: '被动指数型', value: '被动指数型' },
  { label: '增强指数型', value: '增强指数型' },
];

const IndexFundPanel: React.FC<IndexFundPanelProps> = ({
  selectedFunds,
  onAddToSelected,
  onRemoveFromSelected,
  isFundSelected,
}) => {
  const [symbol, setSymbol] = useState<string>('全部');
  const [indicator, setIndicator] = useState<string>('全部');
  const [data, setData] = useState<IndexFundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [activeSubTab, setActiveSubTab] = useState<string>('list');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_info_index_em', {
        params: { symbol, indicator },
      });
      console.log('指数型基金 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, indicator]);

  // 基金代码搜索下拉
  const codeFilterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
    <div style={{ padding: 8 }}>
      <Input
        placeholder="输入基金代码"
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={confirm}
        style={{ width: 188, marginBottom: 8, display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
        <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
      </div>
    </div>
  );

  // 基金名称搜索下拉
  const nameFilterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
    <div style={{ padding: 8 }}>
      <Input
        placeholder="输入基金名称"
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={confirm}
        style={{ width: 188, marginBottom: 8, display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
        <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
      </div>
    </div>
  );

  const columns = [
    {
      title: '基金代码', dataIndex: '基金代码', width: 100, fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金代码'),
      filterDropdown: codeFilterDropdown,
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: IndexFundData) =>
        String(record['基金代码'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '基金名称', dataIndex: '基金名称', width: 260, fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金名称'),
      render: (name: string, record: IndexFundData) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${record['基金代码']}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
      filterDropdown: nameFilterDropdown,
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: IndexFundData) =>
        String(record['基金名称'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '单位净值', dataIndex: '单位净值', width: 100,
      sorter: numberSorter<IndexFundData>('单位净值'),
      ...createRangeFilter('单位净值'),
    } as any,
    {
      title: '日期', dataIndex: '日期', width: 120,
      sorter: stringSorter<IndexFundData>('日期'),
    },
    {
      title: '日增长率', dataIndex: '日增长率', width: 100,
      sorter: numberSorter<IndexFundData>('日增长率'),
      ...createRangeFilter('日增长率'),
    } as any,
    {
      title: '近1周', dataIndex: '近1周', width: 80,
      sorter: numberSorter<IndexFundData>('近1周'),
      ...createRangeFilter('近1周'),
    } as any,
    {
      title: '近1月', dataIndex: '近1月', width: 80,
      sorter: numberSorter<IndexFundData>('近1月'),
      ...createRangeFilter('近1月'),
    } as any,
    {
      title: '近3月', dataIndex: '近3月', width: 80,
      sorter: numberSorter<IndexFundData>('近3月'),
      ...createRangeFilter('近3月'),
    } as any,
    {
      title: '近6月', dataIndex: '近6月', width: 80,
      sorter: numberSorter<IndexFundData>('近6月'),
      ...createRangeFilter('近6月'),
    } as any,
    {
      title: '近1年', dataIndex: '近1年', width: 80,
      sorter: numberSorter<IndexFundData>('近1年'),
      ...createRangeFilter('近1年'),
    } as any,
    {
      title: '近2年', dataIndex: '近2年', width: 80,
      sorter: numberSorter<IndexFundData>('近2年'),
      ...createRangeFilter('近2年'),
    } as any,
    {
      title: '近3年', dataIndex: '近3年', width: 80,
      sorter: numberSorter<IndexFundData>('近3年'),
      ...createRangeFilter('近3年'),
    } as any,
    {
      title: '今年来', dataIndex: '今年来', width: 90,
      sorter: numberSorter<IndexFundData>('今年来'),
      ...createRangeFilter('今年来'),
    } as any,
    {
      title: '成立来', dataIndex: '成立来', width: 90,
      sorter: numberSorter<IndexFundData>('成立来'),
      ...createRangeFilter('成立来'),
    } as any,
    {
      title: '手续费', dataIndex: '手续费', width: 80,
      sorter: numberSorter<IndexFundData>('手续费'),
      ...createRangeFilter('手续费'),
    } as any,
    {
      title: '起购金额', dataIndex: '起购金额', width: 100,
      sorter: stringSorter<IndexFundData>('起购金额'),
    },
    {
      title: '跟踪标的', dataIndex: '跟踪标的', width: 200,
      sorter: stringSorter<IndexFundData>('跟踪标的'),
    },
    {
      title: '跟踪方式', dataIndex: '跟踪方式', width: 100,
      sorter: stringSorter<IndexFundData>('跟踪方式'),
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: unknown, record: IndexFundData) => {
        const isSelected = isFundSelected(String(record['基金代码']));
        return (
          <Button
            type={isSelected ? 'default' : 'primary'} size="small"
            onClick={() => isSelected ? onRemoveFromSelected(record) : onAddToSelected(record)}
          >
            {isSelected ? '取消自选' : '添加到自选'}
          </Button>
        );
      },
    },
  ];

  // 列表内容（搜索条件 + 表格）—— 列表 Tab 和筛选 Tab 共用
  const renderListContent = () => (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            style={{ width: 140 }}
            value={symbol}
            onChange={setSymbol}
            options={indexSymbolOptions}
          />
          <Select
            style={{ width: 140 }}
            value={indicator}
            onChange={setIndicator}
            options={indexIndicatorOptions}
          />
          <Button type="primary" onClick={fetchData} loading={loading}>
            刷新数据
          </Button>
        </div>
      </Card>
      <Spin spinning={loading}>
        <Card>
          <Table
            rowKey="基金代码"
            columns={columns}
            dataSource={data}
            scroll={{ x: 2600 }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total: number) => `共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page: number, pageSize: number) =>
                setPagination({ current: page, pageSize }),
            }}
          />
        </Card>
      </Spin>
    </>
  );

  return (
    <Tabs activeKey={activeSubTab} onChange={setActiveSubTab}>
      <TabPane tab="列表" key="list">
        {renderListContent()}
      </TabPane>
      <TabPane tab="筛选" key="filtered">
        {renderListContent()}
      </TabPane>
    </Tabs>
  );
};

export default IndexFundPanel;
