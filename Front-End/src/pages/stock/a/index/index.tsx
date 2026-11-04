import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Table, Typography, Input, Button, Tabs, Select, message, Dropdown, Modal, Popconfirm, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined, CheckOutlined, QuestionCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import moment from 'moment';
import { numberSorter, createRangeFilter, createDateRangeFilter } from '@/utils/tableUtils';
import type { IndexDetailData } from './detail';
import { createRecommendationAnnotations, cleanCsindexHistory, isRecentDate, mergeIndexSpotLists, normalizeIndexCode, normalizeSinaIndexDailyRows } from '@/utils/stockUtils';
import type { SinaIndexSpotRow, SinaIndexDailyRow, IndexSpotSource } from '@/utils/stockUtils';
import { appConfig } from '@/config/appConfig';
import { runRecommendationBatchCalculation } from '@/utils/recommendationBatch';
import { computeBuyPoints } from '@/utils/buyPointWorker';
import type { BuyPointKLineItem, BuyPointResult } from '@/utils/buyPointCompute';
import { BuyPointActionGroup } from '@/components/BuyPointActionGroup';
import {
  exportBuyPlan,
  exportBuySellReport,
  exportRecommendationBuyPoints,
} from '@/utils/buySellReportExport';
import type { BuySellReportItem } from '@/utils/buySellReportExport';
import { exportMacdBarMarker } from '@/utils/macdBarMarkerExport';



const { Link } = Typography;
const { TabPane } = Tabs;

/** 固定 tab：全部指数列表、自选（不可删除/重命名） */
const ALL_TAB_KEY = 'all';
const SELECTED_TAB_KEY = 'selected';
const SELECTED_TAB_LABEL = '自选';

/** 自定义分组：key 唯一且不变，label 可编辑 */
interface CustomTab {
  key: string;
  label: string;
}

const CUSTOM_TABS_STORAGE_KEY = 'IndexPage-customTabs';
const CUSTOM_INDICES_STORAGE_KEY = 'IndexPage-customIndices';

interface IndexData {
  指数代码: string;
  指数简称: string;
  指数全称?: string;
  发布时间?: string;
  基日?: string;
  基点?: number;
  指数类别?: string;
  指数系列?: string;
  资产类别?: string;
  指数币种?: string;
  样本数量?: number;
  最新收盘?: number;
  近一个月收益率?: number;
  合作指数?: string;
  跟踪产品?: string;
  指数合规?: string;
  指数热点?: string | null;
  指数年化率?: number;
  /** 数据源标记：新浪行情的详情与买点计算需走 stock_zh_index_daily */
  数据源?: IndexSpotSource;
  涨跌额?: number;
  涨跌幅?: number;
  昨收?: number;
  今开?: number;
  最高?: number;
  最低?: number;
  成交量?: number;
  成交额?: number;
  __推荐买点定量__?: string;
  __推荐买点百分位__?: string;
  __月RSI6百分位__?: string;
  __周RSI6百分位__?: string;
}

const stringSorter = (key: keyof IndexData) => (a: IndexData, b: IndexData) => {
  const aValue = String(a[key] || '');
  const bValue = String(b[key] || '');
  return aValue.localeCompare(bValue, 'zh-CN');
};

/** 近 100 天买点的高亮样式（橙色加粗描边，与其他买点列保持一致） */
const recentBuyTagStyle: React.CSSProperties = {
  backgroundColor: '#fff7e6',
  color: '#d46b08',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 'bold',
  border: '2px solid #fa8c16',
};

/**
 * 构造买点日期标签渲染器：逗号分隔日期 → 标签组（最新日期在前）；
 * 近 100 天的买点用橙色高亮，其余用该列传入的常规配色
 */
const renderBuyPointTags = (normalStyle: React.CSSProperties) => (value: string) => {
  if (!value) return <span style={{ color: '#999' }}>-</span>;
  const dates = value.split(',').map(d => d.trim()).filter(Boolean).reverse();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {dates.map((date, index) => (
        <span
          key={index}
          title={isRecentDate(date) ? '近期买点（100天内）' : undefined}
          style={isRecentDate(date) ? recentBuyTagStyle : normalStyle}
        >
          {date}
        </span>
      ))}
    </div>
  );
};

/**
 * 可选数值渲染：新浪行情字段在中证行缺失时展示「-」，避免出现空单元格
 */
const renderOptionalNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span style={{ color: '#999' }}>-</span>;
  }
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
};

/** 涨跌额渲染：红涨绿跌，缺失展示「-」 */
const renderChangeAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span style={{ color: '#999' }}>-</span>;
  }
  const num = Number(value);
  return (
    <span style={{ color: num >= 0 ? '#cf1322' : '#389e0d', fontWeight: 'bold' }}>
      {num >= 0 ? '+' : ''}{num.toFixed(2)}
    </span>
  );
};

/** 涨跌幅渲染：红涨绿跌并带 %，缺失展示「-」 */
const renderChangePercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span style={{ color: '#999' }}>-</span>;
  }
  const num = Number(value);
  return (
    <span style={{ color: num >= 0 ? '#cf1322' : '#389e0d', fontWeight: 'bold' }}>
      {num >= 0 ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
};

/** 数据源展示配色：中证灰、中证+新浪金、新浪橙（说明文案与表格单元格共用） */
const DATA_SOURCE_STYLES: Record<IndexSpotSource, { color: string; background: string; border: string }> = {
  中证: { color: '#595959', background: '#fafafa', border: '#d9d9d9' },
  '中证+新浪': { color: '#d46b08', background: '#fff7e6', border: '#ffd591' },
  新浪: { color: '#fa541c', background: '#fff2e8', border: '#ffbb96' },
};

/** 数据源标签样式（说明区与表格「数据源」列保持一致） */
const dataSourceBadgeStyle = (source: IndexSpotSource): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '20px',
  ...DATA_SOURCE_STYLES[source],
  border: `1px solid ${DATA_SOURCE_STYLES[source].border}`,
});

const Index: React.FC = () => {
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
  });
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_KEY);
  const [selectedIndices, setSelectedIndices] = useState<IndexData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<IndexData[]>([]);
  const [excludedNames, setExcludedNames] = useState<string[]>(["债", "CS", "韩", "年", "-", "+", "对冲", "目标", "海外", "ESG", "内地", "SHS", "易方达", "AA", "交银", "太保", "智选", "SSH", "ABS", "海外", "期权", "城镇"]);

  // 自定义分组
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customIndicesMap, setCustomIndicesMap] = useState<Record<string, IndexData[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const renameCancelRef = useRef(false);
  const selectedIndicesRef = useRef<IndexData[]>([]);

  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);

  const onSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: IndexData[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const handleCalculateRecommendation = async () => {
    // 仅收集结果，全部计算完成后再一次性更新表格与缓存
    const resultMap = new Map<string, { quantitative: string; percentile: string; monthlyPercentile: string; weeklyPercentile: string }>();
    // 收集本次计算结果，供计算完成后自动导出「推荐买点」Excel（不重复取数）
    const exportItems: BuySellReportItem[] = [];
    const batchResult = await runRecommendationBatchCalculation({
      targets: selectedRows,
      getKey: item => String(item['指数代码']),
      getName: item => item['指数简称'] || String(item['指数代码']),
      emptyWarn: '请选择指数',
      fetchBuyPoints: item => fetchIndexDetailAndCalculate(item),
      onItemDone: (item, result) => {
        const code = String(item['指数代码']);
        const name = item['指数简称'] || code;
        result.mqBuyPoints.forEach(point => exportItems.push({ code, name, point }));
        resultMap.set(String(item['指数代码']), result);
      },
    });
    if (resultMap.size === 0) return;

    // 将买点结果写回当前活动分组（自选或自定义分组）
    const applyResults = (list: IndexData[]): IndexData[] =>
      list.map(item => {
        const result = resultMap.get(String(item['指数代码']));
        return result
          ? {
            ...item,
            __推荐买点定量__: result.quantitative || item.__推荐买点定量__,
            __推荐买点百分位__: result.percentile || item.__推荐买点百分位__,
            __月RSI6百分位__: result.monthlyPercentile || item.__月RSI6百分位__,
            __周RSI6百分位__: result.weeklyPercentile || item.__周RSI6百分位__,
          }
          : item;
      });

    // 计算完成后自动导出「推荐买点」Excel（★1/★3/★5 全部买入信号）；
    // 在写回表格之后执行，避免导出异常影响买点回填
    const exportBuyPoints = () =>
      exportRecommendationBuyPoints({
        items: exportItems,
        itemLabel: '指数',
        filePrefix: 'A股指数',
        failureCount: batchResult.failures.length,
      });

    if (activeTab === SELECTED_TAB_KEY) {
      const latest = applyResults(selectedIndicesRef.current);
      setSelectedIndices(latest);
      saveSelectedIndices(latest);
      exportBuyPoints();
      return;
    }

    // 自定义分组
    const isCustomTab = customTabs.some(t => t.key === activeTab);
    if (isCustomTab) {
      saveGroupIndices(activeTab, prev => applyResults(prev));
      exportBuyPoints();
    }
  };

  /** 导出「买入&卖出报告」：仅导出已完成买卖配对的 ★5 信号 */
  const handleExportBuySellReport = () =>
    exportBuySellReport<IndexData>({
      targets: selectedRows,
      getCode: item => String(item['指数代码']),
      getName: item => item['指数简称'] || String(item['指数代码']),
      getKey: item => String(item['指数代码']),
      fetchPoints: async item => (await fetchIndexDetailAndCalculate(item)).mqBuyPoints,
      emptyWarn: '请选择指数',
      itemLabel: '指数',
      filePrefix: 'A股指数',
    });

  /** 导出「买入计划」：仅导出尚未卖出的 ★5 买入信号 */
  const handleExportBuyPlan = () =>
    exportBuyPlan<IndexData>({
      targets: selectedRows,
      getCode: item => String(item['指数代码']),
      getName: item => item['指数简称'] || String(item['指数代码']),
      getKey: item => String(item['指数代码']),
      fetchPoints: async item => (await fetchIndexDetailAndCalculate(item)).mqBuyPoints,
      emptyWarn: '请选择指数',
      itemLabel: '指数',
      filePrefix: 'A股指数',
    });

  /** 导出「最低 MACD 柱下一周期月K标记」：月K标记 + 持有/回撤指标 */
  const handleExportMacdBarMarker = () =>
    exportMacdBarMarker<IndexData>({
      targets: selectedRows,
      getCode: item => String(item['指数代码']),
      getName: item => item['指数简称'] || String(item['指数代码']),
      getKey: item => String(item['指数代码']),
      fetchDailyData: item => fetchIndexDailyData(item),
      emptyWarn: '请选择指数',
      itemLabel: '指数',
      filePrefix: 'A股指数',
    });

  console.log('11111 selectedIndices', selectedIndices)

  // 取指数日K「日期 + 收盘」序列（买点计算与 MACD 月K标记导出共用）
  // 中证指数走 stock_zh_index_hist_csindex（6 位代码）；新浪指数走 stock_zh_index_daily（必须带 sh/sz 前缀）
  const fetchIndexDailyData = async (index: IndexData): Promise<BuyPointKLineItem[]> => {
    const symbol = String(index['指数代码']);
    if (index['数据源'] === '新浪') {
      const response = await apiClient.get(`/api/public/stock_zh_index_daily?symbol=${encodeURIComponent(symbol)}`);
      const stockHistoryList = normalizeSinaIndexDailyRows(response?.data as SinaIndexDailyRow[] | undefined);

      // 接口异常（空数据 / 无有效收盘价）需抛出，由批量编排统一重试并汇总提示
      if (stockHistoryList.length === 0) throw new Error('接口返回空数据');
      return stockHistoryList;
    }

    // 从 A 股最早交易日开始查询，覆盖指数全部历史；接口在起始日早于首条真实数据时会补占位行，
    // 由 cleanCsindexHistory 统一剔除，避免远期伪数据点参与指标计算
    const startDate = appConfig.http.indexHistoryStartDate;
    const response = await apiClient.get(`/api/public/stock_zh_index_hist_csindex?symbol=${symbol}&start_date=${startDate}&end_date=${moment().format('YYYYMMDD')}`);
    const data = cleanCsindexHistory(response?.data as IndexDetailData[] | undefined, startDate);
    const stockHistoryList = data
      .map((item: IndexDetailData) => ({
        日期: item.日期,
        收盘: Number(item.收盘),
      }))
      .filter((item: { 日期: string; 收盘: number }) => Number.isFinite(item.收盘));

    // 接口异常（空数据 / 无有效收盘价）需抛出，由批量编排统一重试并汇总提示
    if (stockHistoryList.length === 0) throw new Error('接口返回空数据');
    return stockHistoryList;
  };

  const fetchIndexDetailAndCalculate = async (index: IndexData): Promise<BuyPointResult> =>
    computeBuyPoints({ type: 'index', rawData: await fetchIndexDailyData(index) });



  const getUniqueValues = (data: IndexData[], key: keyof IndexData): string[] => {
    return Array.from(new Set(data.map(item => String(item[key] || ''))))
      .filter(value => value !== 'null' && value !== 'undefined')
      .sort();
  };

  /** 打开指数详情：新浪指数需带 source=sina 与名称，详情页改走 stock_zh_index_daily */
  const openIndexDetail = (record: IndexData) => {
    const code = encodeURIComponent(String(record['指数代码'] || ''));
    const extra = record['数据源'] === '新浪'
      ? `&source=sina&name=${encodeURIComponent(record['指数简称'] || '')}`
      : '';
    window.open(`/stock/a/index/detail?code=${code}${extra}`);
  };

  const columns = useMemo(() => [
    {
      title: '指数代码',
      dataIndex: '指数代码',
      key: '指数代码',
      width: 70,
      // fixed: 'left' as const,
      sorter: stringSorter('指数代码'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数代码"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const codeValue = String(record['指数代码'] || '').toLowerCase();
        return codeValue.includes(searchValue);
      },
    },
    {
      title: '指数简称',
      dataIndex: '指数简称',
      key: '指数简称',
      width: 70,
      // fixed: 'left' as const,
      sorter: stringSorter('指数简称'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: { setSelectedKeys: (keys: React.Key[]) => void; selectedKeys: React.Key[]; confirm: () => void; clearFilters: () => void }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="输入指数简称"
            value={selectedKeys[0] as string}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={confirm}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>

            <Button
              type="primary"
              onClick={confirm}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
              style={{ width: 90 }}
            >
              重置
            </Button>
          </div>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
      ),
      onFilter: (value: string | number | boolean, record: IndexData) => {
        const searchValue = String(value).toLowerCase();
        const nameValue = String(record['指数简称'] || '').toLowerCase();
        return nameValue.includes(searchValue);
      },
      render: (name: string, record: IndexData) => (
        <Link
          onClick={() => openIndexDetail(record)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: (
        <span>
          数据源
          <Tooltip title="中证：仅中证指数列表；中证+新浪：两接口同码合并，指数基础字段取中证、涨跌行情取新浪；新浪：仅新浪行情，详情与买点计算走新浪日线接口">
            <QuestionCircleOutlined style={{ marginLeft: 4, color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: '数据源',
      key: '数据源',
      width: 90,
      sorter: stringSorter('数据源'),
      filters: [
        { text: '中证', value: '中证' },
        { text: '中证+新浪', value: '中证+新浪' },
        { text: '新浪', value: '新浪' },
      ],
      onFilter: (value: React.Key, record: IndexData) => (record['数据源'] || '中证') === value,
      render: (value?: IndexSpotSource) => (
        <span style={dataSourceBadgeStyle(value || '中证')}>{value || '中证'}</span>
      ),
    },
    {
      title: '季&月RSI6百分位策略',
      dataIndex: '__推荐买点百分位__',
      key: '__推荐买点百分位__',
      width: 90,
      sorter: stringSorter('__推荐买点百分位__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#f6ffed',
                      color: '#52c41a',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #b7eb8f',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      title: '季&月RSI6 定量策略',
      dataIndex: '__推荐买点定量__',
      key: '__推荐买点定量__',
      width: 90,
      sorter: stringSorter('__推荐买点定量__'),
      render: (value: string) => {
        if (!value) return <span style={{ color: '#999' }}>-</span>;
        const dates = value.split(',').reverse().filter(d => d.trim());
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {dates.map((date, index) => {
              const recent = isRecentDate(date);
              return (
                <span
                  key={index}
                  title={recent ? '近期买点（100天内）' : undefined}
                  style={recent
                    ? {
                      backgroundColor: '#fff7e6',
                      color: '#d46b08',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 'bold',
                      border: '2px solid #fa8c16',
                    }
                    : {
                      backgroundColor: '#e6f7ff',
                      color: '#1890ff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      border: '1px solid #91caff',
                    }}
                >
                  {date}
                </span>
              );
            })}
          </div>
        );
      },
    },

    {
      title: '月RSI6百分位策略',
      dataIndex: '__月RSI6百分位__',
      key: '__月RSI6百分位__',
      width: 90,
      sorter: stringSorter('__月RSI6百分位__'),
      render: renderBuyPointTags({
        backgroundColor: '#f9f0ff',
        color: '#722ed1',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #d3adf7',
      }),
    },
    {
      title: '周RSI6百分位策略',
      dataIndex: '__周RSI6百分位__',
      key: '__周RSI6百分位__',
      width: 90,
      sorter: stringSorter('__周RSI6百分位__'),
      render: renderBuyPointTags({
        backgroundColor: '#e6fffb',
        color: '#08979c',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        border: '1px solid #87e8de',
      }),
    },
    // {
    //   title: '发布时间',
    //   dataIndex: '发布时间',
    //   key: '发布时间',
    //   width: 70,
    //   ...createDateRangeFilter('发布时间'),
    //   sorter: stringSorter('发布时间'),
    //   render: (text: string) => text ? moment(text).format('YYYY-MM-DD') : '',
    // },
    {
      title: '指数类别',
      dataIndex: '指数类别',
      key: '指数类别',
      width: 70,
      sorter: stringSorter('指数类别'),
      filters: getUniqueValues(data, '指数类别').map(value => ({ text: value, value })),
      onFilter: (value: React.Key, record: IndexData) => record['指数类别']?.includes(value as string),
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      title: '基点',
      dataIndex: '基点',
      key: '基点',
      width: 70,
      sorter: stringSorter('基点'),
    },
    {
      title: '样本数量',
      dataIndex: '样本数量',
      key: '样本数量',
      width: 70,
      sorter: stringSorter('样本数量'),
    },
    {
      title: '最新收盘',
      dataIndex: '最新收盘',
      key: '最新收盘',
      width: 80,
      sorter: numberSorter('最新收盘'),
      render: renderOptionalNumber,
    },
    // 新浪行情补充列（stock_zh_index_spot_sina）：中证行没有这些字段，显示「-」
    {
      title: '涨跌额',
      dataIndex: '涨跌额',
      key: '涨跌额',
      width: 80,
      sorter: numberSorter('涨跌额'),
      render: renderChangeAmount,
    },
    {
      title: '涨跌幅',
      dataIndex: '涨跌幅',
      key: '涨跌幅',
      width: 80,
      sorter: numberSorter('涨跌幅'),
      render: renderChangePercent,
    },
    {
      title: '昨收',
      dataIndex: '昨收',
      key: '昨收',
      width: 80,
      sorter: numberSorter('昨收'),
      render: renderOptionalNumber,
    },
    {
      title: '今开',
      dataIndex: '今开',
      key: '今开',
      width: 80,
      sorter: numberSorter('今开'),
      render: renderOptionalNumber,
    },
    {
      title: '最高',
      dataIndex: '最高',
      key: '最高',
      width: 80,
      sorter: numberSorter('最高'),
      render: renderOptionalNumber,
    },
    {
      title: '最低',
      dataIndex: '最低',
      key: '最低',
      width: 80,
      sorter: numberSorter('最低'),
      render: renderOptionalNumber,
    },
    {
      title: '成交量',
      dataIndex: '成交量',
      key: '成交量',
      width: 110,
      sorter: numberSorter('成交量'),
      render: renderOptionalNumber,
    },
    {
      title: '成交额',
      dataIndex: '成交额',
      key: '成交额',
      width: 120,
      sorter: numberSorter('成交额'),
      render: renderOptionalNumber,
    },
    // {
    //   title: '指数年化率',
    //   key: '指数年化率',
    //   width: 80,
    //   sorter: stringSorter('指数年化率'),
    //   ...createRangeFilter('指数年化率'),
    //   render: (_, record: IndexData) => `${(record['指数年化率'])?.toFixed(2)}%`,
    // },

    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_, record: IndexData) => {
        const isSelected = isIndexSelected(record['指数代码']);

        // 「全部」Tab：添加到自选 + 加入分组
        if (activeTab === ALL_TAB_KEY) {
          const joinGroupItems: MenuProps['items'] = [
            {
              key: SELECTED_TAB_KEY,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                  <span>{SELECTED_TAB_LABEL}</span>
                  {isSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
                </span>
              ),
              onClick: () => toggleGroupMembership(record, SELECTED_TAB_KEY),
            },
            ...customTabs.map(tab => {
              const inGroup = isInGroup(tab.key, record['指数代码']);
              return {
                key: tab.key,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
                    <span>{tab.label}</span>
                    {inGroup && <CheckOutlined style={{ color: '#52c41a' }} />}
                  </span>
                ),
                onClick: () => toggleGroupMembership(record, tab.key),
              };
            }),
          ];

          return (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type={isSelected ? 'default' : 'primary'}
                size="small"
                onClick={() => isSelected ? removeFromSelected(record) : addToSelected(record)}
              >
                {isSelected ? '取消自选' : '添加到自选'}
              </Button>
              <Dropdown menu={{ items: joinGroupItems }} placement="bottomRight">
                <Button type="default" size="small">
                  加入分组
                </Button>
              </Dropdown>
            </div>
          );
        }

        // 自选或自定义分组 Tab：移出 + 加入到 + 置顶置底
        const groupKey = activeTab;
        const crossMenuItems = buildCrossGroupMenuItems(record, groupKey);

        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              type="default"
              danger
              size="small"
              onClick={() => removeFromGroup(groupKey, record)}
            >
              移出{groupKey === SELECTED_TAB_KEY ? '自选' : '分组'}
            </Button>
            {crossMenuItems && crossMenuItems.length > 0 && (
              <Dropdown menu={{ items: crossMenuItems }} placement="bottomRight">
                <Button type="default" size="small">
                  加入到
                </Button>
              </Dropdown>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => moveInGroup(groupKey, record, 'top')}
            >
              置顶
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => moveInGroup(groupKey, record, 'bottom')}
            >
              置底
            </Button>
          </div>
        );
      },
    },
  ], [data, selectedIndices, activeTab, customTabs, customIndicesMap, renaming]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 中证指数列表为主数据；新浪股票指数行情作为补充（失败时仍展示中证列表）
      const [csindexResult, sinaResult] = await Promise.allSettled([
        apiClient.get('/api/public/index_csindex_all'),
        apiClient.get('/api/public/stock_zh_index_spot_sina'),
      ]);
      if (csindexResult.status === 'rejected') {
        console.log('中证指数列表获取失败', csindexResult.reason);
      }
      if (sinaResult.status === 'rejected') {
        console.log('新浪股票指数行情获取失败，仅展示中证指数', sinaResult.reason);
      }

      const csindexRows: IndexData[] = csindexResult.status === 'fulfilled'
        ? ((csindexResult.value?.data || []) as IndexData[])
        : [];
      const sinaRows: SinaIndexSpotRow[] = sinaResult.status === 'fulfilled'
        ? ((sinaResult.value?.data || []) as SinaIndexSpotRow[])
        : [];

      // 中证行先算指数年化率；新浪行无基点/发布时间，年化率为空
      const rowsWithAnnualReturn = csindexRows.map((item) => {
        if (!item['发布时间'] || !item['最新收盘'] || !item['基点'] || item['基点'] === 0) {
          return { ...item, '指数年化率': undefined };
        }
        const years = moment().diff(moment(item['发布时间']), 'years', true);
        if (years < 1) {
          return { ...item, '指数年化率': undefined };
        }
        const annualReturn = Math.pow(item['最新收盘'] / item['基点'], 1 / years) - 1;
        return { ...item, '指数年化率': annualReturn * 100 };
      });

      // 同码（去 sh/sz 前缀）以中证行为准，新浪行情只补齐涨跌额/涨跌幅等字段；新浪独有指数追加到尾部
      let newData: IndexData[] = mergeIndexSpotLists(rowsWithAnnualReturn, sinaRows);

      if (excludedNames.length > 0) {
        newData = newData.filter((item) => {
          const indexNameShortName = String(item['指数简称'] || '').toLowerCase();
          return !excludedNames.some(excludedName =>
            indexNameShortName.includes(excludedName.toLowerCase())
          );
        });
      }

      setData(newData);

      // 用新数据刷新自选与所有自定义分组（保留买点字段）
      // 匹配优先用完整代码（新浪 sh/sz 前缀），回退到去前缀同码（兼容旧自选里的中证/新浪重复行）
      const findFreshIndex = (freshList: IndexData[], oldItem: IndexData): IndexData | undefined => {
        const exact = freshList.find(f => f['指数代码'] === oldItem['指数代码']);
        if (exact) return exact;
        const normalized = normalizeIndexCode(oldItem['指数代码']);
        return normalized
          ? freshList.find(f => normalizeIndexCode(f['指数代码']) === normalized)
          : undefined;
      };

      const mergeFreshIndices = (oldList: IndexData[], freshList: IndexData[]): IndexData[] => {
        return oldList.map(oldItem => {
          const matched = findFreshIndex(freshList, oldItem);
          if (!matched) return oldItem;
          return {
            ...matched,
            __推荐买点定量__: oldItem.__推荐买点定量__,
            __推荐买点百分位__: oldItem.__推荐买点百分位__,
            __月RSI6百分位__: oldItem.__月RSI6百分位__,
            __周RSI6百分位__: oldItem.__周RSI6百分位__,
          };
        });
      };

      if (selectedIndices.length > 0) {
        const updated = mergeFreshIndices(selectedIndices, newData);
        setSelectedIndices(updated);
        saveSelectedIndices(updated);
      }

      const customKeys = Object.keys(customIndicesMap);
      if (customKeys.length > 0) {
        setCustomIndicesMap(prev => {
          const next: Record<string, IndexData[]> = { ...prev };
          customKeys.forEach(key => {
            next[key] = mergeFreshIndices(prev[key] || [], newData);
          });
          persistCustomIndices(next);
          return next;
        });
      }
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelectedIndices();
    loadCustomTabs();
  }, []);

  // 从localStorage加载自选指数
  const loadSelectedIndices = () => {
    try {
      const savedIndices = localStorage.getItem('selectedIndices');
      if (savedIndices) {
        setSelectedIndices(JSON.parse(savedIndices));
      }
    } catch (error) {
      console.log('加载自选指数失败:', error);
    }
  };

  // 保存自选指数到localStorage
  const saveSelectedIndices = (indices: IndexData[]) => {
    try {
      localStorage.setItem('selectedIndices', JSON.stringify(indices));
    } catch (error) {
      console.log('保存自选指数失败:', error);
    }
  };

  // 加载自定义分组
  const loadCustomTabs = () => {
    try {
      const savedTabs = localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
      const savedMap = localStorage.getItem(CUSTOM_INDICES_STORAGE_KEY);
      const validTabs: CustomTab[] = savedTabs ? JSON.parse(savedTabs) : [];
      const stocksMap: Record<string, IndexData[]> = savedMap ? JSON.parse(savedMap) : {};
      const validKeys = new Set(validTabs.map(t => t.key));
      const cleanedMap: Record<string, IndexData[]> = {};
      Object.keys(stocksMap).forEach(key => {
        if (validKeys.has(key) && Array.isArray(stocksMap[key])) {
          cleanedMap[key] = stocksMap[key];
        }
      });
      setCustomTabs(validTabs);
      setCustomIndicesMap(cleanedMap);
    } catch (error) {
      console.log('加载自定义分组失败:', error);
    }
  };

  const persistCustomTabs = (tabs: CustomTab[]) => {
    localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(tabs));
  };

  const persistCustomIndices = (map: Record<string, IndexData[]>) => {
    localStorage.setItem(CUSTOM_INDICES_STORAGE_KEY, JSON.stringify(map));
  };

  // 按分组 key 读取指数（selected 为固定自选分组）
  // 注意：渲染必须走 state，不能用 ref——ref 仅在 setState 后的 effect 里同步，
  // 若用它作为表格 dataSource，则 setState 触发的重渲染读到的仍是旧数组，导致算完买点后表格不刷新
  const getGroupIndices = (groupKey: string): IndexData[] =>
    groupKey === SELECTED_TAB_KEY ? selectedIndices : (customIndicesMap[groupKey] || []);

  // 按分组 key 写入指数并持久化（支持函数式更新）
  const saveGroupIndices = (
    groupKey: string,
    updater: IndexData[] | ((prev: IndexData[]) => IndexData[]),
  ) => {
    if (groupKey === SELECTED_TAB_KEY) {
      const next = typeof updater === 'function' ? updater(selectedIndicesRef.current) : updater;
      setSelectedIndices(next);
      saveSelectedIndices(next);
      return;
    }
    setCustomIndicesMap(prev => {
      const nextList = typeof updater === 'function' ? updater(prev[groupKey] || []) : updater;
      const next = { ...prev, [groupKey]: nextList };
      persistCustomIndices(next);
      return next;
    });
  };

  const getGroupLabel = (groupKey: string): string =>
    groupKey === SELECTED_TAB_KEY
      ? SELECTED_TAB_LABEL
      : customTabs.find(t => t.key === groupKey)?.label || '分组';

  // 添加到指定分组
  const addToGroup = (groupKey: string, index: IndexData) => {
    const list = getGroupIndices(groupKey);
    if (list.some(s => s['指数代码'] === index['指数代码'])) {
      message.info(`「${index['指数简称'] || index['指数代码']}」已在「${getGroupLabel(groupKey)}」中`);
      return;
    }
    saveGroupIndices(groupKey, [...list, index]);
    message.success(`已添加 ${index['指数简称'] || index['指数代码']} 到「${getGroupLabel(groupKey)}」`);
  };

  // 从指定分组移除
  const removeFromGroup = (groupKey: string, index: IndexData) => {
    saveGroupIndices(groupKey, list => list.filter(s => s['指数代码'] !== index['指数代码']));
    message.info(`已从「${getGroupLabel(groupKey)}」移除 ${index['指数简称'] || index['指数代码']}`);
  };

  // 切换某指数在目标分组的归属状态——已在则移除，不在则加入
  const toggleGroupMembership = (record: IndexData, targetKey: string) => {
    const list = getGroupIndices(targetKey);
    if (list.some(s => s['指数代码'] === record['指数代码'])) {
      saveGroupIndices(targetKey, list.filter(s => s['指数代码'] !== record['指数代码']));
    } else {
      saveGroupIndices(targetKey, [...list, record]);
    }
  };

  // 判断指数是否已在某分组
  const isInGroup = (groupKey: string, code: string) =>
    getGroupIndices(groupKey).some(s => s['指数代码'] === code);

  // 分组内置顶/置底
  const moveInGroup = (groupKey: string, index: IndexData, position: 'top' | 'bottom') => {
    const list = getGroupIndices(groupKey);
    const rest = list.filter(s => s['指数代码'] !== index['指数代码']);
    saveGroupIndices(groupKey, position === 'top' ? [index, ...rest] : [...rest, index]);
  };

  // 新建分组
  const handleCreateTab = () => {
    const name = newTabName.trim();
    if (!name) {
      message.warning('请输入分组名称');
      return;
    }
    if (customTabs.some(t => t.label === name) || name === SELECTED_TAB_LABEL) {
      message.error('分组名称已存在');
      return;
    }
    const key = `custom-${Date.now()}`;
    const nextTabs = [...customTabs, { key, label: name }];
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    const nextMap = { ...customIndicesMap, [key]: [] };
    setCustomIndicesMap(nextMap);
    persistCustomIndices(nextMap);
    setActiveTab(key);
    setCreateOpen(false);
    setNewTabName('');
    message.success(`分组「${name}」已创建`);
  };

  // 删除分组（含分组内指数）
  const handleDeleteTab = (tab: CustomTab) => {
    const nextTabs = customTabs.filter(t => t.key !== tab.key);
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
    setCustomIndicesMap(prev => {
      const next = { ...prev };
      delete next[tab.key];
      persistCustomIndices(next);
      return next;
    });
    if (activeTab === tab.key) {
      setActiveTab(SELECTED_TAB_KEY);
    }
    setRenaming(null);
    message.success(`分组「${tab.label}」已删除`);
  };

  const startRename = (tab: CustomTab) => {
    renameCancelRef.current = false;
    setRenaming({ key: tab.key, value: tab.label });
  };

  // 提交重命名（空名称/Esc 取消）
  const commitRename = () => {
    if (!renaming || renameCancelRef.current) return;
    const value = renaming.value.trim();
    setRenaming(null);
    if (!value) {
      message.warning('分组名称不能为空，已还原');
      return;
    }
    const target = customTabs.find(t => t.key === renaming.key);
    if (!target || target.label === value) return;
    if (customTabs.some(t => t.key !== renaming.key && t.label === value) || value === SELECTED_TAB_LABEL) {
      message.error('分组名称已存在，已还原');
      return;
    }
    const nextTabs = customTabs.map(t => (t.key === renaming.key ? { ...t, label: value } : t));
    setCustomTabs(nextTabs);
    persistCustomTabs(nextTabs);
  };

  // 切换 tab 时退出重命名并清空批量选择
  const handleTabChange = (key: string) => {
    setRenaming(null);
    setActiveTab(key);
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  // 构建跨分组「加入到」菜单项（排除当前分组）
  const buildCrossGroupMenuItems = (record: IndexData, currentGroupKey: string): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    // 自选
    if (currentGroupKey !== SELECTED_TAB_KEY) {
      const inSelected = isInGroup(SELECTED_TAB_KEY, record['指数代码']);
      items.push({
        key: SELECTED_TAB_KEY,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
            <span>{SELECTED_TAB_LABEL}</span>
            {inSelected && <CheckOutlined style={{ color: '#52c41a' }} />}
          </span>
        ),
        onClick: () => toggleGroupMembership(record, SELECTED_TAB_KEY),
      });
    }
    // 其他自定义分组
    customTabs.forEach(tab => {
      if (tab.key === currentGroupKey) return;
      const inGroup = isInGroup(tab.key, record['指数代码']);
      items.push({
        key: tab.key,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
            <span>{tab.label}</span>
            {inGroup && <CheckOutlined style={{ color: '#52c41a' }} />}
          </span>
        ),
        onClick: () => toggleGroupMembership(record, tab.key),
      });
    });
    return items;
  };

  // 渲染自定义分组的 tab 标题：点铅笔图标重命名（单击即编辑），× 删除
  const renderCustomTabLabel = (tab: CustomTab) => {
    if (renaming?.key === tab.key) {
      return (
        <Input
          size="small"
          autoFocus
          value={renaming.value}
          maxLength={12}
          style={{ width: 130, margin: '0 4px' }}
          onChange={e => setRenaming({ key: tab.key, value: e.target.value })}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onFocus={e => e.target.select()}
          onPressEnter={commitRename}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              renameCancelRef.current = true;
              setRenaming(null);
            }
          }}
        />
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <span>{tab.label}</span>
        <EditOutlined
          title="点击重命名"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            startRename(tab);
          }}
        />
        <Popconfirm
          title={`删除分组「${tab.label}」？`}
          description="分组内的指数列表将一并删除"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeleteTab(tab)}
        >
          <CloseOutlined
            title="删除分组"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          />
        </Popconfirm>
      </span>
    );
  };

  // 添加到自选
  const addToSelected = (index: IndexData) => {
    const isAlreadySelected = selectedIndices.some(i => i['指数代码'] === index['指数代码']);
    if (!isAlreadySelected) {
      const newSelectedIndices = [...selectedIndices, index];
      setSelectedIndices(newSelectedIndices);
      saveSelectedIndices(newSelectedIndices);
    }
  };

  // 从自选中移除
  const removeFromSelected = (index: IndexData) => {
    const newSelectedIndices = selectedIndices.filter(i => i['指数代码'] !== index['指数代码']);
    setSelectedIndices(newSelectedIndices);
    saveSelectedIndices(newSelectedIndices);
  };

  // 检查指数是否已在自选中
  const isIndexSelected = (indexCode: string) => {
    return selectedIndices.some(i => i['指数代码'] === indexCode);
  };


  // 渲染分组表格（自选和自定义分组通用）
  const renderGroupTable = (groupKey: string) => {
    const list = getGroupIndices(groupKey);
    return (
      <>
        <BuyPointActionGroup
          onCalculate={handleCalculateRecommendation}
          onExportReport={handleExportBuySellReport}
          onExportPlan={handleExportBuyPlan}
          onExportMacdBarMarker={handleExportMacdBarMarker}
          itemLabel="指数"
        />
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: onSelectChange,
          }}
          columns={columns}
          dataSource={list}
          rowKey="指数代码"
          scroll={{ x: 3000, y: 'calc(100vh - 350px)' }}
          pagination={false}
        />
      </>
    );
  };

  return (
    <div style={{ padding: '0 24px', height: 'calc(100vh - 64px - 32px)', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        tabBarExtraContent={{
          right: (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setNewTabName('');
                setCreateOpen(true);
              }}
            >
              新建分组
            </Button>
          ),
        }}
      >
        <TabPane tab="全部" key={ALL_TAB_KEY}>
          <div style={{ marginBottom: '16px', textAlign: 'right' }}>
            不包含指数简称：
            <Select
              mode="tags"
              style={{ width: 500 }}
              placeholder="不包含指数简称"
              value={excludedNames}
              onChange={setExcludedNames}
            />


            <Button type="primary" onClick={fetchData} loading={loading}>
              搜索
            </Button>
          </div>
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e6f4ff',
            background: 'linear-gradient(90deg, #f0f7ff 0%, #fafcff 60%, #ffffff 100%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 20px',
            fontSize: 12,
            lineHeight: '20px',
            color: '#595959',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#1f3b57' }}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              数据源说明
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={dataSourceBadgeStyle('中证')}>中证</span>
              仅中证指数列表
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={dataSourceBadgeStyle('中证+新浪')}>中证+新浪</span>
              两接口同码合并：指数基础字段取中证、涨跌行情取新浪
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={dataSourceBadgeStyle('新浪')}>新浪</span>
              仅新浪行情，详情与买点计算走新浪日线接口
            </span>
          </div>
          <Table
            columns={columns?.filter(c => c.key !== '__推荐买点定量__' && c.key !== '__推荐买点百分位__' && c.key !== '__月RSI6百分位__' && c.key !== '__周RSI6百分位__') || []}
            dataSource={data}
            loading={loading}
            rowKey="指数代码"
            scroll={{ x: 2400, y: 'calc(100vh - 350px)' }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ current: 1, pageSize: size });
              },
            }}
          />
        </TabPane>
        <TabPane tab={SELECTED_TAB_LABEL} key={SELECTED_TAB_KEY}>
          {renderGroupTable(SELECTED_TAB_KEY)}
        </TabPane>
        {customTabs.map(tab => (
          <TabPane tab={renderCustomTabLabel(tab)} key={tab.key}>
            {renderGroupTable(tab.key)}
          </TabPane>
        ))}

      </Tabs>

      <Modal
        title="新建分组"
        open={createOpen}
        onOk={handleCreateTab}
        onCancel={() => {
          setCreateOpen(false);
          setNewTabName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入分组名称"
          value={newTabName}
          maxLength={12}
          autoFocus
          onChange={e => setNewTabName(e.target.value)}
          onPressEnter={handleCreateTab}
        />
      </Modal>
    </div>
  );
};

export default Index;
