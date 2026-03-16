import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Card } from 'antd';
import UnitNav from './UnitNav';
import CumulativeNav from './CumulativeNav';
import CumulativeReturn from './CumulativeReturn';

const { TabPane } = Tabs;

// 最近x年 全部
const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '-';
  const symbolName = searchParams.get('symbolName') || '-';
  const [activeTab, setActiveTab] = useState<string>('累计收益率走势');

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{symbolName} ({symbol})</h2>
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