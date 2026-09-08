import React, { useState, useEffect } from 'react';
import { Select, Button, Table, Card, Tabs, Typography, Input, Spin, Slider, message } from 'antd';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import { calculateRSI } from '@/utils/stockUtils';
import { calculateFundRecommendationLevel } from '@/pages/fund/cn/open/detail/constants';

const { Link } = Typography;
const { TabPane } = Tabs;

export interface IndexFundData {
  [key: string]: string | number;
}

interface IndexFundPanelProps {
  selectedFunds: IndexFundData[];
  onAddToSelected: (fund: IndexFundData) => void;
  onRemoveFromSelected: (fund: IndexFundData) => void;
  isFundSelected: (fundCode: string) => boolean;
}

const indexSymbolOptions = [
  { label: '全部', value: '全部' },
  { label: '沪深指数', value: '沪深指数' },
  { label: '行业主题', value: '行业主题' },
  { label: '大盘指数', value: '大盘指数' },
  { label: '中盘指数', value: '中盘指数' },
  { label: '小盘指数', value: '小盘指数' },
  { label: '股票指数', value: '股票指数' },
  { label: '债券指数', value: '债券指数' },
];

const indexIndicatorOptions = [
  { label: '全部', value: '全部' },
  { label: '被动指数型', value: '被动指数型' },
  { label: '增强指数型', value: '增强指数型' },
];

const IndexFundPanel: React.FC<IndexFundPanelProps> = ({
  selectedFunds,
  onAddToSelected,
  onRemoveFromSelected,
  isFundSelected,
}) => {
  const [symbol, setSymbol] = useState<string>('全部');
  const [indicator, setIndicator] = useState<string>('全部');
  const [data, setData] = useState<IndexFundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [activeSubTab, setActiveSubTab] = useState<string>('list');

  // 筛选相关状态
  const [excludedNames, setExcludedNames] = useState<string[]>(["C"]);
  const [includedNames, setIncludedNames] = useState<string[]>([]);
  const [calculateRecommendation, setCalculateRecommendation] = useState<boolean>(false);

  // 区间百分比过滤条件
  const [near1YearRange, setNear1YearRange] = useState<[number, number]>([-100, 100]);
  const [near2YearRange, setNear2YearRange] = useState<[number, number]>([-100, 100]);
  const [near3YearRange, setNear3YearRange] = useState<[number, number]>([-100, 100]);
  const [yearToDateRange, setYearToDateRange] = useState<[number, number]>([-100, 100]);
  const [sinceInceptionRange, setSinceInceptionRange] = useState<[number, number]>([-100, 3000]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_info_index_em', {
        params: { symbol, indicator },
      });
      console.log('指数型基金 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, indicator]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算推荐买点
  const fetchFundDetailAndCalculate = async (fundCode: string): Promise<string | null> => {
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

      // 月度数据处理
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

      // 季度数据处理
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

      // 计算RSI6
      const monthlyRSI6Data = calculateRSI({ data: monthlyData, closeKey, period: 6 });
      const quarterlyRSI6Data = calculateRSI({ data: quarterlyData, closeKey, period: 6 });

      // 构建季度RSI映射
      const quarterlyRSIMap = new Map<string, number>();
      quarterlyRSI6Data.forEach(item => {
        const date = item[dateKey];
        const year = moment(date).year();
        const quarter = moment(date).quarter();
        const quarterKey = `${year}-Q${quarter}`;
        quarterlyRSIMap.set(quarterKey, item['__RSI6__']);
      });

      // 计算推荐级别并过滤推荐买点
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
          __monthlyRSI6__,
          __quarterlyRSI6__,
          __recommendationLevel__: calculateFundRecommendationLevel({
            __monthlyRSI6__, __quarterlyRSI6__,
          }),
        };
      }).filter(item => [5, 3, 1].includes(item.__recommendationLevel__));

      // 返回推荐买点日期字符串
      return RSI6Data?.map(item => moment(item['日期'])?.format('YYYY-MM-DD'))?.join(',');
    } catch (error) {
      console.log('Error fetching fund detail:', error);
      return null;
    }
  };

  // 应用筛选条件
  const applyFilters = async (rawData: IndexFundData[]): Promise<IndexFundData[]> => {
    let filteredData = [...rawData];

    // 过滤掉关键字段为 null 或 undefined 的数据
    filteredData = filteredData.filter(item => {
      return item['近1年'] !== null && item['近1年'] !== undefined &&
        item['近2年'] !== null && item['近2年'] !== undefined &&
        item['近3年'] !== null && item['近3年'] !== undefined &&
        item['今年来'] !== null && item['今年来'] !== undefined &&
        item['成立来'] !== null && item['成立来'] !== undefined;
    });

    // 根据区间条件过滤
    filteredData = filteredData.filter(item => {
      const near1Year = item['近1年'] as number;
      const near2Year = item['近2年'] as number;
      const near3Year = item['近3年'] as number;
      const yearToDate = item['今年来'] as number;
      const sinceInception = item['成立来'] as number;

      return near1Year >= near1YearRange[0] && near1Year <= near1YearRange[1] &&
        near2Year >= near2YearRange[0] && near2Year <= near2YearRange[1] &&
        near3Year >= near3YearRange[0] && near3Year <= near3YearRange[1] &&
        yearToDate >= yearToDateRange[0] && yearToDate <= yearToDateRange[1] &&
        sinceInception >= sinceInceptionRange[0] && sinceInception <= sinceInceptionRange[1];
    });

    // 不包含基金简称过滤
    if (excludedNames.length > 0) {
      filteredData = filteredData.filter(item => {
        const fundName = String(item['基金名称'] || '').toLowerCase();
        return !excludedNames.some(excludedName =>
          fundName.includes(excludedName.toLowerCase())
        );
      });
    }

    // 包含基金简称过滤
    if (includedNames.length > 0) {
      filteredData = filteredData.filter(item => {
        const fundName = String(item['基金名称'] || '').toLowerCase();
        return includedNames.some(includedName =>
          fundName.includes(includedName.toLowerCase())
        );
      });
    }

    // 计算推荐买点
    if (calculateRecommendation) {
      const results: IndexFundData[] = [];
      for (const item of filteredData) {
        message.info(`正在分析【${item['基金名称']}】中...`);
        const recommendationDates = await fetchFundDetailAndCalculate(String(item['基金代码']));
        results.push({
          ...item,
          ['__推荐买点__']: recommendationDates || '',
        });
      }
      return results;
    }

    return filteredData;
  };

  // 基金代码搜索下拉
  const codeFilterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
    <div style={{ padding: 8 }}>
      <Input
        placeholder="输入基金代码"
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={confirm}
        style={{ width: 188, marginBottom: 8, display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
        <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
      </div>
    </div>
  );

  // 基金名称搜索下拉
  const nameFilterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
    <div style={{ padding: 8 }}>
      <Input
        placeholder="输入基金名称"
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={confirm}
        style={{ width: 188, marginBottom: 8, display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
        <Button onClick={() => { clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
      </div>
    </div>
  );

  const columns = [
    {
      title: '基金代码', dataIndex: '基金代码', width: 100, fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金代码'),
      filterDropdown: codeFilterDropdown,
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: IndexFundData) =>
        String(record['基金代码'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '基金名称', dataIndex: '基金名称', width: 260, fixed: 'left' as const,
      sorter: stringSorter<IndexFundData>('基金名称'),
      render: (name: string, record: IndexFundData) => (
        <Link
          onClick={() => window.open(`/fund/cn/open/detail?symbol=${record['基金代码']}`, '_blank')}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
      filterDropdown: nameFilterDropdown,
      filterIcon: (filtered: boolean) => <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>,
      onFilter: (value: string | number | boolean, record: IndexFundData) =>
        String(record['基金名称'] || '').toLowerCase().includes(String(value).toLowerCase()),
    },
    {
      title: '单位净值', dataIndex: '单位净值', width: 100,
      sorter: numberSorter<IndexFundData>('单位净值'),
      ...createRangeFilter('单位净值'),
    } as any,
    {
      title: '日期', dataIndex: '日期', width: 120,
      sorter: stringSorter<IndexFundData>('日期'),
    },
    {
      title: '日增长率', dataIndex: '日增长率', width: 100,
      sorter: numberSorter<IndexFundData>('日增长率'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('日增长率'),
    } as any,
    {
      title: '近1周', dataIndex: '近1周', width: 80,
      sorter: numberSorter<IndexFundData>('近1周'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1周'),
    } as any,
    {
      title: '近1月', dataIndex: '近1月', width: 80,
      sorter: numberSorter<IndexFundData>('近1月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1月'),
    } as any,
    {
      title: '近3月', dataIndex: '近3月', width: 80,
      sorter: numberSorter<IndexFundData>('近3月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3月'),
    } as any,
    {
      title: '近6月', dataIndex: '近6月', width: 80,
      sorter: numberSorter<IndexFundData>('近6月'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近6月'),
    } as any,
    {
      title: '近1年', dataIndex: '近1年', width: 80,
      sorter: numberSorter<IndexFundData>('近1年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近1年'),
    } as any,
    {
      title: '近2年', dataIndex: '近2年', width: 80,
      sorter: numberSorter<IndexFundData>('近2年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近2年'),
    } as any,
    {
      title: '近3年', dataIndex: '近3年', width: 80,
      sorter: numberSorter<IndexFundData>('近3年'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('近3年'),  
    } as any,
    {
      title: '今年来', dataIndex: '今年来', width: 90,
      sorter: numberSorter<IndexFundData>('今年来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('今年来'),
    } as any,
    {
      title: '成立来', dataIndex: '成立来', width: 90,
      sorter: numberSorter<IndexFundData>('成立来'),
      render: (value: number) => `${value?.toFixed(2)}%`,
      ...createRangeFilter('成立来'),
    } as any,
    {
      title: '手续费', dataIndex: '手续费', width: 80,
      sorter: numberSorter<IndexFundData>('手续费'),
      ...createRangeFilter('手续费'),
    } as any,
    {
      title: '起购金额', dataIndex: '起购金额', width: 100,
      sorter: stringSorter<IndexFundData>('起购金额'),
    },
    {
      title: '跟踪标的', dataIndex: '跟踪标的', width: 200,
      sorter: stringSorter<IndexFundData>('跟踪标的'),
    },
    {
      title: '跟踪方式', dataIndex: '跟踪方式', width: 100,
      sorter: stringSorter<IndexFundData>('跟踪方式'),
    },
    {
      title: '推荐买点', dataIndex: '__推荐买点__', key: '__推荐买点__', width: 400,
      sorter: stringSorter<IndexFundData>('__推荐买点__'),
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
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: unknown, record: IndexFundData) => {
        const isSelected = isFundSelected(String(record['基金代码']));
        return (
          <Button
            type={isSelected ? 'default' : 'primary'} size="small"
            onClick={() => isSelected ? onRemoveFromSelected(record) : onAddToSelected(record)}
          >
            {isSelected ? '取消自选' : '添加到自选'}
          </Button>
        );
      },
    },
  ];

  // 列表内容（搜索条件 + 表格）—— 列表 Tab 和筛选 Tab 共用
  const renderListContent = (showFilters: boolean = false) => (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            style={{ width: 140 }}
            value={symbol}
            onChange={setSymbol}
            options={indexSymbolOptions}
          />
          <Select
            style={{ width: 140 }}
            value={indicator}
            onChange={setIndicator}
            options={indexIndicatorOptions}
          />
          {showFilters && (
            <>
              <Select
                mode="tags"
                style={{ width: 250 }}
                placeholder="包含基金简称"
                value={includedNames}
                onChange={setIncludedNames}
              />
              <Select
                mode="tags"
                style={{ width: 250 }}
                placeholder="不包含基金简称"
                value={excludedNames}
                onChange={setExcludedNames}
              />
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
                    fontWeight: 'bold', color: '#fff', fontSize: '14px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
                    {calculateRecommendation ? '✨ 已启用智能分析' : '💡 计算推荐买点'}
                  </span>
                  <span style={{
                    color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginTop: '2px'
                  }}>
                    {calculateRecommendation ? '搜索后将分析最佳买入时机...' : '启用后将计算RSI指标'}
                  </span>
                </div>
              </div>
            </>
          )}
          <Button type="primary" onClick={async () => {
            setLoading(true);
            try {
              const response = await apiClient.get('/api/public/fund_info_index_em', {
                params: { symbol, indicator },
              });
              const rawData = response?.data || [];
              if (showFilters) {
                const filteredData = await applyFilters(rawData);
                setData(filteredData);
              } else {
                setData(rawData);
              }
            } catch (error) {
              console.log('error', error);
            } finally {
              setLoading(false);
            }
          }} loading={loading}>
            搜索
          </Button>
        </div>
      </Card>

      {/* 区间过滤滑块 - 仅在筛选Tab显示 */}
      {showFilters && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '60px' }}>近1年：</span>
              <Slider range min={-100} max={500} value={near1YearRange}
                onChange={(value) => setNear1YearRange(value as [number, number])}
                style={{ flex: 1, minWidth: '300px' }} tooltip={{ formatter: (value) => `${value}%` }} />
              <span style={{ width: '120px', textAlign: 'right' }}>{near1YearRange[0]}% ~ {near1YearRange[1]}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '60px' }}>近2年：</span>
              <Slider range min={-100} max={500} value={near2YearRange}
                onChange={(value) => setNear2YearRange(value as [number, number])}
                style={{ flex: 1, minWidth: '300px' }} tooltip={{ formatter: (value) => `${value}%` }} />
              <span style={{ width: '120px', textAlign: 'right' }}>{near2YearRange[0]}% ~ {near2YearRange[1]}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '60px' }}>近3年：</span>
              <Slider range min={-100} max={500} value={near3YearRange}
                onChange={(value) => setNear3YearRange(value as [number, number])}
                style={{ flex: 1, minWidth: '300px' }} tooltip={{ formatter: (value) => `${value}%` }} />
              <span style={{ width: '120px', textAlign: 'right' }}>{near3YearRange[0]}% ~ {near3YearRange[1]}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '60px' }}>今年来：</span>
              <Slider range min={-100} max={500} value={yearToDateRange}
                onChange={(value) => setYearToDateRange(value as [number, number])}
                style={{ flex: 1, minWidth: '300px' }} tooltip={{ formatter: (value) => `${value}%` }} />
              <span style={{ width: '120px', textAlign: 'right' }}>{yearToDateRange[0]}% ~ {yearToDateRange[1]}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '60px' }}>成立来：</span>
              <Slider range min={-100} max={10000} value={sinceInceptionRange}
                onChange={(value) => setSinceInceptionRange(value as [number, number])}
                style={{ flex: 1, minWidth: '300px' }} tooltip={{ formatter: (value) => `${value}%` }} />
              <span style={{ width: '120px', textAlign: 'right' }}>{sinceInceptionRange[0]}% ~ {sinceInceptionRange[1]}%</span>
            </div>
          </div>
        </Card>
      )}

      <Spin spinning={loading}>
        <Card>
          <Table
            rowKey="基金代码"
            columns={columns}
            dataSource={data}
            scroll={{ x: 3000 }}
            pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total: number) => `共 ${total} 条`,
                onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
              }}
          />
        </Card>
      </Spin>
    </>
  );

  return (
    <Tabs activeKey={activeSubTab} onChange={setActiveSubTab}>
      <TabPane tab="列表" key="list">
        {renderListContent(false)}
      </TabPane>
      <TabPane tab="筛选" key="filtered">
        {renderListContent(true)}
      </TabPane>
    </Tabs>
  );
};

export default IndexFundPanel;
