import React, { useEffect, useState } from 'react';
import { Card, Table, message } from 'antd';
import akshareApi from '@/utils/akshareApi';
import apiClient from '@/utils/axios';

const AkshareTest: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchStockAGxl = async () => {
    setLoading(true);
    try {
      const response = await akshareApi.getStockAGxl({symbol:'上证A股'});

      if (response.success) {
        setData(response.data);
        message.success('获取A股股息率数据成功');
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      message.error('请求失败，请检查后端服务是否运行');
      console.error('Error fetching stock data:', error);
    } finally {
      setLoading(false);
    }

    try {
       const response = await akshareApi.getStockATTMLYR({});
    } catch (error) {
      // message.error('请求失败，请检查后端服务是否运行');
      console.error('Error fetching stock data:', error);
    }
    try {
       await apiClient.get('/api/public/stock_a_ttm_lyr')
    } catch (error) {
      // message.error('请求失败，请检查后端服务是否运行');
      console.error('Error fetching stock data:', error);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchStockAGxl();
  }, []);

  // 定义表格列
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '股息率',
      dataIndex: 'gxl',
      key: 'gxl',
    },
    // 其他列根据实际返回数据添加
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card title="AKShare API 测试" extra={<button onClick={fetchStockAGxl}>刷新数据</button>}>
        <Table 
          dataSource={data} 
          columns={columns} 
          loading={loading} 
          rowKey="date"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default AkshareTest;
