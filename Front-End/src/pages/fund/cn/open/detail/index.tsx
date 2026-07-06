import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Card, Tag, Row, Col, Spin } from 'antd';
import { BankOutlined, FundOutlined, InfoCircleOutlined, DollarOutlined, TeamOutlined, SafetyOutlined, BarChartOutlined } from '@ant-design/icons';
import UnitNav from './UnitNav';
import CumulativeNav from './CumulativeNav';
import CumulativeReturn from './CumulativeReturn';
import FundHoldings from './FundHoldings';
import FundDividend from './FundDividend';
import FundIndustryAllocation from './FundIndustryAllocation';
import FundAssetAllocation from './FundAssetAllocation';
import FundAnalysis from './FundAnalysis';
import FundProfitProbability from './FundProfitProbability';
import FundOverview from './FundOverview';
import FundAchievement from './FundAchievement';
import FundPortfolioChange from './FundPortfolioChange';
import apiClient from '@/utils/axios';

const { TabPane } = Tabs;

const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '-';
  const [symbolInfo, setSymbolInfo] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('累计收益率走势');
  const [loading, setLoading] = useState(true);

  const getFundInfo = async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      const response = await apiClient.get('/api/public/fund_individual_basic_info_xq', {
        params: { symbol },
      });
      console.log('基金基本信息', response);
      // response.data是API返回的整个对象，response.data.data才是数组
      const dataArray = response?.data;
      if (Array.isArray(dataArray)) {
        const obj = dataArray.reduce((acc: Record<string, string>, cur: { item: string; value: string }) => {
          acc[cur.item] = cur.value;
          return acc;
        }, {});
        console.log('基金基本信息 Object', obj);
        setSymbolInfo(obj || {});
      } else {
        console.error('API返回的数据格式不正确:', response);
        setSymbolInfo({});
      }
    } catch (error) {
      console.error('获取基金信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getFundInfo();
  }, [symbol]);

  // 定义基金核心信息项
  const coreInfoItems = useMemo(() => [
    { key: '基金代码', label: '基金代码', icon: <InfoCircleOutlined />, color: '#1890ff' },
    { key: '基金全称', label: '基金全称', icon: <InfoCircleOutlined />, color: '#1890ff' },
    { key: '基金公司', label: '基金公司', icon: <FundOutlined />, color: '#722ed1' },
    { key: '基金经理', label: '基金经理', icon: <TeamOutlined />, color: '#13c2c2' },
    { key: '成立时间', label: '成立时间', icon: <InfoCircleOutlined />, color: '#52c41a' },
    { key: '最新规模', label: '最新规模', icon: <DollarOutlined />, color: '#fa8c16' },
  ], []);

  // 定义基金风险信息项
  const riskInfoItems = useMemo(() => [
    { key: '基金类型', label: '基金类型', icon: <BarChartOutlined />, color: '#f5222d' },
    { key: '基金评级', label: '基金评级', icon: <SafetyOutlined />, color: '#faad14' },
    { key: '评级机构', label: '评级机构', icon: <InfoCircleOutlined />, color: '#1890ff' },
    { key: '托管银行', label: '托管银行', icon: <BankOutlined />, color: '#2f54eb' },
  ], []);

  // 定义业绩比较基准和投资目标等描述信息
  const descriptionItems = useMemo(() => [
    { key: '业绩比较基准', label: '业绩比较基准', icon: <BarChartOutlined /> },
    { key: '投资目标', label: '投资目标', icon: <InfoCircleOutlined /> },
    { key: '投资策略', label: '投资策略', icon: <InfoCircleOutlined /> },
  ], []);

  // 获取基金类型对应的颜色
  const getFundTypeColor = (type: string) => {
    if (type?.includes('股票')) return 'red';
    if (type?.includes('债券')) return 'blue';
    if (type?.includes('混合')) return 'orange';
    if (type?.includes('货币')) return 'green';
    if (type?.includes('指数')) return 'purple';
    return 'default';
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f5f5f5' }}>
      <Spin spinning={loading}>
        {/* 基金标题卡片 */}
        <Card 
          style={{ 
            marginBottom: '16px', 
            borderRadius: '12px', 
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
          hoverable
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'white' }}>
                  {symbolInfo?.['基金名称'] || symbol}
                </h2>
                <Tag 
                  color={getFundTypeColor(symbolInfo?.['基金类型'] || '')} 
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {symbolInfo?.['基金类型']}
                </Tag>
              </div>
            </div>
          </div>
        </Card>

        {/* 基本概况卡片 */}
        {useMemo(() => <FundOverview symbol={symbol} />, [symbol])}

        {/* 基金核心信息卡片 */}
        {/* <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <InfoCircleOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>核心信息</span>
            </div>
          }
          style={{ marginBottom: '16px', borderRadius: '12px' }}
        >
          <Row gutter={[16, 16]}>
            {coreInfoItems.map(item => {
              const value = symbolInfo[item.key];
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    borderLeft: `3px solid ${item.color}`,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f5ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fafafa';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      background: `${item.color}15`,
                      borderRadius: '8px',
                      flexShrink: 0
                    }}>
                      {React.cloneElement(item.icon, { style: { fontSize: '20px', color: item.color } })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{item.label}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                        {item.key === '基金经理' && value ? (
                          <a href={`/fund/cn/manager?name=${encodeURIComponent(value)}`} style={{ color: item.color }}>
                            {value}
                          </a>
                        ) : (
                          value || '-'
                        )}
                      </p>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card> */}

        {/* 基金风险信息卡片 */}
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SafetyOutlined style={{ fontSize: '18px', color: '#faad14' }} />
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>风险信息</span>
            </div>
          }
          style={{ marginBottom: '16px', borderRadius: '12px' }}
        >
          <Row gutter={[16, 16]}>
            {riskInfoItems.map(item => {
              const value = symbolInfo[item.key];
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    borderLeft: `3px solid ${item.color}`
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      background: `${item.color}15`,
                      borderRadius: '8px',
                      flexShrink: 0
                    }}>
                      {React.cloneElement(item.icon, { style: { fontSize: '20px', color: item.color } })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{item.label}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                        {value || '-'}
                      </p>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>

        {/* 基金描述信息卡片 */}
        {descriptionItems.some(item => symbolInfo[item.key]) && (
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChartOutlined style={{ fontSize: '18px', color: '#faad14' }} />
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>投资信息</span>
              </div>
            }
            style={{ marginBottom: '16px', borderRadius: '12px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {descriptionItems.map(item => {
                const value = symbolInfo[item.key];
                if (!value) return null;
                return (
                  <div key={item.key} style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      background: '#fffbe6',
                      borderRadius: '8px',
                      flexShrink: 0
                    }}>
                      {React.cloneElement(item.icon, { style: { fontSize: '20px', color: '#faad14' } })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#888', marginBottom: '8px' }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                        {value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 走势图Tabs */}
        <Card 
          style={{ borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '16px' }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="large"
            style={{ marginBottom: '16px' }}
            type="card"
          >
            <TabPane tab="📈 累计收益率走势" key="累计收益率走势">
              {useMemo(() => <CumulativeReturn symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="💹 单位净值走势" key="单位净值走势">
              {useMemo(() => <UnitNav symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="📊 累计净值走势" key="累计净值走势">
              {useMemo(() => <CumulativeNav symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="📋 基金持仓" key="基金持仓">
              {useMemo(() => <FundHoldings symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="💰 分红信息" key="分红信息">
              暂无合适的接口-todo
              {/* {useMemo(() => <FundDividend symbol={symbol} />, [symbol])} */}
            </TabPane>
            <TabPane tab="🏭 行业配置" key="行业配置">
              {useMemo(() => <FundIndustryAllocation symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="💼 资产配置" key="资产配置">
              {useMemo(() => <FundAssetAllocation symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="📊 基金分析" key="基金分析">
              {useMemo(() => <FundAnalysis symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="🎯 盈利概率" key="盈利概率">
              {useMemo(() => <FundProfitProbability symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="🏆 基金业绩" key="基金业绩">
              {useMemo(() => <FundAchievement symbol={symbol} />, [symbol])}
            </TabPane>
            <TabPane tab="🔄 重大变动" key="重大变动">
              {useMemo(() => <FundPortfolioChange symbol={symbol} />, [symbol])}
            </TabPane>
          </Tabs>
        </Card>
      </Spin>
    </div>
  );
};

export default FundOpenDetail;