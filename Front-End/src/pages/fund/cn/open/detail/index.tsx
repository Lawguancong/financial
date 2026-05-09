import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Card } from 'antd';
import UnitNav from './UnitNav';
import CumulativeNav from './CumulativeNav';
import CumulativeReturn from './CumulativeReturn';
import apiClient from '@/utils/axios';

const { TabPane } = Tabs;

// 最近x年 全部
const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '-';
  const [symbolInfo, setSymbolInfo] = useState<Record<string, string>>({});
  // const symbolInfo = searchParams.get('symbolInfo') || '-';
  const [activeTab, setActiveTab] = useState<string>('累计收益率走势');

  // fund_name_em

  const getFundInfo = async () => {
    if (!symbol) return
    const response = await apiClient.get('/api/public/fund_individual_basic_info_xq', {
      params: { symbol },
    });
    console.log('1111 基金基本信息', response)
    const obj = response?.data?.reduce((acc: Record<string, string>, cur: { item: string; value: string }) => {
      acc[cur.item] = cur.value;
      return acc;
    }, {});
    console.log('1111 基金基本信息 Object', obj)
    setSymbolInfo(obj)
  };
  useEffect(() => {
    getFundInfo()
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{symbol} {symbolInfo?.['基金名称']}</h2>
        <p>业绩比较基准：{symbolInfo?.['业绩比较基准']}</p>
        <p>基金代码：{symbolInfo?.['基金代码']}</p>
        <p>基金全称：{symbolInfo?.['基金全称']}</p>
        <p>基金公司：{symbolInfo?.['基金公司']}</p>
        <p>基金名称：{symbolInfo?.['基金名称']}</p>
        <p>基金类型：{symbolInfo?.['基金类型']}</p>
        <p>基金经理：<a>{symbolInfo?.['基金经理']}</a></p> 
        <p>基金评级：{symbolInfo?.['基金评级']}</p>
        <p>成立时间：{symbolInfo?.['成立时间']}</p>
        <p>托管银行：{symbolInfo?.['托管银行']}</p>
        <p>投资目标：{symbolInfo?.['投资目标']}</p>
        <p>投资策略：{symbolInfo?.['投资策略']}</p>
        <p>最新规模：{symbolInfo?.['最新规模']}</p>
        <p>评级机构：{symbolInfo?.['评级机构']}</p>

      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
      // destroyInactiveTabPane={false} // 不销毁tab，保持状态
      >
        <TabPane tab="累计收益率走势" key="累计收益率走势">
          {useMemo(() => <CumulativeReturn symbol={symbol} />, [symbol])}
        </TabPane>
        <TabPane tab="单位净值走势" key="单位净值走势">
          {useMemo(() => <UnitNav symbol={symbol} />, [symbol])}
        </TabPane>
        <TabPane tab="累计净值走势" key="累计净值走势">
          {useMemo(() => <CumulativeNav symbol={symbol} />, [symbol])}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FundOpenDetail;