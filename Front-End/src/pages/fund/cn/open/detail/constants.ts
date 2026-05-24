// 时间范围选项
export const timeRangeOptions = [
  { label: '上市以来', value: '上市以来' },
  { label: '最近20年', value: '20年' },
  { label: '最近19年', value: '19年' },
  { label: '最近18年', value: '18年' },
  { label: '最近17年', value: '17年' },
  { label: '最近16年', value: '16年' },
  { label: '最近15年', value: '15年' },
  { label: '最近14年', value: '14年' },
  { label: '最近13年', value: '13年' },
  { label: '最近12年', value: '12年' },
  { label: '最近11年', value: '11年' },
  { label: '最近10年', value: '10年' },
  { label: '最近9年', value: '9年' },
  { label: '最近8年', value: '8年' },
  { label: '最近7年', value: '7年' },
  { label: '最近6年', value: '6年' },
  { label: '最近5年', value: '5年' },
  { label: '最近4年', value: '4年' },
  { label: '最近3年', value: '3年' },
  { label: '最近2年', value: '2年' },
  { label: '最近1年', value: '1年' },
];

// 周期选项
export const periodOptions = [
  { label: '1月', value: '1月' },
  { label: '3月', value: '3月' },
  { label: '6月', value: '6月' },
  { label: '1年', value: '1年' },
  { label: '3年', value: '3年' },
  { label: '5年', value: '5年' },
  { label: '今年来', value: '今年来' },
  { label: '成立来', value: '成立来' },
];

// 指标映射
export const keyMap: Record<string, { 日期: string; 数据: string; sampleRate: number }> = {
  '单位净值走势': {
    "日期": '净值日期',
    "数据": '单位净值',
    sampleRate: 1,
  },
  '累计净值走势': {
    "日期": '净值日期',
    "数据": '累计净值',
    sampleRate: 1,
  },
  '累计收益率走势': {
    "日期": '日期',
    "数据": '累计收益率',
    sampleRate: 1,
  },
};

// 右侧Y轴键值映射
export const rightKeys = {
  "累计收益率": '累计收益率(%)',
  ['__最大回撤率__']: '最大回撤率(%)',
  ['__年化收益率__']: "年化收益率(%)",
  // ['__monthlyRSI6__']: "RSI6（月）",
  // ['__quarterlyRSI6__']: "RSI6（季）",
};

// 计算RSI6推荐级别
export const calculateRecommendationLevel = ({ __monthlyRSI6__, __quarterlyRSI6__, __monthly10th__, __monthly90th__, __quarterly10th__, __quarterly90th__ }) => {
  switch (true) {
    case __monthlyRSI6__ <= 10 && __quarterlyRSI6__ <= 15:
    case __monthlyRSI6__ <= 13 && __quarterlyRSI6__ <= 13:
    case __monthlyRSI6__ <= 15 && __quarterlyRSI6__ <= 10:
      return 5;
    case __monthlyRSI6__ <= 15 && __quarterlyRSI6__ <= 20:
    case __monthlyRSI6__ <= 18 && __quarterlyRSI6__ <= 18:
    case __monthlyRSI6__ <= 20 && __quarterlyRSI6__ <= 15:
      return 3;
    case __monthlyRSI6__ <= 25 && __quarterlyRSI6__ <= 25:
    case __monthlyRSI6__ <= 30 && __quarterlyRSI6__ <= 30:
      return 1;
    // case __monthlyRSI6__ > 90 && __quarterlyRSI6__ > 85:
    //   return -1;
    // case __monthlyRSI6__ > 95 && __quarterlyRSI6__ > 90:
    //   return -3;
    // case __monthlyRSI6__ > 98 && __quarterlyRSI6__ > 95:
      return -5;
    default:
      return null;
  }
  
};

// 获取推荐级别对应的样式
export const getLevelStyle = (level: number): { color: string; fontSize: number } => {
  if (level === 5) return { color: '#008000', fontSize: 12 };
  if (level === 3) return { color: '#42b242ff', fontSize: 10 };
  if (level === 1) return { color: '#9fe49fff', fontSize: 8 };
  if (level === -1) return { color: '#ff6666', fontSize: 8 };
  if (level === -3) return { color: '#ff3333', fontSize: 10 };
  if (level === -5) return { color: '#ff0000', fontSize: 12 };
  return { color: 'transparent', fontSize: 0 };
};
