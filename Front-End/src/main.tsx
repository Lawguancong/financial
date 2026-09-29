import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import AppRoutes from "@/routers/index";
// import { ConfigProvider } from '@ant-design/charts';

createRoot(document.getElementById('root')!).render(
  <>
    {/* StrictMode 的“双重挂载”机制
    从 React 18 开始，为了帮助开发者发现潜在的副作用 bug（如内存泄漏、未清理的定时器、竞态条件），开发环境下的 StrictMode 会故意执行以下操作：
    1.第一次挂载：执行组件渲染 -> 触发 useEffect。
    2.立即卸载：模拟销毁组件 -> 触发 useEffect 的 cleanup (清理函数)。
    3.第二次挂载：再次执行组件渲染 -> 再次触发 useEffect。 */}
    {/* <StrictMode> */}
    {/* todo 定制主题 */}
    {/* <ConfigProvider common={{ theme: 'dark' }}> */}
    <AppRoutes />
    {/* </ConfigProvider> */}
    {/* </StrictMode> */}
  </>
)

