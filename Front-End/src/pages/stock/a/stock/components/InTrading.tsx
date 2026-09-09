import React, { useEffect, useState, useRef } from 'react';
import { Table, Button, Tabs, message } from 'antd';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';

const { TabPane } = Tabs;

interface SpotData extends Record<string, unknown> {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌幅: number;
  涨跌额: number;
  成交量: number;
  成交额: number;
  振幅: number;
  最高: number;
  最低: number;
  今开: number;
  昨收: number;
  量比: number;
  换手率: number;
  市盈率_动态: number;
  市净率: number;
  总市值: number;
  流通市值: number;
  涨速: number;
  '5分钟涨跌': number;
  '60日涨跌幅': number;
  年初至今涨跌幅: number;
}

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === '-' || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatVolume = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const formatAmount = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const formatPercent = (v: number, fixed = 2) => (v > 0 ? '+' : '') + v.toFixed(fixed) + '%';
const formatPrice = (v: number) => v.toFixed(2);

const InTrading: React.FC = () => {
  const [data, setData] = useState<SpotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedStocks, setSelectedStocks] = useState<SpotData[]>([]);
  const selectedStocksRef = useRef<SpotData[]>([]);

  useEffect(() => {
    selectedStocksRef.current = selectedStocks;
  }, [selectedStocks]);

  useEffect(() => {
    try {
      const savedStocks = localStorage.getItem('InTrading-selectedStocks');
      if (savedStocks) {
        setSelectedStocks(JSON.parse(savedStocks));
      }
    } catch (error) {
      console.log('加载自选股票失败:', error);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/stock_zh_a_spot_em');
      const list: unknown[] = Array.isArray(response?.data) ? response.data : [];
      const newData: SpotData[] = (list as Record<string, unknown>[]).map((item, index) => {
        const code = String(item['代码'] || '');
        return {
          序号: toNumber(item['序号']) || index + 1,
          代码: code,
          名称: String(item['名称'] || ''),
          最新价: toNumber(item['最新价']),
          涨跌幅: toNumber(item['涨跌幅']),
          涨跌额: toNumber(item['涨跌额']),
          成交量: toNumber(item['成交量']),
          成交额: toNumber(item['成交额']),
          振幅: toNumber(item['振幅']),
          最高: toNumber(item['最高']),
          最低: toNumber(item['最低']),
          今开: toNumber(item['今开']),
          昨收: toNumber(item['昨收']),
          量比: toNumber(item['量比']),
          换手率: toNumber(item['换手率']),
          市盈率_动态: toNumber(item['市盈率-动态']),
          市净率: toNumber(item['市净率']),
          总市值: toNumber(item['总市值']),
          流通市值: toNumber(item['流通市值']),
          涨速: toNumber(item['涨速']),
          '5分钟涨跌': toNumber(item['5分钟涨跌']),
          '60日涨跌幅': toNumber(item['60日涨跌幅']),
          年初至今涨跌幅: toNumber(item['年初至今涨跌幅']),
        };
      });
      setData(newData);

      const currentSelected = selectedStocksRef.current;
      if (currentSelected.length > 0) {
        const updatedSelected = currentSelected.map((sel) => {
          const matched = newData.find((s) => s.代码 === sel.代码);
          return matched || sel;
        });
        setSelectedStocks(updatedSelected);
      }
    } catch (error) {
      console.error('获取 A 股全量行情失败:', error);
      message.error('获取 A 股全量行情失败');
    } finally {
      setLoading(false);
    }
  };

  const saveSelectedStocks = (stocks: SpotData[]) => {
    try {
      localStorage.setItem('InTrading-selectedStocks', JSON.stringify(stocks));
    } catch (error) {
      console.log('保存自选股票失败:', error);
    }
  };

  const addToSelected = (stock: SpotData) => {
    if (!selectedStocks.some((s) => s.代码 === stock.代码)) {
      const next = [...selectedStocks, stock];
      setSelectedStocks(next);
      saveSelectedStocks(next);
      message.success(`已添加 ${stock.名称 || stock.代码} 到自选`);
    }
  };

  const removeFromSelected = (stock: SpotData) => {
    const next = selectedStocks.filter((s) => s.代码 !== stock.代码);
    setSelectedStocks(next);
    saveSelectedStocks(next);
    message.info(`已从自选移除 ${stock.名称 || stock.代码}`);
  };

  const moveToTop = (stock: SpotData) => {
    const next = [stock, ...selectedStocks.filter((s) => s.代码 !== stock.代码)];
    setSelectedStocks(next);
    saveSelectedStocks(next);
  };

  const moveToBottom = (stock: SpotData) => {
    const next = [...selectedStocks.filter((s) => s.代码 !== stock.代码), stock];
    setSelectedStocks(next);
    saveSelectedStocks(next);
  };

  // 搜索/过滤由 Table 列内筛选完成，这里不做前置过滤

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      sorter: numberSorter<SpotData>('序号'),
    },
    {
      title: '代码',
      dataIndex: '代码',
      key: '代码',
      width: 110,
      fixed: 'left' as const,
      sorter: stringSorter<SpotData>('代码'),
      render: (text: string, record: SpotData) => (
        <a
          onClick={() =>
            window.open(
              `/stock/a/stock/detail?symbol=${text}&name=${encodeURIComponent(record.名称 || '')}`,
              '_blank',
            )
          }
        >
          {text}
        </a>
      ),
    },
    {
      title: '名称',
      dataIndex: '名称',
      key: '名称',
      width: 120,
      fixed: 'left' as const,
      sorter: stringSorter<SpotData>('名称'),
    },
    {
      title: '最新价',
      dataIndex: '最新价',
      key: '最新价',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('最新价'),
      ...createRangeFilter<SpotData>('最新价'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌幅(%)',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 120,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('涨跌幅'),
      ...createRangeFilter<SpotData>('涨跌幅'),
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
          {formatPercent(v)}
        </span>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 110,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('涨跌额'),
      ...createRangeFilter<SpotData>('涨跌额'),
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>
          {(v > 0 ? '+' : '') + formatPrice(v)}
        </span>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '成交量(手)',
      dataIndex: '成交量',
      key: '成交量',
      width: 140,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('成交量'),
      ...createRangeFilter<SpotData>('成交量'),
      render: (v: number) => formatVolume(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '成交额(元)',
      dataIndex: '成交额',
      key: '成交额',
      width: 160,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('成交额'),
      ...createRangeFilter<SpotData>('成交额'),
      render: (v: number) => formatAmount(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '振幅(%)',
      dataIndex: '振幅',
      key: '振幅',
      width: 110,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('振幅'),
      ...createRangeFilter<SpotData>('振幅'),
      render: (v: number) => formatPercent(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最高',
      dataIndex: '最高',
      key: '最高',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('最高'),
      ...createRangeFilter<SpotData>('最高'),
      render: (v: number) => formatPrice(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '最低',
      dataIndex: '最低',
      key: '最低',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('最低'),
      ...createRangeFilter<SpotData>('最低'),
      render: (v: number) => formatPrice(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '今开',
      dataIndex: '今开',
      key: '今开',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('今开'),
      ...createRangeFilter<SpotData>('今开'),
      render: (v: number) => formatPrice(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '昨收',
      dataIndex: '昨收',
      key: '昨收',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('昨收'),
      ...createRangeFilter<SpotData>('昨收'),
      render: (v: number) => formatPrice(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '量比',
      dataIndex: '量比',
      key: '量比',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('量比'),
      ...createRangeFilter<SpotData>('量比'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '换手率(%)',
      dataIndex: '换手率',
      key: '换手率',
      width: 120,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('换手率'),
      ...createRangeFilter<SpotData>('换手率'),
      render: (v: number) => formatPercent(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '市盈率-动态',
      dataIndex: '市盈率_动态',
      key: '市盈率_动态',
      width: 130,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('市盈率_动态'),
      ...createRangeFilter<SpotData>('市盈率_动态'),
      render: (v: number) => (v ? v.toFixed(2) : '-'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '市净率',
      dataIndex: '市净率',
      key: '市净率',
      width: 110,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('市净率'),
      ...createRangeFilter<SpotData>('市净率'),
      render: (v: number) => (v ? v.toFixed(2) : '-'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '总市值(元)',
      dataIndex: '总市值',
      key: '总市值',
      width: 160,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('总市值'),
      ...createRangeFilter<SpotData>('总市值'),
      render: (v: number) => formatAmount(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '流通市值(元)',
      dataIndex: '流通市值',
      key: '流通市值',
      width: 170,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('流通市值'),
      ...createRangeFilter<SpotData>('流通市值'),
      render: (v: number) => formatAmount(v),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '涨速',
      dataIndex: '涨速',
      key: '涨速',
      width: 100,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('涨速'),
      ...createRangeFilter<SpotData>('涨速'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '5分钟涨跌(%)',
      dataIndex: '5分钟涨跌',
      key: '5分钟涨跌',
      width: 130,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('5分钟涨跌'),
      ...createRangeFilter<SpotData>('5分钟涨跌'),
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>{formatPercent(v)}</span>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '60日涨跌幅(%)',
      dataIndex: '60日涨跌幅',
      key: '60日涨跌幅',
      width: 150,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('60日涨跌幅'),
      ...createRangeFilter<SpotData>('60日涨跌幅'),
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>{formatPercent(v)}</span>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '年初至今涨跌幅(%)',
      dataIndex: '年初至今涨跌幅',
      key: '年初至今涨跌幅',
      width: 170,
      align: 'right' as const,
      sorter: numberSorter<SpotData>('年初至今涨跌幅'),
      ...createRangeFilter<SpotData>('年初至今涨跌幅'),
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>{formatPercent(v)}</span>
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: SpotData) => {
        const isSelected = selectedStocks.some((s) => s.代码 === record.代码);
        return (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              type={isSelected ? 'default' : 'primary'}
              size="small"
              onClick={() => (isSelected ? removeFromSelected(record) : addToSelected(record))}
            >
              {isSelected ? '取消自选' : '添加到自选'}
            </Button>
            {isSelected && activeTab === 'selected' && (
              <>
                <Button type="link" size="small" onClick={() => moveToTop(record)}>
                  置顶
                </Button>
                <Button type="link" size="small" onClick={() => moveToBottom(record)}>
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
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          setPagination({ current: 1, pageSize: pagination.pageSize });
        }}
      >
        <TabPane tab="沪深京A股（非交易时间）" key="all">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="代码"
            scroll={{ x: 3600, y: 'calc(100vh - 250px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total: number) => `共 ${total} 条`,
              onChange: (page: number, pageSize: number) =>
                setPagination({ current: page, pageSize }),
            }}
            onChange={(newPagination) =>
              setPagination({
                current: newPagination.current ?? 1,
                pageSize: newPagination.pageSize ?? pagination.pageSize,
              })
            }
          />
        </TabPane>
        <TabPane tab="自选" key="selected">
          <Table
            columns={columns}
            dataSource={selectedStocks}
            rowKey="代码"
            scroll={{ x: 3600, y: 'calc(100vh - 200px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total: number) => `共 ${total} 条`,
              onChange: (page: number, pageSize: number) =>
                setPagination({ current: page, pageSize }),
            }}
            onChange={(newPagination) =>
              setPagination({
                current: newPagination.current ?? 1,
                pageSize: newPagination.pageSize ?? pagination.pageSize,
              })
            }
          />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default InTrading;
