import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line } from '@ant-design/plots';
import { Spin, Card, Select, Empty, Tag } from 'antd';
import { useSearchParams } from 'react-router-dom';
import apiClient from '@/utils/axios';

type PeerRow = {
  排名: string;
  代码: string;
  简称: string;
  PEG: number;
  [key: string]: string | number | undefined;
};

const FIXED_FIELDS = ['排名', '代码', '简称', 'PEG'] as const;
const DEFAULT_SELECTED_METRICS = ['PEG', '市盈率-TTM', '市净率-MRQ', '市销率-TTM'];

const ValuationComparison: React.FC = () => {
 return <div>
  todo 同行比较
 </div>
};

export default ValuationComparison;
