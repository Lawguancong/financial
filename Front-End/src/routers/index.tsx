import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from 'react';
import { Spin } from 'antd';
import MainLayout from "@/layouts/MainLayout";
import { routeConfigs } from "@/config/menuConfig";

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          {routeConfigs.map((route: { path: string; component: React.LazyExoticComponent<React.ComponentType> | React.ComponentType }) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Suspense fallback={<PageLoader />}>
                  <route.component />
                </Suspense>
              }
            />
          ))}
        </Route>
      </Routes>
    </Router>
  );
};

export default AppRoutes;
