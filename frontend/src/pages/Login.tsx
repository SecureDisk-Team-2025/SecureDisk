import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import './Login.css';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = React.useContext(AuthContext);
  const navigate = useNavigate();

  // 密码登录
  const onPasswordLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithPassword(values.username, values.password);
      login(result.user, result.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 邮箱验证码登录
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);

  const sendEmailCode = async (email: string) => {
    setEmailCodeLoading(true);
    try {
      await authService.sendEmailCode(email, 'login');
      setEmailCodeSent(true);
      message.success('验证码已发送到邮箱');
    } catch (error: any) {
      message.error(error.response?.data?.error || '发送验证码失败');
    } finally {
      setEmailCodeLoading(false);
    }
  };

  const onEmailLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithEmail(values.email, values.code);
      login(result.user, result.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.register(values.username, values.email, values.password);
      message.success(`注册成功！恢复码：${result.recovery_code}（请妥善保管）`);
      // 自动登录
      const loginResult = await authService.loginWithPassword(values.username, values.password);
      login(loginResult.user, loginResult.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" title="网络加密磁盘系统">
        <Tabs defaultActiveKey="login" centered>
          <TabPane tab="登录" key="login">
            <Tabs defaultActiveKey="password" size="small">
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
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="用户名"
                    />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>
              <TabPane tab="邮箱验证码登录" key="email">
                <Form
                  name="email-login"
                  onFinish={onEmailLogin}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="邮箱地址"
                    />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Form.Item
                        name="code"
                        noStyle
                        rules={[{ required: true, message: '请输入验证码' }]}
                      >
                        <Input
                          placeholder="验证码"
                          style={{ width: 200 }}
                        />
                      </Form.Item>
                      <Button
                        onClick={() => {
                          const email = document.querySelector<HTMLInputElement>('input[name="email"]')?.value;
                          if (email) {
                            sendEmailCode(email);
                          } else {
                            message.warning('请先输入邮箱地址');
                          }
                        }}
                        loading={emailCodeLoading}
                        disabled={emailCodeSent}
                      >
                        {emailCodeSent ? '已发送' : '发送验证码'}
                      </Button>
                    </Space>
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
                  { min: 3, message: '用户名至少3个字符' },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                />
              </Form.Item>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="邮箱地址"
                />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码（至少8位，包含大小写字母和数字）"
                />
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
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="确认密码"
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  注册
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
