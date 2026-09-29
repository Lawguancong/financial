import React, { useEffect, useState, useRef } from 'react';
import { Table, Typography, InputNumber, Space, Button, Input, Tabs, message } from 'antd';
import OutTrading from './components/OutTrading';
import TabPane from 'antd/es/tabs/TabPane';
import InTrading from './components/InTrading';





const Stock: React.FC = () => {

  const [activeTab, setActiveTab] = useState<string>('OutTrading');



  return (
    <div style={{ padding: '24px' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="非交易时间" key="OutTrading">
          <OutTrading />
        </TabPane>
        <TabPane tab="交易时间（todo）" key="InTrading">
          <InTrading />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Stock;
