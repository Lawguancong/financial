import React from 'react';
import { InputNumber, Button, Space, DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

export interface RangeFilterValue {
  min?: number;
  max?: number;
}

export interface RangeFilter<T extends Record<string, unknown>> {
  filterDropdown: ({ 
    setSelectedKeys, 
    selectedKeys, 
    confirm, 
    clearFilters 
  }: { 
    setSelectedKeys: (keys: React.Key[]) => void; 
    selectedKeys: React.Key[]; 
    confirm: () => void; 
    clearFilters: () => void 
  }) => React.ReactNode;
  filterIcon: (filtered: boolean) => React.ReactNode;
  onFilter: (value: string | number | boolean, record: T) => boolean;
}

export const createRangeFilter = <T extends Record<string, unknown>>(
  dataKey: keyof T
): RangeFilter<T> => ({
  filterDropdown: ({ 
    setSelectedKeys, 
    selectedKeys, 
    confirm, 
    clearFilters 
  }: { 
    setSelectedKeys: (keys: React.Key[]) => void; 
    selectedKeys: React.Key[]; 
    confirm: () => void; 
    clearFilters: () => void 
  }) => {
    let minValue: number | undefined;
    let maxValue: number | undefined;
    
    try {
      const filterValue = selectedKeys[0] as string;
      if (filterValue) {
        const parsed = JSON.parse(filterValue) as RangeFilterValue;
        minValue = parsed.min;
        maxValue = parsed.max;
      }
    } catch (e) {
      console.error('解析筛选值失败', e);
    }
    
    return (
      <div style={{ padding: 8 }}>
        <Space orientation="vertical" size={8}>
          <div>
            <span style={{ marginRight: 8 }}>≥</span>
            <InputNumber
              placeholder="最小值"
              value={minValue}
              onChange={(value) => {
                const filterValue = JSON.stringify({ min: value, max: maxValue });
                setSelectedKeys([filterValue]);
              }}
              style={{ width: 120 }}
              precision={2}
            />
          </div>
          <div>
            <span style={{ marginRight: 8 }}>≤</span>
            <InputNumber
              placeholder="最大值"
              value={maxValue}
              onChange={(value) => {
                const filterValue = JSON.stringify({ min: minValue, max: value });
                setSelectedKeys([filterValue]);
              }}
              style={{ width: 120 }}
              precision={2}
            />
          </div>
          <Space>
            <Button type="primary" onClick={confirm} size="small">
              确定
            </Button>
            <Button onClick={() => {
              clearFilters();
              confirm();
            }} size="small">
              重置
            </Button>
          </Space>
        </Space>
      </div>
    );
  },
  filterIcon: (filtered: boolean) => (
    <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
  ),
  onFilter: (value: string | number | boolean, record: T) => {
    let minValue: number | undefined;
    let maxValue: number | undefined;
    
    try {
      const parsed = JSON.parse(String(value)) as RangeFilterValue;
      minValue = parsed.min;
      maxValue = parsed.max;
    } catch (e) {
      console.error('解析筛选值失败', e);
    }
    
    const recordValue = record[dataKey];
    
    if (recordValue === null || recordValue === undefined || recordValue === '' || recordValue === 'null' || recordValue === 'undefined') {
      return false;
    }
    
    const numericValue = Number(recordValue);
    
    if (isNaN(numericValue)) {
      return false;
    }
    
    if (minValue !== undefined && maxValue !== undefined && !isNaN(minValue) && !isNaN(maxValue)) {
      return numericValue >= minValue && numericValue <= maxValue;
    } else if (minValue !== undefined && !isNaN(minValue)) {
      return numericValue >= minValue;
    } else if (maxValue !== undefined && !isNaN(maxValue)) {
      return numericValue <= maxValue;
    }
    return true;
  },
});

export const numberSorter = <T extends Record<string, unknown>>(
  key: keyof T
) => (a: T, b: T) => {
  const aValue = a[key] || 0;
  const bValue = b[key] || 0;
  return (aValue as number) - (bValue as number);
};

export const stringSorter = <T extends Record<string, unknown>>(
  key: keyof T
) => (a: T, b: T) => {
  const aValue = a[key];
  const bValue = b[key];
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue, 'zh-CN');
  }
  return 0;
};

export interface DateRangeFilterValue {
  start?: string;
  end?: string;
}

export interface DateRangeFilter<T extends Record<string, unknown>> {
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters
  }: {
    setSelectedKeys: (keys: React.Key[]) => void;
    selectedKeys: React.Key[];
    confirm: () => void;
    clearFilters: () => void;
  }) => React.ReactNode;
  filterIcon: (filtered: boolean) => React.ReactNode;
  onFilter: (value: string | number | boolean, record: T) => boolean;
}

export const createDateRangeFilter = <T extends Record<string, unknown>>(
  dataKey: keyof T
): DateRangeFilter<T> => ({
  filterDropdown: ({
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters
  }: {
    setSelectedKeys: (keys: React.Key[]) => void;
    selectedKeys: React.Key[];
    confirm: () => void;
    clearFilters: () => void;
  }) => {
    let startDate: Dayjs | null = null;
    let endDate: Dayjs | null = null;

    try {
      const filterValue = selectedKeys[0] as string;
      if (filterValue) {
        const parsed = JSON.parse(filterValue) as DateRangeFilterValue;
        startDate = parsed.start ? dayjs(parsed.start) : null;
        endDate = parsed.end ? dayjs(parsed.end) : null;
      }
    } catch (e) {
      console.error('解析筛选值失败', e);
    }

    return (
      <div style={{ padding: 8 }}>
        <Space orientation="vertical" size={8}>
          <DatePicker.RangePicker
            value={[startDate, endDate]}
            onChange={(dates) => {
              const filterValue = JSON.stringify({
                start: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : undefined,
                end: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : undefined,
              });
              setSelectedKeys([filterValue]);
            }}
            style={{ width: 240 }}
          />
          <Space>
            <Button type="primary" onClick={confirm} size="small">
              确定
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                confirm();
              }}
              size="small"
            >
              重置
            </Button>
          </Space>
        </Space>
      </div>
    );
  },
  filterIcon: (filtered: boolean) => (
    <span style={{ color: filtered ? '#1890ff' : undefined }}>🔍</span>
  ),
  onFilter: (value: string | number | boolean, record: T) => {
    let startDate: string | undefined;
    let endDate: string | undefined;

    try {
      const parsed = JSON.parse(String(value)) as DateRangeFilterValue;
      startDate = parsed.start;
      endDate = parsed.end;
    } catch (e) {
      console.error('解析筛选值失败', e);
    }

    const recordValue = record[dataKey];

    if (
      recordValue === null ||
      recordValue === undefined ||
      recordValue === '' ||
      recordValue === 'null' ||
      recordValue === 'undefined'
    ) {
      return false;
    }

    const recordDate = dayjs(String(recordValue));

    if (!recordDate.isValid()) {
      return false;
    }

    if (startDate && endDate) {
      return recordDate.isAfter(dayjs(startDate).subtract(1, 'day')) && recordDate.isBefore(dayjs(endDate).add(1, 'day'));
    } else if (startDate) {
      return recordDate.isAfter(dayjs(startDate).subtract(1, 'day'));
    } else if (endDate) {
      return recordDate.isBefore(dayjs(endDate).add(1, 'day'));
    }
    return true;
  },
});
