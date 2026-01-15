import React, { useState, useEffect, useContext } from 'react';
import { Card, Form, Input, Button, Tabs, message, Space, Row, Col, Modal, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import './Login.css';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // 创建表单实例，以便获取输入框的值
  const [emailForm] = Form.useForm();
  
  // 倒计时状态
  const [countdown, setCountdown] = useState(0);

  // 倒计时逻辑
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // === 1. 密码登录 ===
  const onPasswordLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithPassword(values.username, values.password);
      
      // 适配后端返回结构：如果是 token + username
      const token = result.session_token || result.token;
      const user = result.user || { username: values.username }; // 兜底逻辑

      if (token) {
        login(user, token);
        message.success('登录成功');
        navigate('/');
      } else {
        message.error(result.msg || '登录失败：未返回Token');
      }
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.msg || error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // === 2. 发送验证码 ===
  const handleSendCode = async () => {
    try {
      // 校验邮箱字段格式
      const values = await emailForm.validateFields(['email']);
      const email = values.email;

      setCountdown(60); // 开始倒计时
      message.loading({ content: '发送中...', key: 'send_code' });
      
      const res = await authService.sendEmailCode(email, 'login');
      
      if (res.status === 'success') {
        message.success({ content: res.msg || '验证码已发送，请查收邮件', key: 'send_code' });
      } else {
        message.error({ content: res.msg || '发送失败', key: 'send_code' });
        setCountdown(0); // 失败重置倒计时
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 表单校验失败，不做处理
        return;
      }
      message.error({ content: error.response?.data?.msg || '发送请求失败', key: 'send_code' });
      setCountdown(0);
    }
  };

  // === 3. 邮箱验证码登录 ===
  const onEmailLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithEmail(values.email, values.code);
      
      if (result.status === 'success' || result.token) {
        const token = result.session_token || result.token;
        // 构造用户对象
        const user = { username: result.username || values.email };
        
        login(user, token);
        message.success('登录成功');
        navigate('/');
      } else {
        message.error(result.msg || '验证码错误');
      }
    } catch (error: any) {
      message.error(error.response?.data?.msg || error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // === 4. 注册 ===
  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.register(values.username, values.email, values.password);
      
      // 使用 Modal 显示恢复码，确保用户看到
      Modal.success({
        title: '注册成功！',
        content: (
          <div>
            <p>请务必妥善保管您的<b>恢复码</b>：</p>
            <Typography.Title level={4} style={{ textAlign: 'center', color: '#1890ff' }}>
              {result.recovery_code}
            </Typography.Title>
            <p>当您通过邮箱登录且忘记密码时，需要使用此恢复码解锁您的加密文件。</p>
          </div>
        ),
        onOk: async () => {
          // 注册成功后自动登录
          const loginResult = await authService.loginWithPassword(values.username, values.password);
          const token = loginResult.session_token || loginResult.token;
          
          if (token) {
            login(loginResult.user || { username: values.username }, token);
            navigate('/');
          }
        }
      });
      
    } catch (error: any) {
      message.error(error.response?.data?.msg || error.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" title="🛡️ 网络加密磁盘系统">
        <Tabs defaultActiveKey="login" centered>
          
          {/* === 登录页签 === */}
          <TabPane tab="登录" key="login">
            <Tabs defaultActiveKey="password" size="small" type="card">
              
              {/* 子页签：密码登录 */}
              <TabPane tab="密码登录" key="password">
                <Form
                  name="password-login"
                  onFinish={onPasswordLogin}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>

              {/* 子页签：邮箱登录 */}
              <TabPane tab="邮箱免密" key="email">
                <Form
                  form={emailForm} // 绑定 Form 实例
                  name="email-login"
                  onFinish={onEmailLogin}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '邮箱格式不正确' },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="请输入QQ邮箱" />
                  </Form.Item>
                  
                  <Form.Item>
                    <Row gutter={8}>
                      <Col span={15}>
                        <Form.Item
                          name="code"
                          noStyle
                          rules={[{ required: true, message: '请输入验证码' }]}
                        >
                          <Input prefix={<SafetyCertificateOutlined />} placeholder="6位验证码" />
                        </Form.Item>
                      </Col>
                      <Col span={9}>
                        <Button 
                          block 
                          onClick={handleSendCode} 
                          disabled={countdown > 0}
                        >
                          {countdown > 0 ? `${countdown}s后重发` : '获取验证码'}
                        </Button>
                      </Col>
                    </Row>
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>
            </Tabs>
          </TabPane>

          {/* === 注册页签 === */}
          <TabPane tab="注册" key="register">
            <Form
              name="register"
              onFinish={onRegister}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '至少3个字符' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" />
              </Form.Item>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式无效' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '至少6个字符' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="设置密码" />
              </Form.Item>
              <Form.Item
                name="confirm"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  立即注册
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Login;
