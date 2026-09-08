import React, { useEffect, useState, useRef } from 'react';
import { Table, Typography, InputNumber, Space, Button, Input, Tabs, message } from 'antd';
import apiClient from '@/utils/axios';

const { Search } = Input;

const { Link } = Typography;
const { TabPane } = Tabs;

interface StockData {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌额: number;
  涨跌幅: number;
  买入: number;
  卖出: number;
  昨收: number;
  今开: number;
  最高: number;
  最低: number;
  成交量: number;
  成交额: number;
  时间戳: unknown;
}


const numberSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key] || 0;
  const bValue = b[key] || 0;
  return (aValue as number) - (bValue as number);
};

const stringSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key];
  const bValue = b[key];
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue, 'zh-CN');
  }
  return 0;
};

const handleNavigateToDetail = (record: StockData) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const endDate = `${year}${month}${day}`;
  window.open(`/stock/a/stock/detail?symbol=${record.代码}&name=${encodeURIComponent(record.名称 || '')}`, '_blank');
};


const OutTrading: React.FC = () => {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedStocks, setSelectedStocks] = useState<StockData[]>([]);
  const selectedStocksRef = useRef<StockData[]>([]);
  // 保持 ref 与 state 同步
  useEffect(() => {
    selectedStocksRef.current = selectedStocks;
  }, [selectedStocks]);

  // 从 localStorage 加载自选股票
  useEffect(() => {
    try {
      const savedStocks = localStorage.getItem('OutTrading-selectedStocks');
      if (savedStocks) {
        setSelectedStocks(JSON.parse(savedStocks));
      }
    } catch (error) {
      console.log('加载自选股票失败:', error);
    }
  }, []);

  const fetchData = async () => {
    const cachedData = sessionStorage.getItem('stockListData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setData(parsedData);

        // 更新自选股票数据（除代码外）
        const currentSelected = selectedStocksRef.current;
        if (currentSelected.length > 0) {
          const updatedSelectedStocks = currentSelected.map(selectedStock => {
            const matchedStock = parsedData.find(stock => stock['代码'] === selectedStock['代码']);
            if (matchedStock) {
              return { ...matchedStock, '代码': selectedStock['代码'] };
            }
            return selectedStock;
          });
          setSelectedStocks(updatedSelectedStocks);
        }

        setLoading(false);
        return;
      } catch (error) {
        console.log('解析缓存数据失败', error);
      }
    }

    setLoading(true);
    try {
      let response;
      try {
        response = await apiClient.get('/api/public/stock_zh_a_spot');
      } catch {
        // 
      }
      console.log('个股列表 -> response', response);
      const newData = response?.data?.map((item: any, index: number) => ({
        ...item,
        序号: item.序号 || index + 1,
      })) || [];
      setData(newData);

      // 更新自选股票数据（除代码外）
      const currentSelected = selectedStocksRef.current;
      if (currentSelected.length > 0) {
        const updatedSelectedStocks = currentSelected.map(selectedStock => {
          const matchedStock = newData.find(stock => stock['代码'] === selectedStock['代码']);
          if (matchedStock) {
            return { ...matchedStock, '代码': selectedStock['代码'] };
          }
          return selectedStock;
        });
        setSelectedStocks(updatedSelectedStocks);
      }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  // 同步自选股票到 localStorage
  const saveSelectedStocks = (stocks: StockData[]) => {
    localStorage.setItem('OutTrading-selectedStocks', JSON.stringify(stocks));
  };

  // 添加到自选
  const addToSelected = (stock: StockData) => {
    const isAlreadySelected = selectedStocks.some(s => s['代码'] === stock['代码']);
    if (!isAlreadySelected) {
      const nextStocks = [...selectedStocks, stock];
      setSelectedStocks(nextStocks);
      saveSelectedStocks(nextStocks);
      message.success(`已添加 ${stock.名称 || stock.代码} 到自选`);
    }
  };

  // 从自选中移除
  const removeFromSelected = (stock: StockData) => {
    const nextStocks = selectedStocks.filter(s => s['代码'] !== stock['代码']);
    setSelectedStocks(nextStocks);
    saveSelectedStocks(nextStocks);
    message.info(`已从自选移除 ${stock.名称 || stock.代码}`);
  };

  // 置顶功能
  const moveToTop = (stock: StockData) => {
    const nextStocks = [stock, ...selectedStocks.filter(s => s['代码'] !== stock['代码'])];
    setSelectedStocks(nextStocks);
    saveSelectedStocks(nextStocks);
  };

  // 置底功能
  const moveToBottom = (stock: StockData) => {
    const nextStocks = [...selectedStocks.filter(s => s['代码'] !== stock['代码']), stock];
    setSelectedStocks(nextStocks);
    saveSelectedStocks(nextStocks);
  };

  const columns: any[] = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter('序号'),
    },
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 100,
      fixed: 'left' as const,
      sorter: stringSorter('代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索代码"
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
      onFilter: (value: string, record: StockData) => {
        return record.代码.toLowerCase().includes(value.toLowerCase());
      },
      render: (text: string, record: StockData) => (
        <a onClick={() => window.open(`/stock/a/stock/detail?symbol=${text}&name=${encodeURIComponent(record.名称 || '')}`, '_blank')}>{text}</a>
      ),
    },
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 120,
      fixed: 'left' as const,
      sorter: stringSorter('名称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Search
            placeholder="搜索名称"
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
      onFilter: (value: string, record: StockData) => {
        return record.名称.toLowerCase().includes(value.toLowerCase());
      },
      render: (text: string, record: StockData) => (
        <Link onClick={() => handleNavigateToDetail(record)}>{text}</Link>
      ),
    },
    {
      title: '最新价',
      dataIndex: '最新价',
      key: '最新价',
      width: 100,
      sorter: numberSorter('最新价'),
    },
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 100,
      sorter: numberSorter('涨跌额'),
    },
    {
      title: '涨跌幅(%)',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 120,
      sorter: numberSorter('涨跌幅'),
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
          {value}%
        </span>
      ),
    },
    {
      title: '买入',
      dataIndex: '买入',
      key: '买入',
      width: 100,
      sorter: numberSorter('买入'),
    },
    {
      title: '卖出',
      dataIndex: '卖出',
      key: '卖出',
      width: 100,
      sorter: numberSorter('卖出'),
    },
    {
      title: '昨收',
      dataIndex: '昨收',
      key: '昨收',
      width: 100,
      sorter: numberSorter('昨收'),
    },
    {
      title: '今开',
      dataIndex: '今开',
      key: '今开',
      width: 100,
      sorter: numberSorter('今开'),
    },
    {
      title: '最高',
      dataIndex: '最高',
      key: '最高',
      width: 100,
      sorter: numberSorter('最高'),
    },
    {
      title: '最低',
      dataIndex: '最低',
      key: '最低',
      width: 100,
      sorter: numberSorter('最低'),
    },
    {
      title: '成交量(股)',
      dataIndex: '成交量',
      key: '成交量',
      width: 120,
      sorter: numberSorter('成交量'),
    },
    {
      title: '成交额(元)',
      dataIndex: '成交额',
      key: '成交额',
      width: 120,
      sorter: numberSorter('成交额'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_, record: StockData) => {
        const isSelected = selectedStocks.some(s => s['代码'] === record['代码']);

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
        <TabPane tab="沪深京A股（非交易时间）" key="all">
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            <Button type="primary" onClick={fetchData} loading={loading}>
              搜索
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="代码"
            scroll={{ x: 3000, y: 'calc(100vh - 250px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total: number) => `共 ${total} 条`,
              onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
            }}
          />
        </TabPane>
        <TabPane tab="自选" key="selected">
          <Table
            columns={columns}
            dataSource={selectedStocks}
            rowKey="代码"
            scroll={{ x: 3000, y: 'calc(100vh - 200px)' }}
            pagination={false}
          />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default OutTrading;
