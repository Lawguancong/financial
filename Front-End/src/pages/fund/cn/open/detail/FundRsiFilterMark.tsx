import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import RsiFilterMark from '@/components/RsiFilterMark';
import type { KLineData } from '@/utils/stockUtils';
import apiClient from '@/utils/axios';

interface FundRsiFilterMarkProps {
  symbol: string | null;
}

/**
 * 基金详情页 RSI6 分析组件
 * 复用股票详情页的 RsiFilterMark 组件，基金仅有月/季 RSI6 周期数据。
 * 将基金「累计收益率」API 数据映射为 KLineData（累计收益率 → 收盘）后传入。
 */
const FundRsiFilterMark: React.FC<FundRsiFilterMarkProps> = ({ symbol }) => {
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
          params: { symbol, indicator: '累计收益率走势', period: '成立来' },
        });
        const responseData = response?.data || [];
        // 基金数据字段：日期 + 累计收益率；映射为 KLineData 的 日期 + 收盘
        const klineData: KLineData[] = (responseData as Array<Record<string, string | number>>)
          .map((item) => ({
            日期: String(item['日期']),
            收盘: Number(item['累计收益率']),
          }))
          .filter((item) => !Number.isNaN(item.收盘));
        if (!cancelled) setData(klineData);
      } catch (error) {
        console.error('获取基金累计收益率数据失败:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return (
    <Spin spinning={loading}>
      <RsiFilterMark
        data={data}
        type="fund"
        visiblePeriods={['monthly', 'quarterly']}
      />
    </Spin>
  );
};

export default FundRsiFilterMark;
