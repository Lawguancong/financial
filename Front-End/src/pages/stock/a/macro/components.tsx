import { useEffect } from 'react';
import { Line } from '@ant-design/charts';
import { useSetState } from 'ahooks';
import apiClient from '@/utils/axios';

// 通用图表配置生成器
const createChartConfig = (title: string, subtitle: string, data: any[], color: string, unit: string = '') => ({
  title: { title, subtitle },
  data: data || [],
  xField: 'date',
  yField: 'value',
  shapeField: 'smooth',
  colorField: color,
  smooth: true,
  tooltip: {
    items: [
      { field: 'date', name: '日期' },
      { field: 'value', name: title, valueFormatter: (v: any) => {
        if (v === null || v === undefined || isNaN(Number(v))) return '-';
        return unit ? `${Number(v).toFixed(2)}${unit}` : Number(v).toFixed(2);
      }},
    ],
  },
});

// 通用数据获取Hook
const useMacroData = (apiEndpoint: string, key: number, dataProcessor: (data: any[]) => any, defaultData: any = {}) => {
  const [data, setData] = useSetState<any>(defaultData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get(`/api/public/${apiEndpoint}`);
        const rawData = response?.data;
        // 确保数据是数组
        const safeData = Array.isArray(rawData) ? rawData : [];
        const processed = dataProcessor(safeData);
        setData(processed);
      } catch (error) {
        console.log('error', error);
        // 出错时保持默认空数据结构
        setData(defaultData);
      }
    };
    fetchData();
  }, [key]);

  return data;
};

// 财政收入 - 数据顺序：历史→最近（需要reverse）
export const Macro_china_czsr = ({ key }: { key: number }) => {
  const defaultData = { current: [], yoy: [], mom: [], cumulative: [], cumulativeYoy: [] };
  const data = useMacroData('macro_china_czsr', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.current.push({ date, value: item['当月'] });
      result.yoy.push({ date, value: item['当月-同比增长'] });
      result.mom.push({ date, value: item['当月-环比增长'] });
      result.cumulative.push({ date, value: item['累计'] });
      result.cumulativeYoy.push({ date, value: item['累计-同比增长'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <Line {...createChartConfig('当月', '财政收入当月', data.current, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('当月同比增长', '财政收入当月同比增长', data.yoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('当月环比增长', '财政收入当月环比增长', data.mom, '#F6BD16', '%')} />
      <Line {...createChartConfig('累计', '财政收入累计', data.cumulative, '#E8684A', ' 亿元')} />
      <Line {...createChartConfig('累计同比增长', '财政收入累计同比增长', data.cumulativeYoy, '#9A60B4', '%')} />
    </div>
  );
};

// 消费者信心指数 - 数据顺序：历史→最近（需要reverse）
export const Macro_china_xfzxx = ({ key }: { key: number }) => {
  const defaultData = {
    confidenceIndex: [], confidenceYoy: [], confidenceMom: [],
    satisfactionIndex: [], satisfactionYoy: [], satisfactionMom: [],
    expectationIndex: [], expectationYoy: [], expectationMom: [],
  };
  const data = useMacroData('macro_china_xfzxx', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.confidenceIndex.push({ date, value: item['消费者信心指数-指数值'] });
      result.confidenceYoy.push({ date, value: item['消费者信心指数-同比增长'] });
      result.confidenceMom.push({ date, value: item['消费者信心指数-环比增长'] });
      result.satisfactionIndex.push({ date, value: item['消费者满意指数-指数值'] });
      result.satisfactionYoy.push({ date, value: item['消费者满意指数-同比增长'] });
      result.satisfactionMom.push({ date, value: item['消费者满意指数-环比增长'] });
      result.expectationIndex.push({ date, value: item['消费者预期指数-指数值'] });
      result.expectationYoy.push({ date, value: item['消费者预期指数-同比增长'] });
      result.expectationMom.push({ date, value: item['消费者预期指数-环比增长'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>消费者信心指数</h3>
      <Line {...createChartConfig('指数值', '消费者信心指数-指数值', data.confidenceIndex, '#5B8FF9')} />
      <Line {...createChartConfig('同比增长', '消费者信心指数-同比增长', data.confidenceYoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('环比增长', '消费者信心指数-环比增长', data.confidenceMom, '#F6BD16', '%')} />
      <h3>消费者满意指数</h3>
      <Line {...createChartConfig('指数值', '消费者满意指数-指数值', data.satisfactionIndex, '#E8684A')} />
      <Line {...createChartConfig('同比增长', '消费者满意指数-同比增长', data.satisfactionYoy, '#9A60B4', '%')} />
      <Line {...createChartConfig('环比增长', '消费者满意指数-环比增长', data.satisfactionMom, '#6F5DE4', '%')} />
      <h3>消费者预期指数</h3>
      <Line {...createChartConfig('指数值', '消费者预期指数-指数值', data.expectationIndex, '#FF99C3')} />
      <Line {...createChartConfig('同比增长', '消费者预期指数-同比增长', data.expectationYoy, '#5D7092', '%')} />
      <Line {...createChartConfig('环比增长', '消费者预期指数-环比增长', data.expectationMom, '#FF9D4D', '%')} />
    </div>
  );
};

// 存款准备金率 - 数据顺序：最近→历史（不需要reverse）
export const Macro_china_reserve_requirement_ratio = ({ key }: { key: number }) => {
  const defaultData = {
    largeBefore: [], largeAfter: [], largeChange: [],
    smallBefore: [], smallAfter: [], smallChange: [],
  };
  const data = useMacroData('macro_china_reserve_requirement_ratio', key, (rawData) => {
    const result = { ...defaultData };
    rawData.forEach((item: any) => {
      const date = item['生效时间'];
      result.largeBefore.push({ date, value: item['大型金融机构-调整前'] });
      result.largeAfter.push({ date, value: item['大型金融机构-调整后'] });
      result.largeChange.push({ date, value: item['大型金融机构-调整幅度'] });
      result.smallBefore.push({ date, value: item['中小金融机构-调整前'] });
      result.smallAfter.push({ date, value: item['中小金融机构-调整后'] });
      result.smallChange.push({ date, value: item['中小金融机构-调整幅度'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>大型金融机构</h3>
      <Line {...createChartConfig('调整前', '大型金融机构存款准备金率调整前', data.largeBefore, '#5B8FF9', '%')} />
      <Line {...createChartConfig('调整后', '大型金融机构存款准备金率调整后', data.largeAfter, '#5AD8A6', '%')} />
      <Line {...createChartConfig('调整幅度', '大型金融机构存款准备金率调整幅度', data.largeChange, '#F6BD16', '%')} />
      <h3>中小金融机构</h3>
      <Line {...createChartConfig('调整前', '中小金融机构存款准备金率调整前', data.smallBefore, '#E8684A', '%')} />
      <Line {...createChartConfig('调整后', '中小金融机构存款准备金率调整后', data.smallAfter, '#9A60B4', '%')} />
      <Line {...createChartConfig('调整幅度', '中小金融机构存款准备金率调整幅度', data.smallChange, '#6F5DE4', '%')} />
    </div>
  );
};

// 社会消费品零售总额 - 数据顺序：最近→历史（不需要reverse）
export const Macro_china_consumer_goods_retail = ({ key }: { key: number }) => {
  const defaultData = { current: [], yoy: [], mom: [], cumulative: [], cumulativeYoy: [] };
  const data = useMacroData('macro_china_consumer_goods_retail', key, (rawData) => {
    const result = { ...defaultData };
    rawData.forEach((item: any) => {
      const date = item['月份'];
      result.current.push({ date, value: item['当月'] });
      result.yoy.push({ date, value: item['同比增长'] });
      result.mom.push({ date, value: item['环比增长'] });
      result.cumulative.push({ date, value: item['累计'] });
      result.cumulativeYoy.push({ date, value: item['累计-同比增长'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <Line {...createChartConfig('当月', '社会消费品零售总额当月', data.current, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('同比增长', '社会消费品零售总额同比增长', data.yoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('环比增长', '社会消费品零售总额环比增长', data.mom, '#F6BD16', '%')} />
      <Line {...createChartConfig('累计', '社会消费品零售总额累计', data.cumulative, '#E8684A', ' 亿元')} />
      <Line {...createChartConfig('累计同比增长', '社会消费品零售总额累计同比增长', data.cumulativeYoy, '#9A60B4', '%')} />
    </div>
  );
};

// 货币供应量 - 数据顺序：最近→历史（不需要reverse）
export const Macro_china_supply_of_money = ({ key }: { key: number }) => {
  const defaultData = {
    m2: [], m2Yoy: [], m1: [], m1Yoy: [], m0: [], m0Yoy: [],
  };
  const data = useMacroData('macro_china_supply_of_money', key, (rawData) => {
    const result = { ...defaultData };
    rawData.forEach((item: any) => {
      const date = item['统计时间'];
      result.m2.push({ date, value: item['货币和准货币（广义货币M2）'] });
      result.m2Yoy.push({ date, value: item['货币和准货币（广义货币M2）同比增长'] });
      result.m1.push({ date, value: item['货币(狭义货币M1)'] });
      result.m1Yoy.push({ date, value: item['货币(狭义货币M1)同比增长'] });
      result.m0.push({ date, value: item['流通中现金(M0)'] });
      result.m0Yoy.push({ date, value: item['流通中现金(M0)同比增长'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>M2 广义货币</h3>
      <Line {...createChartConfig('数量', 'M2数量', data.m2, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M2同比增长', data.m2Yoy, '#5AD8A6', '%')} />
      <h3>M1 狭义货币</h3>
      <Line {...createChartConfig('数量', 'M1数量', data.m1, '#F6BD16', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M1同比增长', data.m1Yoy, '#E8684A', '%')} />
      <h3>M0 流通中现金</h3>
      <Line {...createChartConfig('数量', 'M0数量', data.m0, '#9A60B4', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M0同比增长', data.m0Yoy, '#6F5DE4', '%')} />
    </div>
  );
};

// 央行黄金和外汇储备 - 数据顺序：最近→历史（不需要reverse）
export const Macro_china_foreign_exchange_gold = ({ key }: { key: number }) => {
  const defaultData = { gold: [], forex: [] };
  const data = useMacroData('macro_china_foreign_exchange_gold', key, (rawData) => {
    const result = { ...defaultData };
    rawData.forEach((item: any) => {
      const date = item['统计时间'];
      result.gold.push({ date, value: item['黄金储备'] });
      result.forex.push({ date, value: item['国家外汇储备'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <Line {...createChartConfig('黄金储备', '央行黄金储备', data.gold, '#5B8FF9', ' 万盎司')} />
      <Line {...createChartConfig('外汇储备', '国家外汇储备', data.forex, '#5AD8A6', ' 亿美元')} />
    </div>
  );
};

// 外汇和黄金储备 - 数据顺序：历史→最近（需要reverse）
export const Macro_china_fx_gold = ({ key }: { key: number }) => {
  const defaultData = {
    goldValue: [], goldYoy: [], goldMom: [],
    forexValue: [], forexYoy: [], forexMom: [],
  };
  const data = useMacroData('macro_china_fx_gold', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.goldValue.push({ date, value: item['黄金储备-数值'] });
      result.goldYoy.push({ date, value: item['黄金储备-同比'] });
      result.goldMom.push({ date, value: item['黄金储备-环比'] });
      result.forexValue.push({ date, value: item['国家外汇储备-数值'] });
      result.forexYoy.push({ date, value: item['国家外汇储备-同比'] });
      result.forexMom.push({ date, value: item['国家外汇储备-环比'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>黄金储备</h3>
      <Line {...createChartConfig('数值', '黄金储备数值', data.goldValue, '#5B8FF9', ' 万盎司')} />
      <Line {...createChartConfig('同比', '黄金储备同比', data.goldYoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('环比', '黄金储备环比', data.goldMom, '#F6BD16', '%')} />
      <h3>外汇储备</h3>
      <Line {...createChartConfig('数值', '外汇储备数值', data.forexValue, '#E8684A', ' 亿美元')} />
      <Line {...createChartConfig('同比', '外汇储备同比', data.forexYoy, '#9A60B4', '%')} />
      <Line {...createChartConfig('环比', '外汇储备环比', data.forexMom, '#6F5DE4', '%')} />
    </div>
  );
};

// 中国货币供应量 - 数据顺序：历史→最近（需要reverse）
export const Macro_china_money_supply = ({ key }: { key: number }) => {
  const defaultData = {
    m2Value: [], m2Yoy: [], m2Mom: [],
    m1Value: [], m1Yoy: [], m1Mom: [],
    m0Value: [], m0Yoy: [], m0Mom: [],
  };
  const data = useMacroData('macro_china_money_supply', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.m2Value.push({ date, value: item['货币和准货币(M2)-数量(亿元)'] });
      result.m2Yoy.push({ date, value: item['货币和准货币(M2)-同比增长'] });
      result.m2Mom.push({ date, value: item['货币和准货币(M2)-环比增长'] });
      result.m1Value.push({ date, value: item['货币(M1)-数量(亿元)'] });
      result.m1Yoy.push({ date, value: item['货币(M1)-同比增长'] });
      result.m1Mom.push({ date, value: item['货币(M1)-环比增长'] });
      result.m0Value.push({ date, value: item['流通中的现金(M0)-数量(亿元)'] });
      result.m0Yoy.push({ date, value: item['流通中的现金(M0)-同比增长'] });
      result.m0Mom.push({ date, value: item['流通中的现金(M0)-环比增长'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>M2 货币和准货币</h3>
      <Line {...createChartConfig('数量', 'M2数量', data.m2Value, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M2同比增长', data.m2Yoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('环比增长', 'M2环比增长', data.m2Mom, '#F6BD16', '%')} />
      <h3>M1 货币</h3>
      <Line {...createChartConfig('数量', 'M1数量', data.m1Value, '#E8684A', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M1同比增长', data.m1Yoy, '#9A60B4', '%')} />
      <Line {...createChartConfig('环比增长', 'M1环比增长', data.m1Mom, '#6F5DE4', '%')} />
      <h3>M0 流通中现金</h3>
      <Line {...createChartConfig('数量', 'M0数量', data.m0Value, '#FF99C3', ' 亿元')} />
      <Line {...createChartConfig('同比增长', 'M0同比增长', data.m0Yoy, '#5D7092', '%')} />
      <Line {...createChartConfig('环比增长', 'M0环比增长', data.m0Mom, '#FF9D4D', '%')} />
    </div>
  );
};

// 全国股票交易统计表 - 数据顺序：历史→最近（需要reverse）
export const Macro_china_stock_market_cap = ({ key }: { key: number }) => {
  const defaultData = {
    shTotalShares: [], szTotalShares: [],
    shMarketCap: [], szMarketCap: [],
    shTurnover: [], szTurnover: [],
    shTurnoverRatio: [], szTurnoverRatio: [],
  };
  const data = useMacroData('macro_china_stock_market_cap', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['数据日期'];
      result.shTotalShares.push({ date, value: item['发行总股本-上海'] });
      result.szTotalShares.push({ date, value: item['发行总股本-深圳'] });
      result.shMarketCap.push({ date, value: item['市价总值-上海'] });
      result.szMarketCap.push({ date, value: item['市价总值-深圳'] });
      result.shTurnover.push({ date, value: item['成交金额-上海'] });
      result.szTurnover.push({ date, value: item['成交金额-深圳'] });
      // 计算成交金额/市价总值（换手率）
      const shRatio = item['成交金额-上海'] && item['市价总值-上海'] ? (item['成交金额-上海'] / item['市价总值-上海']) * 100 : 0;
      const szRatio = item['成交金额-深圳'] && item['市价总值-深圳'] ? (item['成交金额-深圳'] / item['市价总值-深圳']) * 100 : 0;
      result.shTurnoverRatio.push({ date, value: shRatio });
      result.szTurnoverRatio.push({ date, value: szRatio });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>发行总股本</h3>
      <Line {...createChartConfig('上海', '发行总股本-上海', data.shTotalShares, '#5B8FF9', ' 亿股')} />
      <Line {...createChartConfig('深圳', '发行总股本-深圳', data.szTotalShares, '#5AD8A6', ' 亿股')} />
      <h3>市价总值</h3>
      <Line {...createChartConfig('上海', '市价总值-上海', data.shMarketCap, '#F6BD16', ' 亿元')} />
      <Line {...createChartConfig('深圳', '市价总值-深圳', data.szMarketCap, '#E8684A', ' 亿元')} />
      <h3>成交金额</h3>
      <Line {...createChartConfig('上海', '成交金额-上海', data.shTurnover, '#9A60B4', ' 亿元')} />
      <Line {...createChartConfig('深圳', '成交金额-深圳', data.szTurnover, '#6F5DE4', ' 亿元')} />
      <h3>成交金额/市价总值（换手率）</h3>
      <Line {...createChartConfig('上海', '上海换手率', data.shTurnoverRatio, '#FF99C3', '%')} />
      <Line {...createChartConfig('深圳', '深圳换手率', data.szTurnoverRatio, '#5D7092', '%')} />
    </div>
  );
};

// 新增人民币贷款 - 数据顺序：历史→最近（需要reverse）
export const Macro_rmb_loan = ({ key }: { key: number }) => {
  const defaultData = { current: [], currentYoy: [], currentMom: [], cumulative: [], cumulativeYoy: [] };
  const data = useMacroData('macro_rmb_loan', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.current.push({ date, value: item['新增人民币贷款-总额'] });
      result.currentYoy.push({ date, value: item['新增人民币贷款-同比'] });
      result.currentMom.push({ date, value: item['新增人民币贷款-环比'] });
      result.cumulative.push({ date, value: item['累计人民币贷款-总额'] });
      result.cumulativeYoy.push({ date, value: item['累计人民币贷款-同比'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <Line {...createChartConfig('新增总额', '新增人民币贷款总额', data.current, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('新增同比', '新增人民币贷款同比', data.currentYoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('新增环比', '新增人民币贷款环比', data.currentMom, '#F6BD16', '%')} />
      <Line {...createChartConfig('累计总额', '累计人民币贷款总额', data.cumulative, '#E8684A', ' 亿元')} />
      <Line {...createChartConfig('累计同比', '累计人民币贷款同比', data.cumulativeYoy, '#9A60B4', '%')} />
    </div>
  );
};

// 人民币存款余额 - 数据顺序：历史→最近（需要reverse）
export const Macro_rmb_deposit = ({ key }: { key: number }) => {
  const defaultData = {
    total: [], totalYoy: [], totalMom: [],
    enterprise: [], enterpriseYoy: [], enterpriseMom: [],
    savings: [], savingsYoy: [], savingsMom: [],
  };
  const data = useMacroData('macro_rmb_deposit', key, (rawData) => {
    const result = { ...defaultData };
    rawData.reverse().forEach((item: any) => {
      const date = item['月份'];
      result.total.push({ date, value: item['新增存款-数量'] });
      result.totalYoy.push({ date, value: item['新增存款-同比'] });
      result.totalMom.push({ date, value: item['新增存款-环比'] });
      result.enterprise.push({ date, value: item['新增企业存款-数量'] });
      result.enterpriseYoy.push({ date, value: item['新增企业存款-同比'] });
      result.enterpriseMom.push({ date, value: item['新增企业存款-环比'] });
      result.savings.push({ date, value: item['新增储蓄存款-数量'] });
      result.savingsYoy.push({ date, value: item['新增储蓄存款-同比'] });
      result.savingsMom.push({ date, value: item['新增储蓄存款-环比'] });
    });
    return result;
  }, defaultData);

  return (
    <div>
      <h3>新增存款</h3>
      <Line {...createChartConfig('数量', '新增存款数量', data.total, '#5B8FF9', ' 亿元')} />
      <Line {...createChartConfig('同比', '新增存款同比', data.totalYoy, '#5AD8A6', '%')} />
      <Line {...createChartConfig('环比', '新增存款环比', data.totalMom, '#F6BD16', '%')} />
      <h3>新增企业存款</h3>
      <Line {...createChartConfig('数量', '新增企业存款数量', data.enterprise, '#E8684A', ' 亿元')} />
      <Line {...createChartConfig('同比', '新增企业存款同比', data.enterpriseYoy, '#9A60B4', '%')} />
      <Line {...createChartConfig('环比', '新增企业存款环比', data.enterpriseMom, '#6F5DE4', '%')} />
      <h3>新增储蓄存款</h3>
      <Line {...createChartConfig('数量', '新增储蓄存款数量', data.savings, '#FF99C3', ' 亿元')} />
      <Line {...createChartConfig('同比', '新增储蓄存款同比', data.savingsYoy, '#5D7092', '%')} />
      <Line {...createChartConfig('环比', '新增储蓄存款环比', data.savingsMom, '#FF9D4D', '%')} />
    </div>
  );
};
