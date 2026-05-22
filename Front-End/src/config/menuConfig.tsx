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
  // {
  //   key: 'bond',
  //   label: '债券',
  //   icon: <BankOutlined />,
  //   path: 'bond',
  //   component: lazy(() => import('@/pages/Bond')),
  // },
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
            key: 'stock/a/index',
            label: '指数',
            path: 'stock/a/index',
            component: lazy(() => import('@/pages/stock/a/index')),
            children: [
              {
                key: 'stock/a/index/detail',
                label: '指数详情',
                path: 'stock/a/index/detail',
                component: lazy(() => import('@/pages/stock/a/index/detail')),
              },
            ],
          },
          // todo 行业
          // 东方财富-行业板块 单次返回当前时刻所有行业板的实时行情数据
          // 接口: stock_board_industry_name_em 
          {
            key: 'stock/a/stock',
            label: '个股',
            path: 'stock/a/stock',
            component: lazy(() => import('@/pages/stock/a/stock')),
            children: [
              {
                key: 'stock/a/stock/detail',
                label: '个股详情',
                path: 'stock/a/stock/detail',
                component: lazy(() => import('@/pages/stock/a/stock/detail')),
              },
            ],
          },
          {
            key: 'stock/a/option-volatility',
            label: '期权波动',
            path: 'stock/a/option-volatility',
            component: lazy(() => import('@/pages/stock/a/option-volatility')),
          },
        ],
      },
      // {
      //   key: 'stock/hk',
      //   label: '港股',
      //   path: 'stock/hk',
      //   component: lazy(() => import('@/pages/StockHK')),
      // },
      // {
      //   key: 'stock/us',
      //   label: '美股',
      //   path: 'stock/us',
      //   component: lazy(() => import('@/pages/StockUS')),
      // },
      // {
      //   key: 'stock/other',
      //   label: '其它',
      //   path: 'stock/other',
      //   component: lazy(() => import('@/pages/StockOther')),
      // },
    ],
  },
  {
    key: 'commodity',
    label: '大宗商品',
    icon: <ShoppingOutlined />,
    children: [
      {
        key: 'commodity/cn',
        label: '国内',
        children: [
          {
            key: 'commodity/cn/index',
            label: '指数',
            path: 'commodity/cn/index',
            component: lazy(() => import('@/pages/commodity/cn/index')),
            children: [
              {
                key: 'commodity/cn/index/detail',
                label: '指数详情',
                path: 'commodity/cn/index/detail',
                component: lazy(() => import('@/pages/commodity/cn/index/detail')),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'realestate',
    label: '房地产',
    icon: <ApartmentOutlined />,
    children: [
      {
        key: 'realestate/cn',
        label: '国内',
        path: 'realestate/cn',
        children: [
          {
            key: 'realestate/cn/macro',
            label: '宏观',
            path: 'realestate/cn/macro',
            component: lazy(() => import('@/pages/realestate/cn/macro')),
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
  // {
  //   key: 'futures',
  //   label: '期货',
  //   icon: <ThunderboltOutlined />,
  //   path: 'futures',
  //   component: lazy(() => import('@/pages/Futures')),
  // },
  // {
  //   key: 'options',
  //   label: '期权',
  //   icon: <ExperimentOutlined />,
  //   path: 'options',
  //   component: lazy(() => import('@/pages/Options')),
  // },
  // {
  //   key: 'other/level1',
  //   label: '其它/一级',
  //   children: [
  //     {
  //       key: 'other/level2',
  //       label: '其它/二级',
  //       children: [
  //         {
  //           key: 'other/level3',
  //           label: '其它/三级',
  //           path: 'other/level3',
  //           component: lazy(() => import('@/pages/OtherLevel3')),
  //         },
  //       ],
  //     },
  //   ],
  // },
  {
    key: 'api/test',
    label: 'AKShare API 测试',
    icon: <CodeOutlined />,
    path: 'api/test',
    component: lazy(() => import('@/pages/AkshareTest')),
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
