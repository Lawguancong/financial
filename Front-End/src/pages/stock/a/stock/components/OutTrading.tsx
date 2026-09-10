import React, { useEffect, useState, useRef } from 'react';
import { Table, Typography, InputNumber, Space, Button, Input, Tabs, message } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { computeRSIRecommendations, calculatePeriodRSI, createRecommendationAnnotations } from '@/utils/stockUtils';
import type { KLineData } from '@/utils/stockUtils';

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

// 周期 RSI 字段名（与 stockUtils 中返回的字段保持一致）
type RsiFieldKey =
  | '__daily__RSI6__'
  | '__weekly__RSI6__'
  | '__monthly__RSI6__'
  | '__quarterly__RSI6__';

// 单行数据：日期 + 收盘价 + 各周期 RSI6 + 推荐级别（null 表示非买点）
type ChartRow = KLineData & {
  __recommendationLevel__: number | null;
} & Record<RsiFieldKey, number | null>;

// 过滤后的买点数据行（推荐级别必不为 null）
type BuyPointRow = ChartRow & { __recommendationLevel__: number };



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
  const [activeTab, setActiveTab] = useState<string>('selected');
  const [selectedStocks, setSelectedStocks] = useState<StockData[]>([]);
  const selectedStocksRef = useRef<StockData[]>([]);
  const [calculateRecommendation, setCalculateRecommendation] = useState<boolean>(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<StockData[]>([]);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: StockData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };



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

  // 计算推荐买点
  const fetchStockDetailAndCalculate = async (symbol: string): Promise<string | null> => {
    try {
      // 9 开头 bj, 6 开头 sh, 0 开头 sz
      const prefix = symbol.startsWith('9')
        ? 'bj'
        : symbol.startsWith('6')
          ? 'sh'
          : symbol.startsWith('0')
            ? 'sz'
            : '';
      const params: Record<string, string> = {
        symbol: prefix ? `${prefix}${symbol}` : symbol,
        adjust: 'hfq',
        start_date: '20210101' // todo
      };
      const response = await apiClient.get('/api/public/stock_zh_a_hist_tx', { params });
      const stockHistoryList = response?.data?.map((item: Record<string, unknown>) => ({
        日期: item.date,
        收盘: Number(item.close),
      })) || [];

      // 1) 计算日/周/月/季 K 线的 RSI6 值
      const periodRSIMap = calculatePeriodRSI(stockHistoryList);

      // 2) 合并为带推荐级别的图表数据
      const chartData = computeRSIRecommendations(periodRSIMap) as ChartRow[];

      // 3) 过滤出推荐买点
      const buyPointList = chartData.filter(
        (row): row is BuyPointRow => row.__recommendationLevel__ != null,
      );

      console.log('1111 symbol', symbol)
      console.log('1111 response', response)
      console.log('1111 periodRSIMap', periodRSIMap)
      console.log('1111 chartData', chartData)
      console.log('1111 buyPointList', buyPointList)



      // 返回推荐买点日期字符串
      // return ''
      return buyPointList?.reverse()?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(',');
    } catch (error) {
      console.log('Error fetching fund detail:', error);
      return '';
    }
  };

  const handleCalculateRecommendation = async () => {
    // setCalculateRecommendation(!calculateRecommendation);
    console.log('1111 calculateRecommendation');
    console.log('11111 selectedStocks', selectedStocks);
    console.log('勾选的行, selectedRows ', selectedRows);
    console.log('勾选的行, selectedRowKeys ', selectedRowKeys);
    if (selectedRows?.length === 0) {
      message.warning('请选择股票');
      return;
    } else {
      const results = [];
      for (const item of selectedRows) {
        message.info(`正在分析【${item['名称']}】中...`);
        const recommendationDates = await fetchStockDetailAndCalculate(String(item['代码']));
        results.push({
          ...item,
          ['__推荐买点__']: recommendationDates || '',
        });
      }
      console.log('1111, results ', results);
      // setData();
      // setData((prev)=> {
      //   return prev;
      // })
    }
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
          {/* <div
            onClick={handleCalculateRecommendation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 20px',
              background: calculateRecommendation
                ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                : 'linear-gradient(135deg, #b6bee3ff 0%, #b1aeb5ff 100%)',
              borderRadius: '25px',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: calculateRecommendation
                ? '0 8px 25px rgba(56, 239, 125, 0.5), 0 0 0 3px rgba(56, 239, 125, 0.2)'
                : '0 4px 15px rgba(102, 126, 234, 0.3)',
              cursor: 'pointer',
              transform: calculateRecommendation ? 'scale(1.02)' : 'scale(1)',
              border: '2px solid transparent',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: calculateRecommendation
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {calculateRecommendation ? '✓' : '○'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 'bold', color: '#fff', fontSize: '14px',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}>
                {calculateRecommendation ? '✨ 已启用智能分析' : '💡 计算推荐买点'}
              </span>
              <span style={{
                color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginTop: '2px'
              }}>
                {calculateRecommendation ? '搜索后将分析最佳买入时机...' : '启用后将计算RSI指标'}
              </span>
            </div>
          </div> */}
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: onSelectChange,
            }}
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
