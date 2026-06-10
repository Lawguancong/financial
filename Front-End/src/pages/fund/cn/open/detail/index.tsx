import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Card, Button, Tag, Row, Col } from 'antd';
import { StarOutlined, StarFilled, BankOutlined, FundOutlined, InfoCircleOutlined } from '@ant-design/icons';
import UnitNav from './UnitNav';
import CumulativeNav from './CumulativeNav';
import CumulativeReturn from './CumulativeReturn';
import apiClient from '@/utils/axios';

const { TabPane } = Tabs;

interface FundData {
  基金代码: string;
  基金简称: string;
  [key: string]: string;
}

// 最近x年 全部
const FundOpenDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || '-';
  const [symbolInfo, setSymbolInfo] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('累计收益率走势');

  const getFundInfo = async () => {
    if (!symbol) return;
    try {
      const response = await apiClient.get('/api/public/fund_individual_basic_info_xq', {
        params: { symbol },
      });
      console.log('基金基本信息', response);
      const obj = response?.data?.reduce((acc: Record<string, string>, cur: { item: string; value: string }) => {
        acc[cur.item] = cur.value;
        return acc;
      }, {});
      console.log('基金基本信息 Object', obj);
      setSymbolInfo(obj || {});
    } catch (error) {
      console.error('获取基金信息失败:', error);
    }
  };

  useEffect(() => {
    getFundInfo();
  }, [symbol]);

  // 定义基金信息项配置
  const infoItems = useMemo(() => [
    { key: '基金代码', label: '基金代码', icon: InfoCircleOutlined },
    { key: '基金全称', label: '基金全称', icon: InfoCircleOutlined },
    { key: '基金公司', label: '基金公司', icon: FundOutlined },
    { key: '基金类型', label: '基金类型', icon: InfoCircleOutlined },
    { key: '基金经理', label: '基金经理', icon: InfoCircleOutlined },
    { key: '基金评级', label: '基金评级', icon: InfoCircleOutlined },
    { key: '成立时间', label: '成立时间', icon: InfoCircleOutlined },
    { key: '托管银行', label: '托管银行', icon: BankOutlined },
    { key: '最新规模', label: '最新规模', icon: InfoCircleOutlined },
    { key: '评级机构', label: '评级机构', icon: InfoCircleOutlined },
  ], []);

  // 定义业绩比较基准和投资目标等描述信息
  const descriptionItems = useMemo(() => [
    { key: '业绩比较基准', label: '业绩比较基准', icon: InfoCircleOutlined },
    { key: '投资目标', label: '投资目标', icon: InfoCircleOutlined },
    { key: '投资策略', label: '投资策略', icon: InfoCircleOutlined },
  ], []);

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* 基金标题卡片 */}
      <Card 
        style={{ marginBottom: '16px', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1f1f1f' }}>
                {symbolInfo?.['基金名称'] || symbol}
              </h2>
              <Tag color={symbolInfo?.['基金类型']?.includes('股票') ? 'red' : symbolInfo?.['基金类型']?.includes('债券') ? 'blue' : 'orange'}>
                {symbolInfo?.['基金类型']}
              </Tag>
            </div>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              基金代码：{symbol}
            </p>
          </div>
        </div>
      </Card>

      {/* 基金基本信息卡片 */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <InfoCircleOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基本信息</span>
          </div>
        }
        style={{ marginBottom: '16px', borderRadius: '12px' }}
      >
        <Row gutter={[16, 16]}>
          {infoItems.map(item => {
            const IconComponent = item.icon;
            const value = symbolInfo[item.key];
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px',
                  background: '#fafafa',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  hover: { background: '#f0f5ff' }
                }}>
                  <IconComponent style={{ fontSize: '16px', color: '#1890ff' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{item.label}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                      {item.key === '基金经理' && value ? (
                        <a href={`/fund/cn/manager?name=${encodeURIComponent(value)}`} style={{ color: '#1890ff' }}>
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
      </Card>

      {/* 基金描述信息卡片 */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* <LightbulbOutlined style={{ fontSize: '18px', color: '#faad14' }} /> */}
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>投资信息</span>
          </div>
        }
        style={{ marginBottom: '16px', borderRadius: '12px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {descriptionItems.map(item => {
            const IconComponent = item.icon;
            const value = symbolInfo[item.key];
            return (
              <div key={item.key} style={{ display: 'flex', gap: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  background: '#fffbe6',
                  borderRadius: '8px',
                  flexShrink: 0
                }}>
                  <IconComponent style={{ fontSize: '16px', color: '#faad14' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{item.label}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#333', lineHeight: '1.6' }}>
                    {value || '-'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 走势图Tabs */}
      <Card 
        style={{ borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          style={{ marginBottom: '16px' }}
        >
          <TabPane tab="累计收益率走势" key="累计收益率走势">
            {useMemo(() => <CumulativeReturn symbol={symbol} />, [symbol])}
          </TabPane>
          <TabPane tab="单位净值走势" key="单位净值走势">
            {useMemo(() => <UnitNav symbol={symbol} />, [symbol])}
          </TabPane>
          <TabPane tab="累计净值走势" key="累计净值走势">
            {useMemo(() => <CumulativeNav symbol={symbol} />, [symbol])}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default FundOpenDetail;