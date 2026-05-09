import { Card, Typography, Space, Divider } from 'antd';
import { FundOutlined, BankOutlined, StockOutlined, ShoppingOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const Home = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 800, 
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
          }}>
            <BankOutlined style={{ fontSize: '48px', color: '#fff' }} />
          </div>
          
          <Title level={1} style={{ 
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            金融数据分析平台
          </Title>
          
          <Paragraph style={{ 
            fontSize: '16px', 
            color: '#666', 
            lineHeight: '1.8',
            marginBottom: '32px',
          }}>
            提供专业的基金数据查询与分析服务，助力您的投资研究
          </Paragraph>

          <Divider style={{ margin: '32px 0' }} />

          <Space wrap style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '32px',
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              padding: '20px',
              borderRadius: '12px',
              background: '#f8f9fa',
              minWidth: '120px',
            }}>
              <BankOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: '8px' }} />
              <Text style={{ fontSize: '14px', color: '#666' }}>宏观分析</Text>
            </div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              padding: '20px',
              borderRadius: '12px',
              background: '#f8f9fa',
              minWidth: '120px',
            }}>
              <FundOutlined style={{ fontSize: '32px', color: '#667eea', marginBottom: '8px' }} />
              <Text style={{ fontSize: '14px', color: '#666' }}>基金数据</Text>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              padding: '20px',
              borderRadius: '12px',
              background: '#f8f9fa',
              minWidth: '120px',
            }}>
              <StockOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: '8px' }} />
              <Text style={{ fontSize: '14px', color: '#666' }}>收益分析</Text>
            </div>
            

            {/* todo: 风险评估功能 */}
            {/* <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              padding: '20px',
              borderRadius: '12px',
              background: '#f8f9fa',
              minWidth: '120px',
            }}>
              <ShoppingOutlined style={{ fontSize: '32px', color: '#faad14', marginBottom: '8px' }} />
              <Text style={{ fontSize: '14px', color: '#666' }}>风险评估</Text>
            </div> */}
          </Space>

          <Card 
            style={{ 
              borderLeft: '4px solid #faad14',
              background: '#fffbe6',
              borderRadius: '8px',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <InfoCircleOutlined style={{ fontSize: '20px', color: '#faad14', flexShrink: 0 }} />
              <Paragraph style={{ margin: 0, fontSize: '14px', color: '#d48806' }}>
                数据仅用于学术和研究，不用于任何商业用途，不构成任何投资建议，投资有风险，投资需谨慎
              </Paragraph>
            </div>
          </Card>
        </div>
      </Card>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
          © 2026 金融数据分析平台
        </Text>
      </div>
    </div>
  );
};

export default Home;
