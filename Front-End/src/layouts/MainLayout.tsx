import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Modal } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { menuItems, menuPathMap } from '@/config/menuConfig';
import type { MenuProps } from 'antd';

const { Header, Content, Sider } = Layout;

/** localStorage 中记录“投资风险提示”最近展示日期的键名 */
const RISK_NOTICE_DATE_KEY = 'risk_disclaimer_shown_date';

/** 本地日期字符串 YYYY-MM-DD（按本地时区） */
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** 投资风险温馨提示：每天最多弹出一次（按本地日期去重） */
const RiskDisclaimerModal: React.FC = () => {
  // 惰性初始化：今天尚未展示过则默认打开
  const [open, setOpen] = useState<boolean>(
    () => localStorage.getItem(RISK_NOTICE_DATE_KEY) !== getTodayStr(),
  );

  const handleClose = () => {
    localStorage.setItem(RISK_NOTICE_DATE_KEY, getTodayStr());
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          <ExclamationCircleFilled style={{ color: '#faad14', marginRight: 8 }} />
          温馨提示
        </span>
      }
      closable={false}
      maskClosable={false}
      keyboard={false}
      okText="我已知晓，继续使用"
      onOk={handleClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      centered
    >
      <div style={{ fontSize: 14, lineHeight: 1.9, color: '#333' }}>
        <p style={{ margin: '8px 0' }}>
          ⚠️ 本平台仅用于数据展示与学习研究，所有数据与策略信号
          <strong style={{ color: '#cf1322' }}>不构成任何投资建议</strong>，据此操作风险自担。
        </p>
        <p style={{ margin: '8px 0', color: '#888', fontSize: 12 }}>
          市场有风险，投资需谨慎。
        </p>
      </div>
    </Modal>
  );
};

const MainLayout: React.FC = () => {
  // 初始状态：默认折叠
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 监听屏幕尺寸变化
  useEffect(() => {
    // const handleResize = () => {
    //   setCollapsed(window.innerWidth < 768);
    // };

    // window.addEventListener('resize', handleResize);
    // return () => window.removeEventListener('resize', handleResize);
  }, []);

  const findSelectedKey = (path: string): string => {
    const findKey = (items: MenuProps['items']): string | null => {
      if (!items) {
        return null;
      }
      for (const item of items) {
        if (!item) {
          continue;
        }
        const key = String(item.key);
        if (menuPathMap[key] === path) {
          return key;
        }
        if ('children' in item && item.children) {
          const found = findKey(item.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return findKey(menuItems) || 'home';
  };

  const selectedKeys = [findSelectedKey(location.pathname)];

  const findMenuPath = (key: string, items: MenuProps['items'], parentPath: string[] = []): string[] | null => {
    if (!items) {
      return null;
    }
    for (const item of items) {
      if (!item) {
        continue;
      }
      const itemKey = String(item.key);
      if (itemKey === key) {
        return [...parentPath, (item as { label: string }).label];
      }
      if ('children' in item && item.children) {
        const found = findMenuPath(key, item.children, [...parentPath, (item as { label: string }).label]);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const currentMenuPath = (() => {
    const key = selectedKeys[0];
    const path = findMenuPath(key, menuItems);
    return path ? path.join(' > ') : '首页';
  })();

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const path = menuPathMap[e.key];
    if (path) {
      navigate(path);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <RiskDisclaimerModal />
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px' }}>
            <h1 style={{ margin: 0, lineHeight: '48px', fontSize: '36px' }}>
              数据分析平台
            </h1>
            <div style={{ lineHeight: '32px', fontSize: '14px', color: '#666' }}>
              {currentMenuPath}
            </div>
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 64px - 32px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
