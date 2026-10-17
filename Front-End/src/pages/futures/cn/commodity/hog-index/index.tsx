import React, { useEffect, useState } from 'react';
import { Card, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import type { KLineData } from '@/utils/stockUtils';
import IndexMetrics from '@/components/IndexMetrics';

// RSI·推荐级别：与 /stock/us/index 统一复用同一组件（路由层提供 Suspense 边界）
const RsiFilterMark = React.lazy(() => import('@/components/RsiFilterMark'));

/** index_hog_spot_price 接口返回字段（周频） */
interface HogSpotPriceItem {
  日期: string;
  指数: number;
}

/**
 * 生猪指数：复用 IndexMetrics（行情/年化收益率/回撤率/波动率）与 RsiFilterMark（RSI·推荐级别）
 * 数据来源 /api/public/index_hog_spot_price（无入参，周频），取「指数」作为收盘序列
 */
const HogIndex: React.FC = () => {
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/index_hog_spot_price');
      console.log('生猪指数 -> response', response);
      const list: KLineData[] = (response?.data || [])
        .map((item: HogSpotPriceItem) => ({
          日期: String(item.日期).slice(0, 10),
          收盘: Number(item.指数),
        }))
        .filter((item: KLineData) => Number.isFinite(item.收盘));
      setData(list);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Card
      title="生猪指数"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      }
    >
      <Spin spinning={loading}>
        <IndexMetrics data={data} />
        <RsiFilterMark data={data} type="index" />
      </Spin>
    </Card>
  );
};

export default HogIndex;
