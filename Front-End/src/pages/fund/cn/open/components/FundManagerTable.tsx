import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spin, Empty, Tag, Select, Typography, Input, Button } from 'antd';
import { TrophyOutlined, UserOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { createRangeFilter, numberSorter } from '@/utils/tableUtils';

const { Link: AntLink } = Typography;

// 基金经理数据项
export interface ManagerItem {
  [key: string]: string | number;
}

interface FundManagerTableProps {
  /** 显示模式：'list' 全部经理列表 | 'funds' 指定经理的在管基金 */
  mode?: 'list' | 'funds';
  /** mode='list': 不需要; mode='funds': 基金代码（用于获取经理）或经理名称 */
  symbol?: string | null;
  /** mode='funds': 经理名称（直接指定时使用） */
  managerName?: string;
  /** 是否显示标题卡片 */
  showTitle?: boolean;
  /** 标题文字 */
  titleText?: string;
  /** 自定义表格列配置 */
  customColumns?: {
    title: string;
    dataIndex: string;
    width?: number;
    render?: (value: string | number, record: ManagerItem) => React.ReactNode;
  }[];
  /** 点击基金行的回调 */
  onFundClick?: (record: ManagerItem) => void;
  /** 数据加载完成回调 */
  onDataLoaded?: (data: ManagerItem[]) => void;
}

const FundManagerTable: React.FC<FundManagerTableProps> = ({
  mode = 'list',
  symbol,
  managerName,
  showTitle = true,
  titleText,
  customColumns,
  onFundClick,
  onDataLoaded,
}) => {
  const [data, setData] = useState<ManagerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<{ label: string; value: string }[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>('');

  // 搜索筛选状态
  const [nameFilterValue, setNameFilterValue] = useState<string | undefined>(undefined);
  const [companyFilterValue, setCompanyFilterValue] = useState<string | undefined>(undefined);
  const [fundCodeFilterValue, setFundCodeFilterValue] = useState<string | undefined>(undefined);
  const [fundNameFilterValue, setFundNameFilterValue] = useState<string | undefined>(undefined);

  // 支持从 URL 参数初始化姓名筛选
  useEffect(() => {
    if (mode === 'list') {
      const params = new URLSearchParams(window.location.search);
      const urlName = params.get('name');
      if (urlName) {
        setNameFilterValue(urlName);
      }
    }
  }, [mode]);

  // 获取数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      let rawData;

      if (mode === 'list') {
        // 全部基金经理列表
        response = await apiClient.get('/api/public/fund_manager_em');
        console.log('FundManagerTable -> 经理列表', response);
        rawData = response?.data;

        if (Array.isArray(rawData)) {
          // 处理数据：计算从业年限、年化回报等衍生字段
          const processedData = rawData.map((item: Record<string, unknown>, idx: number) => {
            const workYear = Number(item['累计从业时间'] || 0) / 365;
            const bestReturn = Number(item['现任基金最佳回报'] || 0);
            const bestAnnualized = workYear >= 1
              ? (Math.pow(1 + bestReturn / 100, 1 / workYear) - 1) * 100
              : 0;

            return {
              ...item,
              id: idx,
              ['从业年限(年)']: workYear.toFixed(1),
              ['现任基金最佳年化(%)']: bestAnnualized.toFixed(1),
            };
          });

          // 提取经理列表用于筛选
          const managerList = Array.from(
            new Set(processedData.map((item: Record<string, unknown>) => String(item['姓名'] || '')))
          )
            .filter(name => name && name !== '-')
            .map(name => ({ label: name, value: name }));

          setManagers(managerList);
          setData(processedData as ManagerItem[]);
        }
      } else if (mode === 'funds') {
        // 指定经理的在管基金
        const querySymbol = managerName || symbol || '';
        if (!querySymbol) {
          setData([]);
          return;
        }

        // 先尝试用经理名称获取
        response = await apiClient.get('/api/public/fund_manager_fund_em', {
          params: { symbol: querySymbol },
        });
        console.log('FundManagerTable -> 在管基金', response);
        rawData = response?.data;

        if (Array.isArray(rawData) && rawData.length > 0) {
          setData(rawData as ManagerItem[]);
        } else {
          // Fallback: 如果返回为空，尝试用基金代码获取
          if (symbol && !managerName) {
            try {
              const fallbackResponse = await apiClient.get('/api/public/fund_manager_fund_em', {
                params: { symbol },
              });
              console.log('FundManagerTable -> fallback', fallbackResponse);
              const fallbackData = fallbackResponse?.data;
              if (Array.isArray(fallbackData)) {
                setData(fallbackData as ManagerItem[]);
              } else {
                setData([]);
              }
            } catch {
              setData([]);
            }
          } else {
            setData([]);
          }
        }

        // 设置当前选中的经理
        if (querySymbol && !selectedManager) {
          setSelectedManager(querySymbol);
        }
      }

      onDataLoaded?.(data); // eslint-disable-line react-hooks/exhaustive-deps
    } catch (error) {
      console.error('FundManagerTable -> 获取数据失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [mode, symbol, managerName, selectedManager, onDataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 默认列配置
  const getDefaultColumns = () => {
    if (mode === 'list') {
      return [
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 60,
          fixed: 'left' as const,
        },
        {
          title: '姓名',
          dataIndex: '姓名',
          key: '姓名',
          width: 80,
          fixed: 'left' as const,
          filteredValue: nameFilterValue ? [nameFilterValue] : null,
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
            <div style={{ padding: 8 }}>
              <Input
                placeholder="输入姓名"
                value={selectedKeys[0] as string || nameFilterValue || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedKeys(value ? [value] : []);
                  setNameFilterValue(value);
                }}
                onPressEnter={confirm}
                style={{ width: 188, marginBottom: 8, display: 'block' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" onClick={() => { setNameFilterValue(selectedKeys[0] as string); confirm(); }} size="small" style={{ width: 90 }}>搜索</Button>
                <Button onClick={() => { setNameFilterValue(undefined); clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
              </div>
            </div>
          ),
          filterIcon: (filtered: boolean) => <span style={{ color: filtered || !!nameFilterValue ? '#1890ff' : undefined }}>🔍</span>,
          onFilter: (value: string | number | boolean, record: ManagerItem) =>
            String(record['姓名'] || '').toLowerCase().includes(String(value).toLowerCase()),
        },
        {
          title: '所属公司',
          dataIndex: '所属公司',
          key: '所属公司',
          width: 180,
          filteredValue: companyFilterValue ? [companyFilterValue] : null,
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
            <div style={{ padding: 8 }}>
              <Input placeholder="输入所属公司" value={selectedKeys[0] as string || ''} onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])} onPressEnter={confirm} style={{ width: 188, marginBottom: 8, display: 'block' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
                <Button onClick={() => { setCompanyFilterValue(undefined); clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
              </div>
            </div>
          ),
          filterIcon: (filtered: boolean) => <span style={{ color: filtered || !!companyFilterValue ? '#1890ff' : undefined }}>🔍</span>,
          onFilter: (value: string | number | boolean, record: ManagerItem) =>
            String(record['所属公司'] || '').toLowerCase().includes(String(value).toLowerCase()),
        },
        {
          title: '现任基金代码',
          dataIndex: '现任基金代码',
          key: '现任基金代码',
          width: 120,
          filteredValue: fundCodeFilterValue ? [fundCodeFilterValue] : null,
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
            <div style={{ padding: 8 }}>
              <Input placeholder="输入基金代码" value={selectedKeys[0] as string || ''} onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])} onPressEnter={confirm} style={{ width: 188, marginBottom: 8, display: 'block' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
                <Button onClick={() => { setFundCodeFilterValue(undefined); clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
              </div>
            </div>
          ),
          filterIcon: (filtered: boolean) => <span style={{ color: filtered || !!fundCodeFilterValue ? '#1890ff' : undefined }}>🔍</span>,
          onFilter: (value: string | number | boolean, record: ManagerItem) =>
            String(record['现任基金代码'] || '').toLowerCase().includes(String(value).toLowerCase()),
        },
        {
          title: '现任基金',
          dataIndex: '现任基金',
          key: '现任基金',
          width: 220,
          render: (name: string, record: ManagerItem) => (
            <AntLink
              onClick={() => {
                onFundClick?.(record);
                window.open(`/fund/cn/open/detail?symbol=${record['现任基金代码']}`, '_blank');
              }}
              style={{ cursor: 'pointer', color: '#1890ff' }}
            >
              {name}
            </AntLink>
          ),
          filteredValue: fundNameFilterValue ? [fundNameFilterValue] : null,
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
            <div style={{ padding: 8 }}>
              <Input placeholder="输入基金简称" value={selectedKeys[0] as string || ''} onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])} onPressEnter={confirm} style={{ width: 188, marginBottom: 8, display: 'block' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="primary" onClick={confirm} size="small" style={{ width: 90 }}>搜索</Button>
                <Button onClick={() => { setFundNameFilterValue(undefined); clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>重置</Button>
              </div>
            </div>
          ),
          filterIcon: (filtered: boolean) => <span style={{ color: filtered || !!fundNameFilterValue ? '#1890ff' : undefined }}>🔍</span>,
          onFilter: (value: string | number | boolean, record: ManagerItem) =>
            String(record['现任基金'] || '').toLowerCase().includes(String(value).toLowerCase()),
        },
        {
          title: '从业年限(年)',
          dataIndex: '从业年限(年)',
          key: '从业年限(年)',
          width: 110,
          sorter: numberSorter('从业年限(年)'),
          ...createRangeFilter('从业年限(年)'),
        },
        {
          title: '管理基金数量',
          dataIndex: '管理基金数量',
          key: '管理基金数量',
          width: 110,
          sorter: numberSorter('管理基金数量'),
          ...createRangeFilter('管理基金数量'),
        },
        {
          title: '现任基金资产总规模(亿)',
          dataIndex: '现任基金资产总规模',
          key: '现任基金资产总规模',
          width: 160,
          sorter: numberSorter('现任基金资产总规模'),
          render: (value: number) => typeof value === 'number' ? value.toFixed(2) : value,
          ...createRangeFilter('现任基金资产总规模'),
        },
        {
          title: '现任基金最佳回报(%)',
          dataIndex: '现任基金最佳回报',
          key: '现任基金最佳回报',
          width: 160,
          sorter: numberSorter('现任基金最佳回报'),
          render: (value: number) => typeof value === 'number' ? value.toFixed(2) : value,
          ...createRangeFilter('现任基金最佳回报'),
        },
        {
          title: '现任基金最佳年化(%)',
          dataIndex: '现任基金最佳年化(%)',
          key: '现任基金最佳年化(%)',
          width: 160,
          sorter: numberSorter('现任基金最佳年化(%)'),
          render: (value: number | string) => typeof value === 'number' ? value.toFixed(2) : value,
          ...createRangeFilter('现任基金最佳年化(%)'),
        },
      ];
    } else {
      // mode === 'funds'
      return data.length > 0
        ? Object.keys(data[0]).map(key => ({
            title: key,
            dataIndex: key,
            key,
            width: getColWidth(key),
            render: (value: string | number, record: ManagerItem) => {
              // 基金代码/名称：点击跳转
              if (key === '基金代码' || key === '基金简称' || key === '基金名称') {
                const fundCode = String(record['基金代码'] || value);
                return (
                  <AntLink
                    onClick={() => {
                      onFundClick?.(record);
                      window.open(`/fund/cn/open/detail?symbol=${fundCode}`, '_blank');
                    }}
                    style={{ cursor: 'pointer', color: '#1890ff' }}
                  >
                    {value}
                  </AntLink>
                );
              }
              // 数值保留2位小数
              if (typeof value === 'number') {
                return value.toFixed(2);
              }
              return value;
            },
          }))
        : [];
    }
  };

  const columns = (customColumns || getDefaultColumns()) as any;

  // 渲染内容
  const renderContent = () => {
    if (data.length === 0 && !loading) {
      return (
        <Empty
          description={mode === 'funds' ? `暂无${selectedManager || ''}的在管基金数据` : '暂无数据'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <Table
        dataSource={data}
        rowKey={(_, index) => String(index)}
        size="middle"
        loading={loading}
        pagination={{
          pageSize: mode === 'list' ? 20 : 15,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50'],
        }}
        scroll={{ x: 'max-content' }}
        columns={columns}
      />
    );
  };

  // 列宽设置
  const getColWidth = (key: string): number => {
    const widthMap: Record<string, number> = {
      '基金代码': 100,
      '基金简称': 200,
      '基金名称': 220,
      '基金类型': 120,
      '成立日期': 110,
      '资产净值': 120,
      '规模': 100,
      '单位净值': 100,
      '累计净值': 100,
      '日增长率': 100,
      '近1月': 80,
      '近3月': 80,
      '近6月': 80,
      '近1年': 80,
      '今年来': 90,
      '任职天数': 90,
      '任职回报': 100,
    };
    return widthMap[key] || 130;
  };

  // 根据是否显示标题决定渲染方式
  if (showTitle) {
    return (
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrophyOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold' }}>{titleText || (mode === 'list' ? '基金经理' : '在管基金')}</span>
          </div>
        }
        style={{ borderRadius: '12px' }}
      >
        {/* 经理选择器（仅在 mode=funds 且有多个经理时显示） */}
        {mode === 'funds' && managers.length > 1 && (
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 500 }}>选择基金经理：</span>
            <Select
              value={selectedManager}
              onChange={(value) => {
                setSelectedManager(value);
                // 触发重新获取数据
                fetchData();
              }}
              style={{ width: 200 }}
              options={managers}
            />
          </div>
        )}

        {/* 当前经理标签 */}
        {mode === 'funds' && selectedManager && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#e6f7ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <UserOutlined style={{ color: '#1890ff' }} />
            <span>
              <strong>{selectedManager}</strong>
              <Tag color="blue" style={{ marginLeft: '8px' }}>{data.length} 只</Tag>
            </span>
          </div>
        )}

        <Spin spinning={loading}>
          {renderContent()}
        </Spin>
      </Card>
    );
  }

  // 无标题模式（仅渲染表格）
  return <Spin spinning={loading}>{renderContent()}</Spin>;
};

export default FundManagerTable;
