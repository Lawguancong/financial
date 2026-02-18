import { HomeOutlined, AppstoreOutlined, LineChartOutlined, BankOutlined, StockOutlined, ShoppingOutlined, ApartmentOutlined, FundOutlined, ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

export const menuItems: MenuProps['items'] = [
  {
    key: 'home',
    label: '首页',
    icon: <HomeOutlined />,
  },
  {
    key: 'valuation',
    label: '估值',
    icon: <AppstoreOutlined />,
    children: [
      {
        key: 'valuation-category1',
        label: '估值-分类1',
      },
    ],
  },
  {
    key: 'macro',
    label: '宏观',
    icon: <LineChartOutlined />,
  },
  {
    key: 'bond',
    label: '债券',
    icon: <BankOutlined />,
  },
  {
    key: 'stock',
    label: '股票',
    icon: <StockOutlined />,
    children: [
      {
        key: 'stock-a',
        label: 'A股',
      },
      {
        key: 'stock-hk',
        label: '港股',
      },
      {
        key: 'stock-us',
        label: '美股',
      },
      {
        key: 'stock-other',
        label: '其它',
      },
    ],
  },
  {
    key: 'commodity',
    label: '大宗商品',
    icon: <ShoppingOutlined />,
  },
  {
    key: 'realestate',
    label: '房地产',
    icon: <ApartmentOutlined />,
  },
  {
    key: 'fund',
    label: '基金',
    icon: <FundOutlined />,
  },
  {
    key: 'futures',
    label: '期货',
    icon: <ThunderboltOutlined />,
  },
  {
    key: 'options',
    label: '期权',
    icon: <ExperimentOutlined />,
  },
  {
    key: 'other-level1',
    label: '其它-一级',
    children: [
      {
        key: 'other-level2',
        label: '其它-二级',
        children: [
          {
            key: 'other-level3',
            label: '其它-三级',
          },
        ],
      },
    ],
  },
];

export const menuPathMap: Record<string, string> = {
  home: '/home',
  'valuation-category1': '/valuation/category1',
  macro: '/macro',
  bond: '/bond',
  'stock-a': '/stock/a',
  'stock-hk': '/stock/hk',
  'stock-us': '/stock/us',
  'stock-other': '/stock/other',
  commodity: '/commodity',
  realestate: '/realestate',
  fund: '/fund',
  futures: '/futures',
  options: '/options',
  'other-level3': '/other/level3',
};
