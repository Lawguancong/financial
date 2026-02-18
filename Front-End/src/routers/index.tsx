import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/Home";


// 帮我用antd生成菜单路由，菜单路由如下：
//           - 首页
//           - 估值
//             - 估值-分类1
//           - 宏观
//           - 债券
//           - 股票
//             - A股
//             - 港股
//             - 美股
//             - 其它
//           - 大宗商品
//           - 房地产
//           - 基金
//           - 期货
//           - 期权
//           - 其它-一级
//             - 其它-二级
//               - 其它-三级 
const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="valuation/category1" element={<div>估值-分类1</div>} />
          <Route path="macro" element={<div>宏观</div>} />
          <Route path="bond" element={<div>债券</div>} />
          <Route path="stock/a" element={<div>A股</div>} />
          <Route path="stock/hk" element={<div>港股</div>} />
          <Route path="stock/us" element={<div>美股</div>} />
          <Route path="stock/other" element={<div>其它</div>} />
          <Route path="commodity" element={<div>大宗商品</div>} />
          <Route path="realestate" element={<div>房地产</div>} />
          <Route path="fund" element={<div>基金</div>} />
          <Route path="futures" element={<div>期货</div>} />
          <Route path="options" element={<div>期权</div>} />
          <Route path="other/level3" element={<div>其它-三级</div>} />
        </Route>
      </Routes>
    </Router>
  );
};

export default AppRoutes;
