import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Spin, Tag, Radio, Typography } from 'antd';
import { SwapOutlined, HistoryOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';

const { Link } = Typography;

interface FundPortfolioChangeProps {
  symbol: string | null;
}

interface PortfolioChangeItem {
  [key: string]: string | number;
}

const FundPortfolioChange: React.FC<FundPortfolioChangeProps> = ({ symbol }) => {
  const [data, setData] = useState<PortfolioChangeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [indicator, setIndicator] = useState<string>('累计买入');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
 const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // 生成年份选项（最近5年）
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => ({
    label: String(currentYear - i),
    value: String(currentYear - i),
  }));

  // 获取重大变动数据
  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/api/public/fund_portfolio_change_em', {
        params: { symbol, indicator, date: year },
      });
      console.log('重大变动 -> response', response);
      setData(response?.data || []);
    } catch (error) {
      console.error('获取重大变动失败:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, indicator, year]);

  // 动态生成列（根据返回数据的第一条记录）
  const columns = data.length > 0
    ? Object.keys(data[0]).filter(key => key !== '序号').map(key => {
        // 列名添加单位后缀
        let title = key;
        if (key === '本期累计买入金额' || key.includes('金额')) {
          title = `${key}（万）`;
        } else if (key === '占期初基金资产净值比例' || key.includes('比例')) {
          title = `${key}（%）`;
        }

        return {
          title,
          dataIndex: key,
          key,
          width: key === '序号' ? 60 : key === '股票代码' ? 100 : key === '股票名称' ? 180 : 140,
          render: (value: string | number, record: PortfolioChangeItem) => {
            if (key === '变动方向') {
              const color = String(value).includes('买入') ? '#f5222d' : '#52c41a';
              return <Tag color={color}>{value}</Tag>;
            }
            // 股票代码/名称：点击跳转个股详情
            if (key === '股票代码' || key === '股票名称') {
              const stockCode = record['股票代码'];
              const stockName = record['股票名称'];
              return (
                <Link
                  onClick={() => window.open(`/stock/a/stock/detail?symbol=${stockCode}&name=${encodeURIComponent(String(stockName || ''))}`, '_blank')}
                  style={{ cursor: 'pointer', color: '#1890ff' }}
                >
                  {value}
                </Link>
              );
            }
            if (typeof value === 'number') {
              return value.toFixed(2);
            }
            return value;
          },
        };
      })
    : [];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SwapOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>重大变动</span>
        </div>
      }
      style={{ borderRadius: '12px' }}
    >
      {/* 筛选条件 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HistoryOutlined style={{ color: '#1890ff' }} />
          <span>年份：</span>
          <Select
            value={year}
            onChange={setYear}
            options={yearOptions}
            style={{ width: 100 }}
          />
        </div>
        <Radio.Group value={indicator} onChange={(e) => setIndicator(e.target.value)} buttonStyle="solid">
          <Radio.Button value="累计买入">累计买入</Radio.Button>
          <Radio.Button value="累计卖出">累计卖出</Radio.Button>
        </Radio.Group>
      </div>

      {/* 数据表格 */}
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <Table
            dataSource={data}
            rowKey={(_, index) => String(index)}
            columns={columns}
            size="small"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: data.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
            }}
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无{year}年{indicator}数据
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default FundPortfolioChange;
