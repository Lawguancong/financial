import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Spin, Input, Typography, Checkbox, Slider, message } from 'antd';
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
    pageSize: 50,
  });
  const [excludedNames, setExcludedNames] = useState<string[]>(["C"]);
  const [includedNames, setIncludedNames] = useState<string[]>([]);
  const [rawData, setRawData] = useState<FundData[]>([]);

  // 是否计算推荐买点
  const [calculateRecommendation, setCalculateRecommendation] = useState<boolean>(false);

  // 区间百分比过滤条件 (使用 Slider)
  const [near1YearRange, setNear1YearRange] = useState<[number, number]>([-100, 100]);
  const [near2YearRange, setNear2YearRange] = useState<[number, number]>([-100, 100]);
  const [near3YearRange, setNear3YearRange] = useState<[number, number]>([-100, 100]);
  const [yearToDateRange, setYearToDateRange] = useState<[number, number]>([-100, 100]);
  const [sinceInceptionRange, setSinceInceptionRange] = useState<[number, number]>([-100, 3000]);

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
    // {
    //   title: '自定义',
    //   dataIndex: '自定义',
    //   key: '自定义',
    //   width: 100,
    //   sorter: numberSorter('自定义'),
    //   render: (value: number) => `${value?.toFixed(2)}%`,
    //   ...createRangeFilter('自定义'),
    // } as any,
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

    // 过滤掉关键字段为 null 或 undefined 的数据
    filteredData = filteredData.filter(item => {
      return item['近1年'] !== null && item['近1年'] !== undefined &&
        item['近2年'] !== null && item['近2年'] !== undefined &&
        item['近3年'] !== null && item['近3年'] !== undefined &&
        item['今年来'] !== null && item['今年来'] !== undefined &&
        item['成立来'] !== null && item['成立来'] !== undefined;
    });

    // 根据近1年区间过滤
    filteredData = filteredData.filter(item => {
      const value = item['近1年'] as number;
      return value >= near1YearRange[0] && value <= near1YearRange[1];
    });

    // 根据近2年区间过滤
    filteredData = filteredData.filter(item => {
      const value = item['近2年'] as number;
      return value >= near2YearRange[0] && value <= near2YearRange[1];
    });

    // 根据近3年区间过滤
    filteredData = filteredData.filter(item => {
      const value = item['近3年'] as number;
      return value >= near3YearRange[0] && value <= near3YearRange[1];
    });

    // 根据今年来区间过滤
    filteredData = filteredData.filter(item => {
      const value = item['今年来'] as number;
      return value >= yearToDateRange[0] && value <= yearToDateRange[1];
    });

    // 根据成立来区间过滤
    filteredData = filteredData.filter(item => {
      const value = item['成立来'] as number;
      return value >= sinceInceptionRange[0] && value <= sinceInceptionRange[1];
    });

    // 不包含基金简称过滤
    if (excludedNames.length > 0) {
      filteredData = filteredData.filter(item => {
        const fundName = (item['基金简称'] || '').toLowerCase();
        return !excludedNames.some(excludedName =>
          fundName.includes(excludedName.toLowerCase())
        );
      });
    }

    // 包含基金简称过滤
    if (includedNames.length > 0) {
      filteredData = filteredData.filter(item => {
        const fundName = (item['基金简称'] || '').toLowerCase();
        return includedNames.some(includedName =>
          fundName.includes(includedName.toLowerCase())
        );
      });
    }
    console.log(' filteredData', filteredData);

    // 根据 checkbox 状态决定是否计算推荐买点
    if (calculateRecommendation) {
      const results: FundData[] = [];
      for (const item of filteredData) {
        message.info(`正在分析【${item['基金简称']}】中...`);
        const calculatedData = await fetchFundDetailAndCalculate(item['基金代码']);
        if (calculatedData?.length > 0) {
          results.push({
            ...item,
            ['__推荐买点__']: calculatedData?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(','),
          });
        } else {
          results.push({
            ...item,
            ['__推荐买点__']: '',
          });
        }
      }
      console.log(' results', results);
      return results;
    }

    return filteredData;
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
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
            <span>包含基金简称：</span>
            <Select
              mode="tags"
              style={{ width: 300 }}
              placeholder="输入关键词后回车添加"
              value={includedNames}
              onChange={setIncludedNames}
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
          <div
            onClick={() => setCalculateRecommendation(!calculateRecommendation)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 20px',
              background: calculateRecommendation
                ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                : 'linear-gradient(135deg, #b6bee3ff 0%, #b1aeb5ff 100%)',
              borderRadius: '25px',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: calculateRecommendation
                ? '0 8px 25px rgba(56, 239, 125, 0.5), 0 0 0 3px rgba(56, 239, 125, 0.2)'
                : '0 4px 15px rgba(102, 126, 234, 0.3)',
              cursor: 'pointer',
              transform: calculateRecommendation ? 'scale(1.02)' : 'scale(1)',
              border: '2px solid transparent',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: calculateRecommendation
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {calculateRecommendation ? '✓' : '○'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 'bold',
                color: '#fff',
                fontSize: '14px',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}>
                {calculateRecommendation ? '✨ 已启用智能分析' : '💡 计算推荐买点'}
              </span>
              <span style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '11px',
                marginTop: '2px'
              }}>
                {calculateRecommendation ? '搜索后将分析最佳买入时机...' : '启用后将计算RSI指标'}
              </span>
            </div>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: calculateRecommendation
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.5)',
                animation: calculateRecommendation ? 'pulse 2s infinite' : 'none'
              }}
            />
            <style>{`
              @keyframes pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); }
                50% { box-shadow: 0 0 0 8px rgba(255,255,255,0); }
              }
            `}</style>
          </div>
          <Button type="primary" onClick={fetchFundData} loading={loading}>
            搜索
          </Button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '60px' }}>近1年：</span>
            <Slider
              range
              min={-100}
              max={500}
              value={near1YearRange}
              onChange={(value) => setNear1YearRange(value as [number, number])}
              style={{ flex: 1, minWidth: '300px' }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
            <span style={{ width: '120px', textAlign: 'right' }}>{near1YearRange[0]}% ~ {near1YearRange[1]}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '60px' }}>近2年：</span>
            <Slider
              range
              min={-100}
              max={500}
              value={near2YearRange}
              onChange={(value) => setNear2YearRange(value as [number, number])}
              style={{ flex: 1, minWidth: '300px' }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
            <span style={{ width: '120px', textAlign: 'right' }}>{near2YearRange[0]}% ~ {near2YearRange[1]}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '60px' }}>近3年：</span>
            <Slider
              range
              min={-100}
              max={500}
              value={near3YearRange}
              onChange={(value) => setNear3YearRange(value as [number, number])}
              style={{ flex: 1, minWidth: '300px' }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
            <span style={{ width: '120px', textAlign: 'right' }}>{near3YearRange[0]}% ~ {near3YearRange[1]}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '60px' }}>今年来：</span>
            <Slider
              range
              min={-100}
              max={500}
              value={yearToDateRange}
              onChange={(value) => setYearToDateRange(value as [number, number])}
              style={{ flex: 1, minWidth: '300px' }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
            <span style={{ width: '120px', textAlign: 'right' }}>{yearToDateRange[0]}% ~ {yearToDateRange[1]}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '60px' }}>成立来：</span>
            <Slider
              range
              min={-100}
              max={10000}
              value={sinceInceptionRange}
              onChange={(value) => setSinceInceptionRange(value as [number, number])}
              style={{ flex: 1, minWidth: '300px' }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
            <span style={{ width: '120px', textAlign: 'right' }}>{sinceInceptionRange[0]}% ~ {sinceInceptionRange[1]}%</span>
          </div>
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