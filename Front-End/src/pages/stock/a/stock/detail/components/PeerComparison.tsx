import React, { useState, useCallback, Suspense, memo } from 'react';
import { Tabs, Spin } from 'antd';

const ValuationComparison = React.lazy(() => import('./ValuationComparison'));

const ComponentFallback = memo(() => (
  <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="small" />
  </div>
));

const PeerComparison: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('valuation-comparison');

  const handleTabChange = useCallback((key: string) => setActiveTab(key), []);

  const items = [
    {
      key: 'valuation-comparison',
      label: '估值比较',
      children: (
        <Suspense fallback={<ComponentFallback />}>
          <ValuationComparison />
        </Suspense>
      ),
    },
  ];

  return (
    <Tabs
      activeKey={activeTab}
      onChange={handleTabChange}
      items={items}
      destroyInactiveTabPane={false}
      size="small"
    />
  );
};

export default memo(PeerComparison);
