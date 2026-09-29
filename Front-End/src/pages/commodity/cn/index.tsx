import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Typography } from 'antd';
import apiClient from '@/utils/axios';

const { Link } = Typography;

interface CommodityIndexData {
  序号: number;
  品种: string;
  中文名: string;
}

const Index: React.FC = () => {
  const [data, setData] = useState<CommodityIndexData[]>([]);
  const [loading, setLoading] = useState(false);

  // 品种代码到中文名称的映射
  const getCommodityName = (code: string): string => {
    const nameMap: Record<string, string> = {
      'Au99.99': '黄金99.99',
      'Au99.95': '黄金99.95',
      'Au100g': '黄金100克',
      'Pt99.95': '铂金99.95',
      'Ag(T+D)': '白银(T+D)',
      'Au(T+D)': '黄金(T+D)',
      'mAu(T+D)': '迷你黄金(T+D)',
      'Au(T+N1)': '黄金(T+N1)',
      'Au(T+N2)': '黄金(T+N2)',
      'Ag99.99': '白银99.99',
      'iAu99.99': '国际板黄金99.99',
      'Au99.5': '黄金99.5',
      'iAu100g': '国际板黄金100克',
      'iAu99.5': '国际板黄金99.5',
      'PGC30g': '钯金30克',
      'NYAuTN06': '纽约金TN06',
      'NYAuTN12': '纽约金TN12'
    };
    return nameMap[code] || code;
  };

  // 跳转到详情页面
  const handleNavigateToDetail = (symbol: string) => {
    window.open(`/commodity/cn/index/detail?symbol=${encodeURIComponent(symbol)}`, '_blank');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/spot_symbol_table_sge');
      console.log('大宗商品指数 -> response', response);
      const rawData = response?.data || [];
      // 解析数据，添加中文名
      const parsedData = rawData.map((item: any) => ({
        ...item,
        中文名: getCommodityName(item.品种)
      }));
      setData(parsedData);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = useMemo(() => [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 10,
      sorter: (a: CommodityIndexData, b: CommodityIndexData) => a.序号 - b.序号,
    },
    {
      title: '品种',
      dataIndex: '品种',
      key: '品种',
      width: 10,
    },
    {
      title: '中文名',
      dataIndex: '中文名',
      key: '中文名',
      width: 200,
      render: (text: string, record: CommodityIndexData) => (
        <Link onClick={() => handleNavigateToDetail(record.品种)}>{text}</Link>
      ),
    },
  ], []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', textAlign: 'right' }}>
        <Button type="primary" onClick={fetchData} loading={loading}>
          刷新数据
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="序号"
        scroll={{ x: 3000, y: 'calc(100vh - 200px)' }}
        pagination={false}
      />
    </div>
  );
};

export default Index;