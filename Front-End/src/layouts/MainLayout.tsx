import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { menuItems, menuPathMap } from '@/config/menuConfig';
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
              金融数据分析平台
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
