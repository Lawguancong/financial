import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Spin, Input, Typography } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { createRangeFilter, numberSorter, stringSorter } from '@/utils/tableUtils';
import { calculateRSI } from '@/utils/stockUtils';
import { calculateRecommendationLevel } from '@/pages/fund/cn/open/detail/constants';

const { Link } = Typography;

interface FundData {
  序号: number;
  基金代码: string;
  基金简称: string;
  日期: string;
  单位净值: number;
  累计净值: number;
  日增长率: number;
  近1周: number;
  近1月: number;
  近3月: number;
  近6月: number;
  近1年: number;
  近2年: number;
  近3年: number;
  今年来: number;
  成立来: number;
  自定义: number;
  手续费: string;
  RSI6月: number;
  RSI6季: number;
  __推荐买点__: number;
}

const fundTypeOptions = [
  { label: '全部', value: '全部' },
  { label: '股票型', value: '股票型' },
  { label: '混合型', value: '混合型' },
  { label: '债券型', value: '债券型' },
  { label: '指数型', value: '指数型' },
  { label: 'QDII', value: 'QDII' },
  { label: 'FOF', value: 'FOF' },
];

const FundFilterPanel: React.FC = () => {
  const [fundType, setFundType] = useState<string>('全部');
  const [data, setData] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });
  const [excludedNames, setExcludedNames] = useState<string[]>(["C"]);
  const [rawData, setRawData] = useState<FundData[]>([]);

  const columns = [
    {
      title: '序号',
      dataIndex: '序号',
      key: '序号',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '基金代码',
      dataIndex: '基金代码',
      key: '基金代码',
      width: 120,
      fixed: 'left' as const,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['基金代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '基金简称',
      dataIndex: '基金简称',
      key: '基金简称',
      width: 200,
      fixed: 'left' as const,
      render: (name: string, record: FundData) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${record['基金代码']}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入基金简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: FundData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['基金简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
    },
    {
      title: '日期',
      dataIndex: '日期',
      key: '日期',
      width: 120,
      render: (value: string) => {
        return value && moment(value).format('YYYY-MM-DD') || '-';
      },
    },
    {
      title: '单位净值',
      dataIndex: '单位净值',
      key: '单位净值',
      width: 100,
      sorter: numberSorter('单位净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('单位净值'),
    } as any,
    {
      title: '累计净值',
      dataIndex: '累计净值',
      key: '累计净值',
      width: 100,
      sorter: numberSorter('累计净值'),
      render: (value: number) => value?.toFixed(4),
      ...createRangeFilter('累计净值'),
    } as any,
    {
      title: '日增长率',
      dataIndex: '日增长率',
      key: '日增长率',
      width: 100,
      sorter: numberSorter('日增长率'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('日增长率'),
    } as any,
    {
      title: '近1周',
      dataIndex: '近1周',
      key: '近1周',
      width: 100,
      sorter: numberSorter('近1周'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1周'),
    } as any,
    {
      title: '近1月',
      dataIndex: '近1月',
      key: '近1月',
      width: 100,
      sorter: numberSorter('近1月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1月'),
    } as any,
    {
      title: '近3月',
      dataIndex: '近3月',
      key: '近3月',
      width: 100,
      sorter: numberSorter('近3月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3月'),
    } as any,
    {
      title: '近6月',
      dataIndex: '近6月',
      key: '近6月',
      width: 100,
      sorter: numberSorter('近6月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近6月'),
    } as any,
    {
      title: '近1年',
      dataIndex: '近1年',
      key: '近1年',
      width: 100,
      sorter: numberSorter('近1年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1年'),
    } as any,
    {
      title: '近2年',
      dataIndex: '近2年',
      key: '近2年',
      width: 100,
      sorter: numberSorter('近2年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近2年'),
    } as any,
    {
      title: '近3年',
      dataIndex: '近3年',
      key: '近3年',
      width: 100,
      sorter: numberSorter('近3年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3年'),
    } as any,
    {
      title: '今年来',
      dataIndex: '今年来',
      key: '今年来',
      width: 100,
      sorter: numberSorter('今年来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('今年来'),
    } as any,
    {
      title: '成立来',
      dataIndex: '成立来',
      key: '成立来',
      width: 100,
      sorter: numberSorter('成立来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('成立来'),
    } as any,
    {
      title: '自定义',
      dataIndex: '自定义',
      key: '自定义',
      width: 100,
      sorter: numberSorter('自定义'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('自定义'),
    } as any,
    {
      title: '手续费',
      dataIndex: '手续费',
      key: '手续费',
      width: 150,
      sorter: numberSorter('手续费'),
      ...createRangeFilter('手续费'),
    },
    // {
    //   title: 'RSI6（月）',
    //   dataIndex: 'RSI6月',
    //   key: 'RSI6月',
    //   width: 100,
    //   sorter: numberSorter('RSI6月'),
    //   render: (value: number) => value?.toFixed(2),
    // },
    // {
    //   title: 'RSI6（季）',
    //   dataIndex: 'RSI6季',
    //   key: 'RSI6季',
    //   width: 100,
    //   sorter: numberSorter('RSI6季'),
    //   render: (value: number) => value?.toFixed(2),
    // },
    {
      title: '推荐买点',
      dataIndex: '__推荐买点__',
      key: '__推荐买点__',
      width: 400,
      sorter: stringSorter('__推荐买点__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',')?.reverse()?.filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {dates.map((date, index) => (
              <span
                key={index}
                style={{
                  backgroundColor: '#e6f7ff',
                  color: '#1890ff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  border: '1px solid #91caff',
                }}
              >
                {date}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const fetchFundDetailAndCalculate = async (fundCode: string): Promise<{ RSI6月: number; RSI6季: number; __推荐买点__: number } | null> => {
    try {
      const response = await apiClient.get('/api/public/fund_open_fund_info_em', {
        params: {
          symbol: fundCode,
          indicator: '累计收益率走势',
          period: '成立来',
        },
      });

      const detailData = response?.data || [];
      if (detailData.length === 0) return null;

      const dateKey = '日期';
      const closeKey = '累计收益率';

      // 月度数据处理：按月分组，取每个月的最后一天数据
      const monthlyMap = new Map<string, any>();
      detailData.forEach((item: any) => {
        const date = item[dateKey];
        const monthKey = moment(date).format('YYYY-MM');
        const currentItem = monthlyMap.get(monthKey);

        if (!currentItem) {
          monthlyMap.set(monthKey, item);
        } else {
          if (moment(date).isAfter(moment(currentItem[dateKey]))) {
            monthlyMap.set(monthKey, item);
          }
        }
      });

      const monthlyData = Array.from(monthlyMap.values()).sort((a: any, b: any) => {
        return moment(a[dateKey]).valueOf() - moment(b[dateKey]).valueOf();
      });

      // 季度数据处理：按季度分组，取每个季度的最后一天数据
      const quarterlyMap = new Map<string, any>();
      monthlyData.forEach((item: any) => {
        const date = item[dateKey];
        const year = moment(date).year();
        const quarter = moment(date).quarter();
        const quarterKey = `${year}-Q${quarter}`;
        const currentItem = quarterlyMap.get(quarterKey);

        if (!currentItem) {
          quarterlyMap.set(quarterKey, item);
        } else {
          if (moment(date).isAfter(moment(currentItem[dateKey]))) {
            quarterlyMap.set(quarterKey, item);
          }
        }
      });

      const quarterlyData = Array.from(quarterlyMap.values()).sort((a: any, b: any) => {
        return moment(a[dateKey]).valueOf() - moment(b[dateKey]).valueOf();
      });

      // 计算每月数据的RSI6
      const monthlyRSI6Data = calculateRSI({ data: monthlyData, closeKey, period: 6 });
      // 计算每季度数据的RSI6
      const quarterlyRSI6Data = calculateRSI({ data: quarterlyData, closeKey, period: 6 });

      console.log('monthlyRSI6Data', monthlyRSI6Data)
      console.log('quarterlyRSI6Data', quarterlyRSI6Data)


      const quarterlyRSIMap = new Map<string, number>();
      quarterlyRSI6Data.forEach(item => {
        const date = item[dateKey];
        const year = moment(date).year();
        const quarter = moment(date).quarter();
        const quarterKey = `${year}-Q${quarter}`;
        quarterlyRSIMap.set(quarterKey, item['__RSI6__']);
      });
      console.log('quarterlyRSIMap', quarterlyRSIMap)
      const RSI6Data = monthlyRSI6Data.map(item => {
        const date = item[dateKey];
        const year = moment(date).year();
        const quarter = moment(date).quarter();
        const quarterKey = `${year}-Q${quarter}`;
        const __monthlyRSI6__ = item['__RSI6__'];
        const __quarterlyRSI6__ = quarterlyRSIMap.get(quarterKey);
        return {
          日期: date,
          累计收益率: item[closeKey],
          __monthlyRSI6__: __monthlyRSI6__,
          __quarterlyRSI6__: __quarterlyRSI6__,
          __recommendationLevel__: calculateRecommendationLevel({
            __monthlyRSI6__, __quarterlyRSI6__,
          }),

        };
      })?.filter(item => [5, 3, 1].includes(item.__recommendationLevel__));
      console.log('RSI6Data', RSI6Data)
      return RSI6Data
      // const recommendationLevel = calculateRecommendationLevel(latestMonthlyRSI, latestQuarterlyRSI);
      // return { RSI6月: latestMonthlyRSI, RSI6季: latestQuarterlyRSI, __推荐买点__: recommendationLevel };
    } catch (error) {
      console.log('Error fetching fund detail:', error);
      return [];
    }
  };

  const applyFilters = async (rawData: FundData[]): Promise<FundData[]> => {
    let filteredData = [...rawData];

    const top50ByNear1Year = [...filteredData]
      .sort((a, b) => (a['近1年'] || 0) - (b['近1年'] || 0))
      .slice(0, 200);
    const top50ByNear2Year = [...filteredData]
      .sort((a, b) => (a['近2年'] || 0) - (b['近2年'] || 0))
      .slice(0, 200);
    const top50ByNear3Year = [...filteredData]
      .sort((a, b) => (a['近3年'] || 0) - (b['近3年'] || 0))
      .slice(0, 200);
    const top50ByNear1YearCodes = new Set(top50ByNear1Year.map(item => item['基金代码']));
    const top50ByNear2YearCodes = new Set(top50ByNear2Year.map(item => item['基金代码']));
    const top50ByNear3YearCodes = new Set(top50ByNear3Year.map(item => item['基金代码']));

    filteredData = filteredData.filter(item => {
      const code = item['基金代码'];
      return top50ByNear1YearCodes.has(code) &&
        top50ByNear2YearCodes.has(code) &&
        top50ByNear3YearCodes.has(code);
    });

    if (excludedNames.length > 0) {
      filteredData = filteredData.filter(item => {
        const fundName = (item['基金简称'] || '').toLowerCase();
        return !excludedNames.some(excludedName =>
          fundName.includes(excludedName.toLowerCase())
        );
      });
    }
    console.log(' filteredData', filteredData);

    const results: FundData[] = [];
    for (const item of filteredData) {
      const calculatedData = await fetchFundDetailAndCalculate(item['基金代码']);
      if (calculatedData?.length > 0) {
        results.push({
          ...item,
          ['__推荐买点__']: calculatedData?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(','),
        });
      }
    }
    console.log(' results', results);

    return results;
  };

  const fetchFundData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_open_fund_rank_em', {
        params: {
          symbol: fundType,
        },
      });
      const fetchedRawData = response?.data || [];
      setRawData(fetchedRawData);
      const filteredData = await applyFilters(fetchedRawData);
      console.log('filteredData', filteredData);
      setData(filteredData);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // if (rawData.length > 0) {
    //   applyFilters(rawData).then(filteredData => {
    //     setData(filteredData);
    //   });
    // }
  }, [excludedNames, rawData]);

  return (
    <>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>基金类型：</span>
            <Select
              style={{ width: 200 }}
              value={fundType}
              onChange={setFundType}
              options={fundTypeOptions}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>不包含基金简称：</span>
            <Select
              mode="tags"
              style={{ width: 300 }}
              placeholder="输入关键词后回车添加"
              value={excludedNames}
              onChange={setExcludedNames}
            />
          </div>
          <Button type="primary" onClick={fetchFundData} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        <Card>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="序号"
            scroll={{ x: 2000 }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ current: 1, pageSize: size });
              },
            }}
          />
        </Card>
      </Spin>
    </>
  );
};

export default FundFilterPanel;
export type { FundData };