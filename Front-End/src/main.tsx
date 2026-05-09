import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import AppRoutes from "@/routers/index";
// import { ConfigProvider } from '@ant-design/charts';

createRoot(document.getElementById('root')!).render(
  <>
    <AppRoutes />
  </>
)

