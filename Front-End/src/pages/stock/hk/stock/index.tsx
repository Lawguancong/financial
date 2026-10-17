import React, { useState } from 'react';
import { Tabs } from 'antd';
import TabPane from 'antd/es/tabs/TabPane';
import HkOutTrading from './components/HkOutTrading';

const HkStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('OutTrading');

  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="非交易时间" key="OutTrading">
          <HkOutTrading />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default HkStock;
