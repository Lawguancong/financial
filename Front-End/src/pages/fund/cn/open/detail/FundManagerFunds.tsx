import React from 'react';
import FundManagerTable from '../components/FundManagerTable';

interface FundManagerFundsProps {
  symbol: string | null;
}

const FundManagerFunds: React.FC<FundManagerFundsProps> = ({ symbol }) => {
  return (
    <FundManagerTable
      mode="funds"
      symbol={symbol}
      showTitle
      titleText="在管基金"
    />
  );
};

export default FundManagerFunds;
