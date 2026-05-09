import { HomeOutlined, BankOutlined, StockOutlined, ShoppingOutlined, ApartmentOutlined, FundOutlined, ThunderboltOutlined, ExperimentOutlined, CodeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { lazy } from 'react';


export interface MenuItemConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  component?: React.LazyExoticComponent<React.ComponentType> | React.ComponentType;
  children?: MenuItemConfig[];
}

export const menuConfigs: MenuItemConfig[] = [
  {
    key: 'home',
    label: '首页',
    icon: <HomeOutlined />,
    path: 'home',
    component: lazy(() => import('@/pages/Home')),
  },
  {
    key: 'stock',
    label: '股票',
    icon: <StockOutlined />,
    children: [
      {
        key: 'stock/a',
        label: 'A股',
        children: [
          {
            key: 'stock/a/macro',
            label: '宏观',
            path: 'stock/a/macro',
            component: lazy(() => import('@/pages/stock/a/macro')),
          },
          {
            key: 'stock/a/market-temp',
            label: '市场温度',
            path: 'stock/a/market-temp',
            component: lazy(() => import('@/pages/stock/a/market-temp')),
          },
          {
            key: 'stock/a/valuation',
            label: '估值',
            path: 'stock/a/valuation',
            component: lazy(() => import('@/pages/stock/a/valuation')),
          },
          {
            key: 'stock/a/option-volatility',
            label: '期权波动',
            path: 'stock/a/option-volatility',
            component: lazy(() => import('@/pages/stock/a/option-volatility')),
          },
        ],
      },
    ],
  },
  {
    key: 'fund',
    label: '基金',
    icon: <FundOutlined />,
    children: [
      {
        key: 'fund/cn',
        label: '国内',
        path: 'fund/cn',
        children: [
            {
            key: 'fund/cn/market-temp',
            label: '市场温度',
            path: 'fund/cn/market-temp',
            component: lazy(() => import('@/pages/fund/cn/market-temp')),
          },
          {
            key: 'fund/cn/open',
            label: '开放式基金',
            path: 'fund/cn/open',
            component: lazy(() => import('@/pages/fund/cn/open')),
            children: [
              {
                key: 'fund/cn/open/detail',
                label: '基金详情',
                path: 'fund/cn/open/detail',
                component: lazy(() => import('@/pages/fund/cn/open/detail')),
              }
            ]
          },
          {
            key: 'fund/cn/manager',
            label: '基金经理',
            path: 'fund/cn/manager',
            component: lazy(() => import('@/pages/fund/cn/manager')),
          },
        
        ],
      },
    ],
  },
];

export const routeConfigs = (() => {
  const configs: Array<{ path: string; component: React.LazyExoticComponent<React.ComponentType> | React.ComponentType }> = [];

  const collectRoutes = (items: MenuItemConfig[]) => {
    items.forEach(item => {
      if (item.path && item.component) {
        configs.push({
          path: item.path,
          component: item.component,
        });
      }
      if (item.children) {
        collectRoutes(item.children);
      }
    });
  };

  collectRoutes(menuConfigs);
  return configs;
})();

export const menuItems: MenuProps['items'] = menuConfigs.map(item => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
  children: item.children ? item.children.map(child => ({
    key: child.key,
    label: child.label,
    children: child.children ? child.children.map(subChild => ({
      key: subChild.key,
      label: subChild.label,
    })) : undefined,
  })) : undefined,
}));

export const menuPathMap: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const collectPaths = (items: MenuItemConfig[]) => {
    items.forEach(item => {
      if (item.path !== undefined) {
        map[item.key] = `/${item.path}`;
      }
      if (item.children !== undefined) {
        collectPaths(item.children);
      }
    });
  };
  collectPaths(menuConfigs);
  return map;
})();
