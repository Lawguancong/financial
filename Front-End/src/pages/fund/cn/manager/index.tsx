import React from 'react';
import { Card, Button } from 'antd';
import FundManagerTable from '../open/components/FundManagerTable';

const FundManager: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Button type="primary" onClick={() => window.location.reload()}>
            搜索
          </Button>
        </div>
      </Card>

      <FundManagerTable
        mode="list"
        showTitle={false}
      />
    </div>
  );
};

export default FundManager;
