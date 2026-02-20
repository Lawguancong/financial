import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, InputNumber, Space, Button } from 'antd';
import axios from 'axios';

const { Link } = Typography;

interface StockData {
  序号: number;
  代码: string;
  名称: string;
  最新价: number;
  涨跌幅: number;
  涨跌额: number;
  成交量: number;
  成交额: number;
  振幅: number;
  最高: number;
  最低: number;
  今开: number;
  昨收: number;
  量比: number;
  换手率: number;
  '市盈率-动态': number;
  市净率: number;
  总市值: number;
  流通市值: number;
  涨速: number;
  五分钟涨跌: number;
  六十日涨跌幅: number;
  年初至今涨跌幅: number;
}

interface RangeFilterValue {
  min?: number;
  max?: number;
}

const createRangeFilter = (dataKey: keyof StockData) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => {
    let minValue: number | undefined;
    let maxValue: number | undefined;
    
    try {
      const filterValue = selectedKeys[0] as string;
      if (filterValue) {
        const parsed = JSON.parse(filterValue) as RangeFilterValue;
        minValue = parsed.min;
        maxValue = parsed.max;
      }
    } catch {
    }
    
    return (
      <div style={{ padding: 8 }}>
        <Space orientation="vertical" size={8}>
          <div>
            <span style={{ marginRight: 8 }}>≥</span>
            <InputNumber
              placeholder="最小值"
              value={minValue}
              onChange={(value) => {
                const filterValue = JSON.stringify({ min: value, max: maxValue });
                setSelectedKeys([filterValue]);
              }}
              style={{ width: 120 }}
              precision={2}
            />
          </div>
          <div>
            <span style={{ marginRight: 8 }}>≤</span>
            <InputNumber
              placeholder="最大值"
              value={maxValue}
              onChange={(value) => {
                const filterValue = JSON.stringify({ min: minValue, max: value });
                setSelectedKeys([filterValue]);
              }}
              style={{ width: 120 }}
              precision={2}
            />
          </div>
          <Space>
            <Button type="primary" onClick={confirm} size="small">
              确定
            </Button>
            <Button onClick={() => {
              clearFilters();
              confirm();
            }} size="small">
              重置
            </Button>
          </Space>
        </Space>
      </div>
    );
  },
  filterIcon: (filtered: boolean) => (
    <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
  ),
  onFilter: (value: string | number | boolean, record: StockData) => {
    let minValue: number | undefined;
    let maxValue: number | undefined;
    
    try {
      const parsed = JSON.parse(String(value)) as RangeFilterValue;
      minValue = parsed.min;
      maxValue = parsed.max;
    } catch {
    }
    
    const recordValue = record[dataKey];
    
    if (recordValue === null || recordValue === undefined || recordValue === '' || recordValue === 'null' || recordValue === 'undefined') {
      return false;
    }
    
    const numericValue = Number(recordValue);
    
    if (isNaN(numericValue)) {
      return false;
    }
    
    if (minValue !== undefined && maxValue !== undefined && !isNaN(minValue) && !isNaN(maxValue)) {
      return numericValue >= minValue && numericValue <= maxValue;
    } else if (minValue !== undefined && !isNaN(minValue)) {
      return numericValue >= minValue;
    } else if (maxValue !== undefined && !isNaN(maxValue)) {
      return numericValue <= maxValue;
    }
    return true;
  },
});

const numberSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key] || 0;
  const bValue = b[key] || 0;
  return (aValue as number) - (bValue as number);
};

const stringSorter = (key: keyof StockData) => (a: StockData, b: StockData) => {
  const aValue = a[key];
  const bValue = b[key];
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue, 'zh-CN');
  }
  return 0;
};

const handleNavigateToDetail = (record: StockData) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const endDate = `${year}${month}${day}`;
  window.open(`/stock/a/stock/detail?symbol=${record.代码}&symbolName=${record.名称}&end_date=${endDate}`, '_blank');
};
const columns = [
  {
    title: '序号',
    dataIndex: '序号',
    key: '序号',
    width: 80,
    sorter: numberSorter('序号'),
  },
  {
    title: '代码',
    dataIndex: '代码',
    key: '代码',
    width: 100,
    fixed: 'left' as const,
    sorter: stringSorter('代码'),
  },
  {
    title: '名称',
    dataIndex: '名称',
    key: '名称',
    width: 150,
    fixed: 'left' as const,
    sorter: stringSorter('名称'),
    render: (name: string, record: StockData) => (
      <Link
        onClick={() => handleNavigateToDetail(record)}
        style={{ cursor: 'pointer', color: '#1890ff' }}
      >
        {name}
      </Link>
    ),
  },
  {
    title: '换手率(%)',
    dataIndex: '换手率',
    key: '换手率',
    width: 120,
    sorter: numberSorter('换手率'),
    ...createRangeFilter('换手率'),
  } as any,
  {
    title: '市盈率(动态)',
    dataIndex: '市盈率-动态',
    key: '市盈率-动态',
    width: 140,
    sorter: numberSorter('市盈率-动态'),
    ...createRangeFilter('市盈率-动态'),
  } as any,
  {
    title: '市净率',
    dataIndex: '市净率',
    key: '市净率',
    width: 100,
    sorter: numberSorter('市净率'),
    ...createRangeFilter('市净率'),
  } as any,
  {
    title: '总市值(元)',
    dataIndex: '总市值',
    key: '总市值',
    width: 120,
    sorter: numberSorter('总市值'),
  },
  {
    title: '流通市值(元)',
    dataIndex: '流通市值',
    key: '流通市值',
    width: 140,
    sorter: numberSorter('流通市值'),
  },
  {
    title: '最新价',
    dataIndex: '最新价',
    key: '最新价',
    width: 100,
    sorter: numberSorter('最新价'),
  },
  {
    title: '涨跌幅(%)',
    dataIndex: '涨跌幅',
    key: '涨跌幅',
    width: 120,
    sorter: numberSorter('涨跌幅'),
    render: (value: number) => (
      <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
        {value}%
      </span>
    ),
  },
  {
    title: '涨跌额',
    dataIndex: '涨跌额',
    key: '涨跌额',
    width: 100,
    sorter: numberSorter('涨跌额'),
    render: (value: number) => (
      <span style={{ color: value >= 0 ? '#f5222d' : '#52c41a' }}>
        {value}
      </span>
    ),
  },
  {
    title: '成交流(手)',
    dataIndex: '成交量',
    key: '成交量',
    width: 120,
    sorter: numberSorter('成交量'),
  },
  {
    title: '成交额(元)',
    dataIndex: '成交额',
    key: '成交额',
    width: 120,
    sorter: numberSorter('成交额'),
  },
  {
    title: '振幅(%)',
    dataIndex: '振幅',
    key: '振幅',
    width: 100,
    sorter: numberSorter('振幅'),
  },
  {
    title: '最高',
    dataIndex: '最高',
    key: '最高',
    width: 100,
    sorter: numberSorter('最高'),
  },
  {
    title: '最低',
    dataIndex: '最低',
    key: '最低',
    width: 100,
    sorter: numberSorter('最低'),
  },
  {
    title: '今开',
    dataIndex: '今开',
    key: '今开',
    width: 100,
    sorter: numberSorter('今开'),
  },
  {
    title: '昨收',
    dataIndex: '昨收',
    key: '昨收',
    width: 100,
    sorter: numberSorter('昨收'),
  },
  {
    title: '量比',
    dataIndex: '量比',
    key: '量比',
    width: 100,
    sorter: numberSorter('量比'),
  },

  {
    title: '涨速',
    dataIndex: '涨速',
    key: '涨速',
    width: 100,
    sorter: numberSorter('涨速'),
  },
  {
    title: '5分钟涨跌(%)',
    dataIndex: '五分钟涨跌',
    key: '五分钟涨跌',
    width: 140,
    sorter: numberSorter('五分钟涨跌'),
  },
  {
    title: '60日涨跌幅(%)',
    dataIndex: '六十日涨跌幅',
    key: '六十日涨跌幅',
    width: 140,
    sorter: numberSorter('六十日涨跌幅'),
  },
  {
    title: '年初至今涨跌幅(%)',
    dataIndex: '年初至今涨跌幅',
    key: '年初至今涨跌幅',
    width: 160,
    sorter: numberSorter('年初至今涨跌幅'),
  },
];

const Stock: React.FC = () => {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);



  const fetchData = async () => {
    const cachedData = sessionStorage.getItem('stockListData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setData(parsedData);
        setLoading(false);
        return;
      } catch (error) {
        console.log('解析缓存数据失败', error);
      }
    }

    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8080/api/public/stock_zh_a_spot_em');
      console.log('个股列表 -> response', response);
      const responseData = response?.data || [];
      // setData(responseData.slice(0, 100));

      setData(responseData);

      // sessionStorage.setItem('stockListData', JSON.stringify(responseData));
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
    <div style={{ padding: '24px' }}>
      {useMemo(() => (
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="代码"
          scroll={{ x: 3000, y: 'calc(100vh - 200px)' }}
          pagination={false}
        />
      ), [data, loading])}
    </div>
  );
};

export default Stock;
