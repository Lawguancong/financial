import React, { useState, useEffect } from 'react';
import { Button, Table, Card, Tabs, Space, Alert } from 'antd';
import moment from 'moment';
import { numberSorter } from '@/utils/tableUtils';
import { fetchFundRecommendationPointsBoth } from '@/utils/fundUtils';
import { isRecentDate } from '@/utils/stockUtils';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
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
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 });
  // 自选基金表格勾选的基金代码
  const [checkedFundCodes, setCheckedFundCodes] = useState<string[]>([]);
  // 推荐买点批量计算中
  const [calculating, setCalculating] = useState(false);

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
    setCheckedFundCodes(prev => prev.filter(code => code !== fund['基金代码']));
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

  // 对已勾选的自选基金批量计算推荐买点（定量 + 百分位）
  const calculateCheckedFunds = async () => {
    // 只计算当前自选列表中仍存在且被勾选的基金
    const targets = selectedFunds.filter(f => checkedFundCodes.includes(String(f['基金代码'])));
    setCalculating(true);
    let working = [...selectedFunds];
    try {
      await runRecommendationBatchCalculation({
        targets,
        getKey: f => String(f['基金代码']),
        getName: f => String(f['基金名称'] || f['基金简称'] || f['基金代码']),
        emptyWarn: '请先勾选需要计算的基金',
        fetchBuyPoints: f => fetchFundRecommendationPointsBoth(String(f['基金代码'])),
        onItemDone: (fund, { quantitative, percentile, monthlyPercentile }) => {
          working = working.map(f =>
            f['基金代码'] === fund['基金代码']
              ? { ...f, __推荐买点定量__: quantitative, __推荐买点百分位__: percentile, __月RSI6百分位__: monthlyPercentile }
              : f,
          );
          // 每算完一只即更新表格与本地缓存，结果渐进可见
          setSelectedFunds(working);
          saveSelectedFunds(working);
        },
      });
    } finally {
      setCalculating(false);
    }
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
    {
      title: '推荐买点（百分位）',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 120,
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#f6ffed',
                      color: '#52c41a',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #b7eb8f',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      title: '推荐买点（定量）',
      dataIndex: '__推荐买点定量__',
      key: '__推荐买点定量__',
      width: 120,
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#e6f7ff',
                      color: '#1890ff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #91caff',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },

    {
      title: '月RSI6百分位策略',
      dataIndex: '__月RSI6百分位__',
      key: '__月RSI6百分位__',
      width: 120,
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#f9f0ff',
                      color: '#722ed1',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #d3adf7',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      title: '日期', dataIndex: '日期', key: '日期', width: 120,
      render: (v: string) => v ? moment(v).format('YYYY-MM-DD') : '-'
    },
    {
      title: '单位净值', dataIndex: '单位净值', key: '单位净值', width: 100,
      sorter: numberSorter('单位净值'), render: (v: number) => v?.toFixed(4)
    },
    {
      title: '累计净值', dataIndex: '累计净值', key: '累计净值', width: 100,
      sorter: numberSorter('累计净值'), render: (v: number) => v?.toFixed(4)
    },
    {
      title: '日增长率', dataIndex: '日增长率', key: '日增长率', width: 100,
      sorter: numberSorter('日增长率'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近1周', dataIndex: '近1周', key: '近1周', width: 100,
      sorter: numberSorter('近1周'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近1月', dataIndex: '近1月', key: '近1月', width: 100,
      sorter: numberSorter('近1月'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近3月', dataIndex: '近3月', key: '近3月', width: 100,
      sorter: numberSorter('近3月'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近6月', dataIndex: '近6月', key: '近6月', width: 100,
      sorter: numberSorter('近6月'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近1年', dataIndex: '近1年', key: '近1年', width: 100,
      sorter: numberSorter('近1年'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近2年', dataIndex: '近2年', key: '近2年', width: 100,
      sorter: numberSorter('近2年'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '近3年', dataIndex: '近3年', key: '近3年', width: 100,
      sorter: numberSorter('近3年'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '今年来', dataIndex: '今年来', key: '今年来', width: 100,
      sorter: numberSorter('今年来'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    {
      title: '成立来', dataIndex: '成立来', key: '成立来', width: 100,
      sorter: numberSorter('成立来'), render: (v: number) => `${v?.toFixed(2)}%`
    },
    { title: '手续费', dataIndex: '手续费', key: '手续费', width: 150 },

    {
      title: '操作', key: 'action', width: 180,
      render: (_: unknown, record: FundData) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="primary" size="small" disabled={calculating} onClick={() => removeFromSelected(record)}>取消自选</Button>
          <Button size="small" disabled={calculating} onClick={() => moveToTop(record)}>置顶</Button>
          <Button size="small" disabled={calculating} onClick={() => moveToBottom(record)}>置底</Button>
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
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              title="关于「周RSI6策略」缺失的说明"
              description={
                <span style={{ lineHeight: 1.8 }}>
                  基金行情接口<strong>累计收益率 未返回每日净值数据</strong>，无法聚合出日K线/周K线，
                  因此本页<strong style={{ color: '#d46b08' }}>不提供「周RSI6百分位策略」</strong>买点。
                  当前支持的买点为：推荐买点（定量）、推荐买点（百分位）、月RSI6百分位策略；
                  单只基金的月 / 季 RSI6 详情可进入基金详情页查看。
                </span>
              }
            />
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button
                  type="primary"
                  loading={calculating}
                  disabled={checkedFundCodes.length === 0}
                  onClick={calculateCheckedFunds}
                >
                  计算推荐买点{checkedFundCodes.length > 0 ? `（已选 ${checkedFundCodes.length} 只）` : ''}
                </Button>
                {checkedFundCodes.length > 0 && (
                  <Button disabled={calculating} onClick={() => setCheckedFundCodes([])}>
                    清空勾选
                  </Button>
                )}
              </Space>
              <span style={{ color: '#888' }}>共 {selectedFunds.length} 只自选基金</span>
            </div>
            <Table
              rowSelection={{
                selectedRowKeys: checkedFundCodes,
                onChange: (keys: React.Key[]) => setCheckedFundCodes(keys.map(String)),
                getCheckboxProps: () => ({ disabled: calculating }),
              }}
              columns={selectedColumns}
              dataSource={selectedFunds}
              rowKey="基金代码"
              sticky
              scroll={{ x: 2800 }}
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
