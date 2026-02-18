import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { menuItems, menuPathMap } from '../config/menuConfig';
import type { MenuProps } from 'antd';

const { Header, Content, Sider } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const findSelectedKey = (path: string): string => {
    const findKey = (items: MenuProps['items']): string | null => {
      if (!items) return null;
      for (const item of items) {
        if (!item) continue;
        const key = String(item.key);
        if (menuPathMap[key] === path) {
          return key;
        }
        if ('children' in item && item.children) {
          const found = findKey(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findKey(menuItems) || 'home';
  };

  const selectedKeys = [findSelectedKey(location.pathname)];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const path = menuPathMap[e.key];
    if (path) {
      navigate(path);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h1 style={{ padding: '0 24px', margin: 0, lineHeight: '64px' }}>
            金融数据分析平台
          </h1>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
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
