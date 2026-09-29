import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Button, Checkbox, Space, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/utils/axios';
import { numberSorter, stringSorter, createRangeFilter } from '@/utils/tableUtils';
import type { TablePaginationConfig } from 'antd';

interface XstpData extends Record<string, unknown> {
  序号: number;
  股票代码: string;
  股票简称: string;
  最新价: number;
  涨跌幅: number;
  换手率: number;
}

interface RawItem {
  序号?: number | string;
  股票代码?: string;
  股票简称?: string;
  最新价?: number | string;
  涨跌幅?: number | string;
  换手率?: number | string;
}

const MA_OPTIONS = [
  '5日均线',
  '10日均线',
  '20日均线',
  '30日均线',
  '60日均线',
  '90日均线',
  '250日均线',
  '500日均线',
];

const formatItem = (item: RawItem, index: number): XstpData => ({
  序号: Number(item['序号']) || index + 1,
  股票代码: String(item['股票代码'] || ''),
  股票简称: String(item['股票简称'] || ''),
  最新价: Number(item['最新价']) || 0,
  涨跌幅: Number(item['涨跌幅']) || 0,
  换手率: Number(item['换手率']) || 0,
});

const StockUpwardBreakthrough: React.FC = () => {
  // 每个均线对应的股票代码集合
  const [maCodeSets, setMaCodeSets] = useState<Record<string, Set<string>>>({});
  // 每只股票对应保留的原始数据（多均线同时命中的优先取第一个）
  const [codeToRaw, setCodeToRaw] = useState<Map<string, RawItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [selectedMA, setSelectedMA] = useState<string[]>(['5日均线']);
  // 反选项：在交集结果里排除掉这些均线命中的股票
  const [excludedMA, setExcludedMA] = useState<string[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
  });

  const fetchData = async () => {
    setLoading(true);
    setProgress({ done: 0, total: MA_OPTIONS.length });
    try {
      const responses = await Promise.allSettled(
        MA_OPTIONS.map((ma) =>
          apiClient.get('/api/public/stock_rank_xstp_ths', { params: { symbol: ma } }),
        ),
      );

      const nextSets: Record<string, Set<string>> = {};
      const nextCodeToRaw: Map<string, RawItem> = new Map();
      let done = 0;
      responses.forEach((res, idx) => {
        done += 1;
        setProgress({ done, total: MA_OPTIONS.length });
        const ma = MA_OPTIONS[idx];
        if (res.status !== 'fulfilled') {
          nextSets[ma] = new Set();
          return;
        }
        const list: RawItem[] = Array.isArray(res.value?.data) ? res.value.data : [];
        const set = new Set<string>();
        list.forEach((item) => {
          const code = String(item['股票代码'] || '').trim();
          if (!code) return;
          set.add(code);
          if (!nextCodeToRaw.has(code)) nextCodeToRaw.set(code, item);
        });
        nextSets[ma] = set;
      });

      setMaCodeSets(nextSets);
      setCodeToRaw(nextCodeToRaw);
    } catch (error) {
      console.error('获取向上突破数据失败:', error);
      setMaCodeSets({});
      setCodeToRaw(new Map());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 切换 Checkbox 不再请求接口，基于已加载的所有 MA 集合做交集 / 反选过滤
  const data = useMemo<XstpData[]>(() => {
    const activeSets = selectedMA
      .map((ma) => maCodeSets[ma])
      .filter((set): set is Set<string> => set instanceof Set);
    if (activeSets.length === 0) return [];
    const intersection = activeSets.reduce<string[]>(
      (acc, cur) => acc.filter((code) => cur.has(code)),
      Array.from(activeSets[0]),
    );
    // 反选：在已有命中的均线条目中，去掉排除项的并集命中的股票
    const excludedUnion = new Set<string>();
    excludedMA.forEach((ma) => {
      const set = maCodeSets[ma];
      if (set instanceof Set) set.forEach((c) => excludedUnion.add(c));
    });
    const filtered = intersection.filter((code) => !excludedUnion.has(code));
    return filtered.map((code, idx) => formatItem(codeToRaw.get(code) || {}, idx));
  }, [selectedMA, excludedMA, maCodeSets, codeToRaw]);

  const columns = useMemo(
    () => [
      {
        title: '序号',
        dataIndex: '序号',
        key: '序号',
        width: 80,
        sorter: numberSorter<XstpData>('序号'),
      },
      {
        title: '股票代码',
        dataIndex: '股票代码',
        key: '股票代码',
        width: 120,
        sorter: stringSorter<XstpData>('股票代码'),
        render: (code: string, record: XstpData) => (
          <a
            onClick={() =>
              window.open(
                `/stock/a/stock/detail?symbol=${code}&name=${encodeURIComponent(record['股票简称'] || '')}`,
                '_blank',
              )
            }
          >
            {code}
          </a>
        ),
      },
      {
        title: '股票简称',
        dataIndex: '股票简称',
        key: '股票简称',
        width: 120,
        sorter: stringSorter<XstpData>('股票简称'),
      },
      {
        title: '最新价(元)',
        dataIndex: '最新价',
        key: '最新价',
        width: 120,
        sorter: numberSorter<XstpData>('最新价'),
        ...createRangeFilter<XstpData>('最新价'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
     
      {
        title: '涨跌幅(%)',
        dataIndex: '涨跌幅',
        key: '涨跌幅',
        width: 120,
        sorter: numberSorter<XstpData>('涨跌幅'),
        ...createRangeFilter<XstpData>('涨跌幅'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      {
        title: '换手率(%)',
        dataIndex: '换手率',
        key: '换手率',
        width: 120,
        sorter: numberSorter<XstpData>('换手率'),
        ...createRangeFilter<XstpData>('换手率'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ],
    [],
  );

  return (
    <Card
      title="向上突破"
      extra={
        <Space>
          {loading && (
            <Tag color="processing">
              已完成 {progress.done}/{progress.total}
            </Tag>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新数据
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <div>
          <span style={{ marginRight: 8 }}>选择均线（取交集）：</span>
          <Checkbox.Group
            options={MA_OPTIONS}
            value={selectedMA}
            onChange={(v) => setSelectedMA(v as string[])}
          />
          <span style={{ marginLeft: 16, color: '#999' }}>
            {selectedMA.length} 个
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ marginRight: 8 }}>反选（排除命中）：</span>
          <Checkbox.Group
            options={MA_OPTIONS}
            value={excludedMA}
            onChange={(v) => setExcludedMA(v as string[])}
          />
          <span style={{ marginLeft: 16, color: '#999' }}>
            {excludedMA.length} 个
          </span>
        </div>
      </div>
      <Table
        rowKey="股票代码"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 条`,
          onChange: (page: number, pageSize: number) =>
            setPagination({ current: page, pageSize }),
        }}
        onChange={(newPagination) => setPagination(newPagination)}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default StockUpwardBreakthrough;
