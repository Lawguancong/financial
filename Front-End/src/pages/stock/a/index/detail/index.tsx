import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import axios from 'axios';
import moment from 'moment';

interface IndexDetailData {
  日期: string;
  指数代码: string;
  指数中文全称: string;
  指数中文简称: string;
  指数英文全称: string;
  指数英文简称: string;
  开盘: number;
  最高: number;
  最低: number;
  收盘: number;
  涨跌: number;
  涨跌幅: number;
  成交量: number;
  成交金额: number;
  样本数量: number;
  滚动市盈率: number;
}

const IndexDetail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const publishDate = searchParams.get('publishDate');
  const [data, setData] = useState<IndexDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexName, setIndexName] = useState('');

  const fetchData = useCallback(async () => {
    if (!code) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8080/api/public/stock_zh_index_hist_csindex?symbol=${code}&start_date=${publishDate}`);
      console.log('指数详情 -> response', response);
      setData(response?.data || []);
      setIndexName(code);
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  }, [code, publishDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>
        指数详情 - {indexName}
      </h1>
      
      {data.length > 0 ? (
        <div>
          <div style={{ marginBottom: '16px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <p><strong>最新数据：</strong></p>
            <p>日期：{moment(data[0].日期).format('YYYY-MM-DD')}</p>
            <p>指数代码：{data[0].指数代码}</p>
            <p>指数中文全称：{data[0].指数中文全称}</p>
            <p>指数中文简称：{data[0].指数中文简称}</p>
            <p>指数英文全称：{data[0].指数英文全称}</p>
            <p>指数英文简称：{data[0].指数英文简称}</p>
            <p>开盘：{data[0].开盘}</p>
            <p>最高：{data[0].最高}</p>
            <p>最低：{data[0].最低}</p>
            <p>收盘：{data[0].收盘}</p>
            <p>涨跌：{data[0].涨跌}</p>
            <p>涨跌幅：{data[0].涨跌幅}%</p>
            <p>成交量：{data[0].成交量} 万手</p>
            <p>成交金额：{data[0].成交金额} 亿元</p>
            <p>样本数量：{data[0].样本数量}</p>
            <p>滚动市盈率：{data[0].滚动市盈率}</p>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h2>历史数据</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>日期</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>指数代码</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>指数中文全称</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>指数中文简称</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>指数英文全称</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'left' }}>指数英文简称</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>开盘</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>最高</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>最低</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>收盘</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>涨跌</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>涨跌幅(%)</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>成交量(万手)</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>成交金额(亿元)</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>样本数量</th>
                  <th style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>滚动市盈率</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index} style={{ background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {moment(item.日期).format('YYYY-MM-DD')}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {item.指数代码}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {item.指数中文全称}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {item.指数中文简称}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {item.指数英文全称}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8' }}>
                      {item.指数英文简称}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.开盘}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.最高}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.最低}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.收盘}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      border: '1px solid #e8e8e8', 
                      textAlign: 'right',
                      color: item.涨跌 >= 0 ? '#f5222d' : '#52c41a'
                    }}>
                      {item.涨跌}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      border: '1px solid #e8e8e8', 
                      textAlign: 'right',
                      color: item.涨跌幅 >= 0 ? '#f5222d' : '#52c41a'
                    }}>
                      {item.涨跌幅}%
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.成交量}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.成交金额}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.样本数量}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e8e8e8', textAlign: 'right' }}>
                      {item.滚动市盈率}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
          暂无数据
        </div>
      )}
    </div>
  );
};

export default IndexDetail;
