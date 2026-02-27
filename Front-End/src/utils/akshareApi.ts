import apiClient from './axios';
import queryString from 'query-string';


/**
 * AKShare API服务
 * 用于调用后端封装的AKShare接口
 */
export type BackendType = 'original' | 'akshare';

// const API = {
//   'aktools': 'http://127.0.0.1:6670',
//   'akshare': 'http://127.0.0.1:6680',
// }

export const akshareApi = {
  /**
   * 获取A股股息率数据
   * @param params 
   * @param backend 后端类型，默认为'akshare'
   * @returns Promise<T> 股息率数据
   */
  getStockAGxl: async <T>(params = {}) => {
    const url = import.meta.env.VITE_API_API_TYPE === 'akshare' 
      ? `/api/stock/a/gxl?${queryString.stringify(params)}` 
      : `/api/public/stock_a_gxl_lg?${queryString.stringify(params)}`;
    const response = await apiClient.get<T>(url);
    return response;
  },

  /**
   * 获取A股TTM和LYR数据
   * @param symbol 股票代码，默认为'上证A股'
   * @param backend 后端类型，默认为'akshare'
   * @returns Promise<T> TTM和LYR数据
   */
  getStockATTMLYR: async <T>(params = {}) => {
    const url = import.meta.env.VITE_API_API_TYPE === 'akshare' 
      ? `/api/stock/a/ttm-lyr?${queryString.stringify(params)}` 
      : `/api/public/stock_a_ttm_lyr?${queryString.stringify(params)}`;
    const response = await apiClient.get<T>(url);
    return response;
  },

  // 更多AKShare接口可以在这里添加
};

export default akshareApi;
