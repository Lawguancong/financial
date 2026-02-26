import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { appConfig } from '@/config/appConfig'
console.log("VITE_API_PORT 地址：", import.meta.env);
// console.log('process.env', process?.env)

// const API_BASE_URL = `http://127.0.0.1:${import.meta.env.VITE_API_PORT}`;
const API_BASE_URL = `${import.meta.env.VITE_API_PORT}`;


const apiClient = axios.create({
  baseURL: `${API_BASE_URL}`,
  timeout: 60 * 1000, // 60秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const request = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.get<T>(url, config);
  },
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.post<T>(url, data, config);
  },
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.put<T>(url, data, config);
  },
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.delete<T>(url, config);
  },
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.patch<T>(url, data, config);
  },
};

export default apiClient;