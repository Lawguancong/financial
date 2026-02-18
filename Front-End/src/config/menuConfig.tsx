import { HomeOutlined, AppstoreOutlined, LineChartOutlined, BankOutlined, StockOutlined, ShoppingOutlined, ApartmentOutlined, FundOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons';
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
    key: 'macro',
    label: '宏观',
    icon: <LineChartOutlined />,
    path: 'macro',
    component: lazy(() => import('@/pages/Macro')),
  },
  {
    key: 'bond',
    label: '债券',
    icon: <BankOutlined />,
    path: 'bond',
    component: lazy(() => import('@/pages/Bond')),
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
        ],
      },
      {
        key: 'stock/hk',
        label: '港股',
        path: 'stock/hk',
        component: lazy(() => import('@/pages/StockHK')),
      },
      {
        key: 'stock/us',
        label: '美股',
        path: 'stock/us',
        component: lazy(() => import('@/pages/StockUS')),
      },
      {
        key: 'stock/other',
        label: '其它',
        path: 'stock/other',
        component: lazy(() => import('@/pages/StockOther')),
      },
    ],
  },
  {
    key: 'commodity',
    label: '大宗商品',
    icon: <ShoppingOutlined />,
    path: 'commodity',
    component: lazy(() => import('@/pages/Commodity')),
  },
  {
    key: 'realestate',
    label: '房地产',
    icon: <ApartmentOutlined />,
    path: 'realestate',
    component: lazy(() => import('@/pages/RealEstate')),
  },
  {
    key: 'fund',
    label: '基金',
    icon: <FundOutlined />,
    path: 'fund',
    component: lazy(() => import('@/pages/Fund')),
  },
  {
    key: 'futures',
    label: '期货',
    icon: <ThunderboltOutlined />,
    path: 'futures',
    component: lazy(() => import('@/pages/Futures')),
  },
  {
    key: 'options',
    label: '期权',
    icon: <ExperimentOutlined />,
    path: 'options',
    component: lazy(() => import('@/pages/Options')),
  },
  {
    key: 'other/level1',
    label: '其它/一级',
    children: [
      {
        key: 'other/level2',
        label: '其它/二级',
        children: [
          {
            key: 'other/level3',
            label: '其它/三级',
            path: 'other/level3',
            component: lazy(() => import('@/pages/OtherLevel3')),
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
