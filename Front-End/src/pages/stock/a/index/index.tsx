import React, { useEffect, useState } from 'react';
import { Table, Typography } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const { Link } = Typography;

interface IndexData {
  指数代码: string;
  指数简称: string;
  指数全称: string;
  发布时间: string;
  基日: string;
  基点: number;
  指数类别: string;
  指数系列: string;
  资产类别: string;
  指数币种: string;
  样本数量: number;
  最新收盘: number;
  近一个月收益率: number;
  合作指数: string;
  跟踪产品: string;
  指数合规: string;
  指数热点: string | null;
}

const Index: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8080/api/public/index_csindex_all');
      console.log('指数列表 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getUniqueValues = (key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => String(item[key] || ''))))
      .filter(value => value !== 'null' && value !== 'undefined')
      .sort();
  };

  const getUniqueDateValues = (key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => {
      const date = item[key];
      return date ? moment(date).format('YYYY-MM-DD') : '';
    })))
      .filter(value => value !== 'null' && value !== 'undefined' && value !== '')
      .sort();
  };

  const columns = [
    {
      title: '指数代码',
      dataIndex: '指数代码',
      key: '指数代码',
      width: 120,
      fixed: 'left' as const,
      sorter: true,
      render: (code: string, record: IndexData) => (
        <Link 
          onClick={() => {
            const publishDate = record['发布时间'] ? moment(record['发布时间']).format('YYYYMMDD') : '';
            navigate(`/stock/a/index/detail?code=${code}&publishDate=${publishDate}`);
          }}
          style={{ cursor: 'pointer' }}
        >
          {code}
        </Link>
      ),
    },
    {
      title: '指数简称',
      dataIndex: '指数简称',
      key: '指数简称',
      width: 120,
      fixed: 'left' as const,
      sorter: true,
    },
    {
      title: '发布时间',
      dataIndex: '发布时间',
      key: '发布时间',
      width: 180,
      fixed: 'left' as const,
      sorter: true,
      render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
      filters: getUniqueDateValues('发布时间').map(value => ({ text: value, value })),
    },
    {
      title: '指数全称',
      dataIndex: '指数全称',
      key: '指数全称',
      width: 200,
      sorter: true,
    },
    {
      title: '指数类别',
      dataIndex: '指数类别',
      key: '指数类别',
      width: 100,
      sorter: true,
      filters: getUniqueValues('指数类别').map(value => ({ text: value, value })),
    },
    {
      title: '指数系列',
      dataIndex: '指数系列',
      key: '指数系列',
      width: 150,
      sorter: true,
      filters: getUniqueValues('指数系列').map(value => ({ text: value, value })),
    },
    {
      title: '资产类别',
      dataIndex: '资产类别',
      key: '资产类别',
      width: 100,
      sorter: true,
      filters: getUniqueValues('资产类别').map(value => ({ text: value, value })),
    },
    {
      title: '指数币种',
      dataIndex: '指数币种',
      key: '指数币种',
      width: 100,
      sorter: true,
      filters: getUniqueValues('指数币种').map(value => ({ text: value, value })),
    },
    {
      title: '基日',
      dataIndex: '基日',
      key: '基日',
      width: 120,
      sorter: true,
      render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
    },
    {
      title: '基点',
      dataIndex: '基点',
      key: '基点',
      width: 100,
      sorter: true,
    },
    {
      title: '样本数量',
      dataIndex: '样本数量',
      key: '样本数量',
      width: 100,
      sorter: true,
    },
    {
      title: '最新收盘',
      dataIndex: '最新收盘',
      key: '最新收盘',
      width: 120,
      sorter: true,
    },
    {
      title: '近一个月收益率(%)',
      dataIndex: '近一个月收益率',
      key: '近一个月收益率',
      width: 150,
      sorter: true,
    },
   
    {
      title: '合作指数',
      dataIndex: '合作指数',
      key: '合作指数',
      width: 100,
      sorter: true,
      filters: getUniqueValues('合作指数').map(value => ({ text: value, value })),
    },
    {
      title: '跟踪产品',
      dataIndex: '跟踪产品',
      key: '跟踪产品',
      width: 100,
      sorter: true,
      filters: getUniqueValues('跟踪产品').map(value => ({ text: value, value })),
    },
    {
      title: '指数合规',
      dataIndex: '指数合规',
      key: '指数合规',
      width: 100,
      sorter: true,
      filters: getUniqueValues('指数合规').map(value => ({ text: value, value })),
    },
    {
      title: '指数热点',
      dataIndex: '指数热点',
      key: '指数热点',
      width: 100,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="指数代码"
        scroll={{ x: 2000, y: 'calc(100vh - 200px)' }}
        pagination={false}
      />
    </div>
  );
};

export default Index;
