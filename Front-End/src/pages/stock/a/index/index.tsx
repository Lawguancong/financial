import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, Input, Button, Tabs } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';

const { Link } = Typography;
const { TabPane } = Tabs;

interface IndexData {
  指数代码: string;
  指数简称: string;
  指数全称: string;
  发布时间: string;
  基日: string;
  基点: number;
  指数类别: string;
  指数系列: string;
  资产类别: string;
  指数币种: string;
  样本数量: number;
  最新收盘: number;
  近一个月收益率: number;
  合作指数: string;
  跟踪产品: string;
  指数合规: string;
  指数热点: string | null;
}

const stringSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) => {
  const aValue = String(a[key] || '');
  const bValue = String(b[key] || '');
  return aValue.localeCompare(bValue, 'zh-CN');
};

const Index: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedIndices, setSelectedIndices] = useState<IndexData[]>([]);

  const getUniqueValues = (data: IndexData[], key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => String(item[key] || ''))))
      .filter(value => value !== 'null' && value !== 'undefined')
      .sort();
  };

  const columns = useMemo(() => [
    {
      title: '指数代码',
      dataIndex: '指数代码',
      key: '指数代码',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数代码"
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['指数代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '指数简称',
      dataIndex: '指数简称',
      key: '指数简称',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('指数简称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数简称"
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
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['指数简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
      render: (name: string, record: IndexData) => (
        <Link
          onClick={() => window.open(`/stock/a/index/detail?code=${record['指数代码']}&publishDate=${record['发布时间'] ? moment(record['发布时间']).format('YYYYMMDD') : ''}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '发布时间',
      dataIndex: '发布时间',
      key: '发布时间',
      width: 60,
      // fixed: 'left' as const,
      sorter: stringSorter('发布时间'),
      render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
    },
    {
      title: '指数类别',
      dataIndex: '指数类别',
      key: '指数类别',
      width: 60,
      sorter: stringSorter('指数类别'),
      filters: getUniqueValues(data, '指数类别').map(value => ({ text: value, value })),
      onFilter: (value: React.Key, record: IndexData) => record['指数类别']?.includes(value as string),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '基点',
      dataIndex: '基点',
      key: '基点',
      width: 60,
      sorter: stringSorter('基点'),
    },
    {
      title: '样本数量',
      dataIndex: '样本数量',
      key: '样本数量',
      width: 60,
      sorter: stringSorter('样本数量'),
    },
    {
      title: '最新收盘',
      dataIndex: '最新收盘',
      key: '最新收盘',
      width: 60,
      sorter: stringSorter('最新收盘'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_, record: IndexData) => {
        const isSelected = isIndexSelected(record['指数代码']);
        
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
  ], [data, selectedIndices, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_csindex_all');
      console.log('指数列表 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelectedIndices();
  }, []);

  // 从localStorage加载自选指数
  const loadSelectedIndices = () => {
    try {
      const savedIndices = localStorage.getItem('selectedIndices');
      if (savedIndices) {
        setSelectedIndices(JSON.parse(savedIndices));
      }
    } catch (error) {
      console.log('加载自选指数失败:', error);
    }
  };

  // 保存自选指数到localStorage
  const saveSelectedIndices = (indices: IndexData[]) => {
    try {
      localStorage.setItem('selectedIndices', JSON.stringify(indices));
    } catch (error) {
      console.log('保存自选指数失败:', error);
    }
  };

  // 添加到自选
  const addToSelected = (index: IndexData) => {
    const isAlreadySelected = selectedIndices.some(i => i['指数代码'] === index['指数代码']);
    if (!isAlreadySelected) {
      const newSelectedIndices = [...selectedIndices, index];
      setSelectedIndices(newSelectedIndices);
      saveSelectedIndices(newSelectedIndices);
    }
  };

  // 从自选中移除
  const removeFromSelected = (index: IndexData) => {
    const newSelectedIndices = selectedIndices.filter(i => i['指数代码'] !== index['指数代码']);
    setSelectedIndices(newSelectedIndices);
    saveSelectedIndices(newSelectedIndices);
  };

  // 检查指数是否已在自选中
  const isIndexSelected = (indexCode: string) => {
    return selectedIndices.some(i => i['指数代码'] === indexCode);
  };

  // 置顶功能
  const moveToTop = (index: IndexData) => {
    const newSelectedIndices = [index, ...selectedIndices.filter(i => i['指数代码'] !== index['指数代码'])];
    setSelectedIndices(newSelectedIndices);
    saveSelectedIndices(newSelectedIndices);
  };

  // 置底功能
  const moveToBottom = (index: IndexData) => {
    const newSelectedIndices = [...selectedIndices.filter(i => i['指数代码'] !== index['指数代码']), index];
    setSelectedIndices(newSelectedIndices);
    saveSelectedIndices(newSelectedIndices);
  };



  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="全部" key="all">
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Button type="primary" onClick={fetchData} loading={loading}>
              搜索
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="指数代码"
            scroll={{ x: 2000, y: 'calc(100vh - 200px)' }}
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
        </TabPane>
        <TabPane tab="自选" key="selected">
          <Table
            columns={columns}
            dataSource={selectedIndices}
            rowKey="指数代码"
            scroll={{ x: 2000, y: 'calc(100vh - 200px)' }}
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
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Index;
