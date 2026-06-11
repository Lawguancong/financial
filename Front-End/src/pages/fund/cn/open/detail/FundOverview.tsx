import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spin, Empty, Row, Col, Tag, Divider } from 'antd';
import {
  BankOutlined,
  FundOutlined,
  CalendarOutlined,
  DollarOutlined,
  UserOutlined,
  SafetyOutlined,
  RiseOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import apiClient from '@/utils/axios';

interface FundOverviewProps {
  symbol: string | null;
}

interface OverviewData {
  基金全称: string;
  基金简称: string;
  基金代码: string;
  基金类型: string;
  发行日期: string;
  '成立日期/规模': string;
  净资产规模: string;
  份额规模: string;
  基金管理人: string;
  基金托管人: string;
  基金经理人: string;
  成立来分红: string;
  管理费率: string;
  托管费率: string;
  销售服务费率: string;
  最高认购费率: string;
  业绩比较基准: string;
  跟踪标的: string;
}

const FundOverview: React.FC<FundOverviewProps> = ({ symbol }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_overview_em', {
        params: { symbol },
      });
      const rawData = response?.data;
      if (Array.isArray(rawData) && rawData.length > 0) {
        setData(rawData[0] as OverviewData);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('获取基金概况失败:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFundTypeColor = (type: string) => {
    if (type?.includes('股票')) return 'red';
    if (type?.includes('债券')) return 'blue';
    if (type?.includes('混合')) return 'orange';
    if (type?.includes('货币')) return 'green';
    if (type?.includes('指数')) return 'purple';
    return 'default';
  };

  const renderInfoItem = (
    icon: React.ReactNode,
    label: string,
    value: string | undefined,
    color: string = '#1890ff'
  ) => {
    if (!value || value === '---') return null;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '12px',
          background: '#fafafa',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: `${color}15`,
            borderRadius: '8px',
            flexShrink: 0,
          }}
        >
          {React.cloneElement(icon as React.ReactElement, { style: { fontSize: '18px', color } })}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>{label}</div>
          <div style={{ fontSize: '14px', color: '#333', wordBreak: 'break-all' }}>{value}</div>
        </div>
      </div>
    );
  };

  if (!data) {
    return (
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📋</span>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金基本概况</span>
          </div>
        }
        style={{ borderRadius: '12px' }}
      >
        <Spin spinning={loading}>
          <Empty description="暂无概况数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Spin>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>基金基本概况</span>
          <Tag color={getFundTypeColor(data.基金类型)} style={{ marginLeft: '12px' }}>
            {data.基金类型}
          </Tag>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      <Spin spinning={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 基本信息区 */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FundOutlined />
              <span>基本信息</span>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                {renderInfoItem(<FundOutlined />, '基金全称', data.基金全称, '#722ed1')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<InfoCircleOutlined />, '基金简称', data.基金简称, '#1890ff')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<CalendarOutlined />, '发行日期', data.发行日期, '#52c41a')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<CalendarOutlined />, '成立日期/规模', data['成立日期/规模'], '#fa8c16')}
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 规模信息区 */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarOutlined />
              <span>规模信息</span>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                {renderInfoItem(<DollarOutlined />, '净资产规模', data.净资产规模, '#f5222d')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<FundOutlined />, '份额规模', data.份额规模, '#fa8c16')}
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 机构信息区 */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BankOutlined />
              <span>机构信息</span>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                {renderInfoItem(<UserOutlined />, '基金管理人', data.基金管理人, '#1890ff')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<BankOutlined />, '基金托管人', data.基金托管人, '#722ed1')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<UserOutlined />, '基金经理人', data.基金经理人, '#13c2c2')}
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 费率信息区 */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SafetyOutlined />
              <span>费率信息</span>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}>
                {renderInfoItem(<SafetyOutlined />, '管理费率', data.管理费率, '#f5222d')}
              </Col>
              <Col xs={24} sm={8}>
                {renderInfoItem(<SafetyOutlined />, '托管费率', data.托管费率, '#fa8c16')}
              </Col>
              <Col xs={24} sm={8}>
                {renderInfoItem(<SafetyOutlined />, '销售服务费率', data.销售服务费率, '#52c41a')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<RiseOutlined />, '最高认购费率', data.最高认购费率, '#722ed1')}
              </Col>
              <Col xs={24} sm={12}>
                {renderInfoItem(<RiseOutlined />, '成立来分红', data.成立来分红, '#eb2f96')}
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 业绩与跟踪 */}
          {/* <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <InfoCircleOutlined />
              <span>业绩与跟踪</span>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24}>
                {renderInfoItem(<RiseOutlined />, '业绩比较基准', data.业绩比较基准, '#1890ff')}
              </Col>
              <Col xs={24}>
                {renderInfoItem(<InfoCircleOutlined />, '跟踪标的', data.跟踪标的, '#13c2c2')}
              </Col>
            </Row>
          </div> */}
        </div>
      </Spin>
    </Card>
  );
};

export default FundOverview;
