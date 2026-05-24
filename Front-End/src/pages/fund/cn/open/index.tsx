import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Spin, Input, Typography, Tabs } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

const { Link } = Typography;
const { TabPane } = Tabs;

interface FundData {
  序号: number;
  基金代码: string;
  基金简称: string;
  日期: string;
  单位净值: number;
  累计净值: number;
  日增长率: number;
  近1周: number;
  近1月: number;
  近3月: number;
  近6月: number;
  近1年: number;
  近2年: number;
  近3年: number;
  今年来: number;
  成立来: number;
  自定义: number;
  手续费: string;
}

const FundOpen: React.FC = () => {
  const [fundType, setFundType] = useState<string>('全部');
  const [data, setData] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current:1,
    pageSize: 20,
  });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedFunds, setSelectedFunds] = useState<FundData[]>([]);

  const fundTypeOptions = [
    { label: '全部', value: '全部' },
    { label: '股票型', value: '股票型' },
    { label: '混合型', value: '混合型' },
    { label: '债券型', value: '债券型' },
    { label: '指数型', value: '指数型' },
    { label: 'QDII', value: 'QDII' },
    { label: 'FOF', value: 'FOF' },
  ];

  const fetchFundData = async () => {
    // todo
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_open_fund_rank_em', {
        params: {
          symbol: fundType,
        },
      });
      console.log('开放式基金 -> response', response);
      const newData = response?.data || [];
      setData(newData);

      // 更新自选基金数据（除基金代码外）
      if (selectedFunds.length > 0) {
        const updatedSelectedFunds = selectedFunds.map(selectedFund => {
          const matchedFund = newData.find(fund => fund['基金代码'] === selectedFund['基金代码']);
          if (matchedFund) {
            // 保留原基金代码，其他字段用新数据更新
            return { ...matchedFund, '基金代码': selectedFund['基金代码'] };
          }
          return selectedFund;
        });
        setSelectedFunds(updatedSelectedFunds);
        saveSelectedFunds(updatedSelectedFunds);
      }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  // 从localStorage加载自选基金
  const loadSelectedFunds = () => {
    try {
      const savedFunds = localStorage.getItem('selectedFunds');
      console.log('本地缓存 自选基金 savedFunds', JSON.parse(savedFunds || '[]'))
      if (savedFunds) {
        setSelectedFunds(JSON.parse(savedFunds));
      }
    } catch (error) {
      console.log('加载自选基金失败:', error);
    }
  };

  // 保存自选基金到localStorage
  const saveSelectedFunds = (funds: FundData[]) => {
    try {
      localStorage.setItem('selectedFunds', JSON.stringify(funds));
    } catch (error) {
      console.log('保存自选基金失败:', error);
    }
  };

  // 添加到自选
  const addToSelected = (fund: FundData) => {
    const isAlreadySelected = selectedFunds.some(f => f['基金代码'] === fund['基金代码']);
    if (!isAlreadySelected) {
      const newSelectedFunds = [...selectedFunds, fund];
      setSelectedFunds(newSelectedFunds);
      saveSelectedFunds(newSelectedFunds);
    }
  };

  // 从自选中移除
  const removeFromSelected = (fund: FundData) => {
    const newSelectedFunds = selectedFunds.filter(f => f['基金代码'] !== fund['基金代码']);
    setSelectedFunds(newSelectedFunds);
    saveSelectedFunds(newSelectedFunds);
  };

  // 检查基金是否已在自选中
  const isFundSelected = (fundCode: string) => {
    return selectedFunds.some(f => f['基金代码'] === fundCode);
  };

  // 初始化时加载自选基金
  useEffect(() => {
    loadSelectedFunds();
  }, []);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      fixed: 'left' as const,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['基金代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 200,
      fixed: 'left' as const,
      render: (name: string, record: FundData) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${record['基金代码']}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['基金简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      render: (value: string) => {
        return value && moment(value).format('YYYY-MM-DD') || '-';
      },
    },
    {
      title: '单位净值',
      dataIndex: '单位净值',
      key: '单位净值',
      width: 100,
      sorter: numberSorter('单位净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('单位净值'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '累计净值',
      dataIndex: '累计净值',
      key: '累计净值',
      width: 100,
      sorter: numberSorter('累计净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('累计净值'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '日增长率',
      dataIndex: '日增长率',
      key: '日增长率',
      width: 100,
      sorter: numberSorter('日增长率'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('日增长率'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1周',
      dataIndex: '近1周',
      key: '近1周',
      width: 100,
      sorter: numberSorter('近1周'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1周'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1月',
      dataIndex: '近1月',
      key: '近1月',
      width: 100,
      sorter: numberSorter('近1月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近3月',
      dataIndex: '近3月',
      key: '近3月',
      width: 100,
      sorter: numberSorter('近3月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近6月',
      dataIndex: '近6月',
      key: '近6月',
      width: 100,
      sorter: numberSorter('近6月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近6月'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近1年',
      dataIndex: '近1年',
      key: '近1年',
      width: 100,
      sorter: numberSorter('近1年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近2年',
      dataIndex: '近2年',
      key: '近2年',
      width: 100,
      sorter: numberSorter('近2年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近2年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '近3年',
      dataIndex: '近3年',
      key: '近3年',
      width: 100,
      sorter: numberSorter('近3年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3年'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '今年来',
      dataIndex: '今年来',
      key: '今年来',
      width: 100,
      sorter: numberSorter('今年来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('今年来'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '成立来',
      dataIndex: '成立来',
      key: '成立来',
      width: 100,
      sorter: numberSorter('成立来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('成立来'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '自定义',
      dataIndex: '自定义',
      key: '自定义',
      width: 100,
      sorter: numberSorter('自定义'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('自定义'),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any,
    {
      title: '手续费',
      dataIndex: '手续费',
      key: '手续费',
      width: 150,
      sorter: numberSorter('手续费'),
      // render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('手续费'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_, record: FundData) => {
        const isSelected = isFundSelected(record['基金代码']);
        
        // 置顶功能
        const moveToTop = (fund: FundData) => {
          const newSelectedFunds = [fund, ...selectedFunds.filter(f => f['基金代码'] !== fund['基金代码'])];
          setSelectedFunds(newSelectedFunds);
          saveSelectedFunds(newSelectedFunds);
        };
        
        // 置底功能
        const moveToBottom = (fund: FundData) => {
          const newSelectedFunds = [...selectedFunds.filter(f => f['基金代码'] !== fund['基金代码']), fund];
          setSelectedFunds(newSelectedFunds);
          saveSelectedFunds(newSelectedFunds);
        };
        
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={isSelected ? 'default' : 'primary'}
              size="small"
              onClick={() => isSelected ? removeFromSelected(record) : addToSelected(record)}
            >
              {isSelected ? '取消自选' : '添加到自选'}
            </Button>
            {isSelected && activeTab === 'selected' && (
              <>
                <Button
                  type="link"
                  size="small"
                  onClick={() => moveToTop(record)}
                >
                  置顶
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => moveToBottom(record)}
                >
                  置底
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="全部" key="all">
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>基金类型：</span>
                <Select
                  style={{ width: 200 }}
                  value={fundType}
                  onChange={setFundType}
                  options={fundTypeOptions}
                />
              </div>
              <Button type="primary" onClick={fetchFundData} loading={loading}>
                搜索
              </Button>
            </div>
          </Card>

          <Spin spinning={loading}>
            <Card>
              <Table
                columns={columns}
                dataSource={data}
                rowKey="序号"
                scroll={{ x: 2000 }}
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  onChange: (page, pageSize) => {
                    setPagination({ current: page, pageSize });
                  },
                  onShowSizeChange: (current, size) => {
                    setPagination({ current: 1, pageSize: size });
                  },
                }}
              />
            </Card>
          </Spin>
        </TabPane>
        <TabPane tab="自选" key="selected">
          <Card>
            <Table
              columns={columns}
              dataSource={selectedFunds}
              rowKey="序号"
              scroll={{ x: 2000 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setPagination({ current: page, pageSize });
                },
                onShowSizeChange: (current, size) => {
                  setPagination({ current: 1, pageSize: size });
                },
              }}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FundOpen;
