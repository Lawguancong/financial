import React from 'react';
import { Card, Tabs } from 'antd';
import DividendRankPanel from './components/DividendRankPanel';
import DividendHistoryPanel from './components/DividendHistoryPanel';

const { TabPane } = Tabs;

const FundDividend: React.FC = () => {
  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f5f5f5' }}>

      {/* Tab 页面 */}
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <Tabs defaultActiveKey="rank">
          <TabPane tab="基金分红排名" key="rank">
            <DividendRankPanel />
          </TabPane>
          <TabPane tab="基金历年分红" key="history">
            <DividendHistoryPanel />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default FundDividend;
