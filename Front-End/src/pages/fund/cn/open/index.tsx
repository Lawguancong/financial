import React, { useState, useEffect } from 'react';
import { Button, Table, Card, Tabs } from 'antd';
import moment from 'moment';
import { numberSorter } from '@/utils/tableUtils';
import OpenFundPanel from './components/OpenFundPanel';
import IndexFundPanel from './components/IndexFundPanel';
import ExchangeFundPanel from './components/ExchangeFundPanel';

const { TabPane } = Tabs;

interface FundData {
  [key: string]: string | number;
}

const FundOpen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('open');
  const [selectedFunds, setSelectedFunds] = useState<FundData[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  // 自选基金操作
  const loadSelectedFunds = () => {
    try {
      const savedFunds = localStorage.getItem('selectedFunds');
      if (savedFunds) setSelectedFunds(JSON.parse(savedFunds));
    } catch (error) {
      console.log('加载自选基金失败:', error);
    }
  };

  const saveSelectedFunds = (funds: FundData[]) => {
    try {
      localStorage.setItem('selectedFunds', JSON.stringify(funds));
    } catch (error) {
      console.log('保存自选基金失败:', error);
    }
  };

  const addToSelected = (fund: FundData) => {
    if (!selectedFunds.some(f => f['基金代码'] === fund['基金代码'])) {
      const newFunds = [...selectedFunds, fund];
      setSelectedFunds(newFunds);
      saveSelectedFunds(newFunds);
    }
  };

  const removeFromSelected = (fund: FundData) => {
    const newFunds = selectedFunds.filter(f => f['基金代码'] !== fund['基金代码']);
    setSelectedFunds(newFunds);
    saveSelectedFunds(newFunds);
  };

  const isFundSelected = (fundCode: string) =>
    selectedFunds.some(f => f['基金代码'] === fundCode);

  const moveToTop = (fund: FundData) => {
    const newFunds = [fund, ...selectedFunds.filter(f => f['基金代码'] !== fund['基金代码'])];
    setSelectedFunds(newFunds);
    saveSelectedFunds(newFunds);
  };

  const moveToBottom = (fund: FundData) => {
    const newFunds = [...selectedFunds.filter(f => f['基金代码'] !== fund['基金代码']), fund];
    setSelectedFunds(newFunds);
    saveSelectedFunds(newFunds);
  };

  useEffect(() => { loadSelectedFunds(); }, []);

  // 自选基金表格列（复用开放式基金的列结构，简化版）
  const selectedColumns = [
    // { title: '序号', dataIndex: '序号', key: '序号', width: 80 },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      render: (code: string, record: FundData) => (
        <a onClick={() => window.open(`/fund/cn/open/detail?symbol=${code}`, '_blank')}>
          {code}
        </a>
      ),
    },
    {
      title: '基金名称',
      dataIndex: '基金名称',
      key: '基金名称',
      width: 200,
      render: (_: unknown, record: FundData) => {
        const name = record['基金名称'] || record['基金简称'] || '-';
        const code = record['基金代码'];
        return (
          <a onClick={() => window.open(`/fund/cn/open/detail?symbol=${code}`, '_blank')}>
            {name}
          </a>
        );
      },
    },
    { title: '日期', dataIndex: '日期', key: '日期', width: 120,
      render: (v: string) => v ? moment(v).format('YYYY-MM-DD') : '-' },
    { title: '单位净值', dataIndex: '单位净值', key: '单位净值', width: 100,
      sorter: numberSorter('单位净值'), render: (v: number) => v?.toFixed(4) },
    { title: '累计净值', dataIndex: '累计净值', key: '累计净值', width: 100,
      sorter: numberSorter('累计净值'), render: (v: number) => v?.toFixed(4) },
    { title: '日增长率', dataIndex: '日增长率', key: '日增长率', width: 100,
      sorter: numberSorter('日增长率'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近1周', dataIndex: '近1周', key: '近1周', width: 100,
      sorter: numberSorter('近1周'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近1月', dataIndex: '近1月', key: '近1月', width: 100,
      sorter: numberSorter('近1月'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近3月', dataIndex: '近3月', key: '近3月', width: 100,
      sorter: numberSorter('近3月'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近6月', dataIndex: '近6月', key: '近6月', width: 100,
      sorter: numberSorter('近6月'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近1年', dataIndex: '近1年', key: '近1年', width: 100,
      sorter: numberSorter('近1年'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近2年', dataIndex: '近2年', key: '近2年', width: 100,
      sorter: numberSorter('近2年'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '近3年', dataIndex: '近3年', key: '近3年', width: 100,
      sorter: numberSorter('近3年'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '今年来', dataIndex: '今年来', key: '今年来', width: 100,
      sorter: numberSorter('今年来'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '成立来', dataIndex: '成立来', key: '成立来', width: 100,
      sorter: numberSorter('成立来'), render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '手续费', dataIndex: '手续费', key: '手续费', width: 150 },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: unknown, record: FundData) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="primary" size="small" onClick={() => removeFromSelected(record)}>取消自选</Button>
          <Button size="small" onClick={() => moveToTop(record)}>置顶</Button>
          <Button size="small" onClick={() => moveToBottom(record)}>置底</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="开放式基金" key="open">
          <OpenFundPanel
            selectedFunds={selectedFunds}
            onAddToSelected={addToSelected}
            onRemoveFromSelected={removeFromSelected}
            isFundSelected={isFundSelected}
          />
        </TabPane>
         <TabPane tab="场内交易基金" key="exchange">
          <ExchangeFundPanel
            selectedFunds={selectedFunds as any}
            onAddToSelected={addToSelected as any}
            onRemoveFromSelected={removeFromSelected as any}
            isFundSelected={isFundSelected}
          />
        </TabPane>
        <TabPane tab="指数型基金" key="index">
          <IndexFundPanel
            selectedFunds={selectedFunds}
            onAddToSelected={addToSelected}
            onRemoveFromSelected={removeFromSelected}
            isFundSelected={isFundSelected}
          />
        </TabPane>
        <TabPane tab="自选基金" key="selected">
          <Card>
            <Table
              columns={selectedColumns}
              dataSource={selectedFunds}
              rowKey="序号"
              scroll={{ x: 2000 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total: number) => `共 ${total} 条`,
                onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
              }}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FundOpen;
