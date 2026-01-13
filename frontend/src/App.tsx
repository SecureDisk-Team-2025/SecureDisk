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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查是否有保存的会话
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      authService.getCurrentUser()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('session_token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData: any, token: string) => {
    setUser(userData);
    localStorage.setItem('session_token', token);
    message.success('登录成功');
  };

  const logout = () => {
    authService.logout().finally(() => {
      setUser(null);
      localStorage.removeItem('session_token');
      message.success('已登出');
    });
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Router>
        <Layout className="app-layout">
          <Content>
            <Routes>
              <Route
                path="/login"
                element={user ? <Navigate to="/" /> : <Login />}
              />
              <Route
                path="/"
                element={user ? <Dashboard /> : <Navigate to="/login" />}
              />
            </Routes>
          </Content>
        </Layout>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
