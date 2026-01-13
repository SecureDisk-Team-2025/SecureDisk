// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthContext } from './contexts/AuthContext';
import { authService } from './services/authService';
import './App.css';

const { Content } = Layout;

function App() {
  // 用户状态：null 表示未登录，有对象表示已登录
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 初始化检查
  useEffect(() => {
    const checkSession = async () => {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error("Session expired or invalid");
          localStorage.removeItem('session_token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  // 登录动作：Login组件调用这个方法
  const login = (userData: any, token: string) => {
    localStorage.setItem('session_token', token);
    setUser(userData);
    message.success(`欢迎回来, ${userData.username || '用户'}`);
  };

  // 登出动作
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem('session_token');
      setUser(null);
      message.success('已登出');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h3>系统加载中...</h3>
      </div>
    );
  }

  return (
    // 这里的 value 会被 Login.tsx 和 Dashboard.tsx 使用
    <AuthContext.Provider value={{ user, login, logout }}>
      <Router>
        <Layout className="app-layout" style={{ minHeight: '100vh' }}>
          <Content>
            <Routes>
              {/* 如果已登录，访问 /login 会跳到首页 */}
              <Route
                path="/login"
                element={user ? <Navigate to="/" replace /> : <Login />}
              />
              {/* 如果未登录，访问首页会跳到 /login */}
              <Route
                path="/"
                element={user ? <Dashboard /> : <Navigate to="/login" replace />}
              />
              {/* 捕获其他所有路径，重定向 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;