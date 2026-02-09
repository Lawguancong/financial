import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppRoutes from "./routers";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoutes />
    {/* <App /> */}
  </StrictMode>,
)
