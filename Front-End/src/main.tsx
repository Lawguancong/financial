import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css'
import AppRoutes from "./routers";
import { ConfigProvider } from '@ant-design/charts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 定制主题 */}
    {/* <ConfigProvider common={{ theme: 'dark' }}> */}
      <AppRoutes />
    {/* </ConfigProvider> */}
  </StrictMode>,
)
