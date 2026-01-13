<<<<<<< HEAD
import React, { useState, useEffect, useContext } from 'react';
import { Card, Form, Input, Button, Tabs, message, Space, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
=======
import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import './Login.css';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
<<<<<<< HEAD
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
=======
  const { login } = React.useContext(AuthContext);
  const navigate = useNavigate();

  // 密码登录
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
  const onPasswordLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithPassword(values.username, values.password);
<<<<<<< HEAD
      
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
=======
      login(result.user, result.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
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
=======
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

>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
  const onEmailLogin = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.loginWithEmail(values.email, values.code);
<<<<<<< HEAD
      
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
=======
      login(result.user, result.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  // === 4. 注册 ===
=======
  // 注册
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const result = await authService.register(values.username, values.email, values.password);
      message.success(`注册成功！恢复码：${result.recovery_code}（请妥善保管）`);
<<<<<<< HEAD
      
      // 注册成功后自动登录
      const loginResult = await authService.loginWithPassword(values.username, values.password);
      const token = loginResult.session_token || loginResult.token;
      
      if (token) {
        login(loginResult.user || { username: values.username }, token);
        navigate('/');
      }
    } catch (error: any) {
      message.error(error.response?.data?.msg || error.response?.data?.error || '注册失败');
=======
      // 自动登录
      const loginResult = await authService.loginWithPassword(values.username, values.password);
      login(loginResult.user, loginResult.session_token);
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '注册失败');
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
<<<<<<< HEAD
      <Card className="login-card" title="🛡️ 网络加密磁盘系统">
        <Tabs defaultActiveKey="login" centered>
          
          {/* === 登录页签 === */}
          <TabPane tab="登录" key="login">
            <Tabs defaultActiveKey="password" size="small" type="card">
              
              {/* 子页签：密码登录 */}
=======
      <Card className="login-card" title="网络加密磁盘系统">
        <Tabs defaultActiveKey="login" centered>
          <TabPane tab="登录" key="login">
            <Tabs defaultActiveKey="password" size="small">
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
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
<<<<<<< HEAD
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
=======
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="用户名"
                    />
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
<<<<<<< HEAD
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
=======
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>
<<<<<<< HEAD

              {/* 子页签：邮箱登录 */}
              <TabPane tab="邮箱免密" key="email">
                <Form
                  form={emailForm} // 绑定 Form 实例
=======
              <TabPane tab="邮箱验证码登录" key="email">
                <Form
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                  name="email-login"
                  onFinish={onEmailLogin}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
<<<<<<< HEAD
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

=======
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
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>
            </Tabs>
          </TabPane>
<<<<<<< HEAD

          {/* === 注册页签 === */}
=======
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
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
<<<<<<< HEAD
                  { min: 3, message: '至少3个字符' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" />
=======
                  { min: 3, message: '用户名至少3个字符' },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                />
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
              </Form.Item>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
<<<<<<< HEAD
                  { type: 'email', message: '邮箱格式无效' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
=======
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="邮箱地址"
                />
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
              </Form.Item>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
<<<<<<< HEAD
                  { min: 6, message: '至少6个字符' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="设置密码" />
=======
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码（至少8位，包含大小写字母和数字）"
                />
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
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
<<<<<<< HEAD
                      return Promise.reject(new Error('两次密码不一致'));
=======
                      return Promise.reject(new Error('两次输入的密码不一致'));
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                    },
                  }),
                ]}
              >
<<<<<<< HEAD
                <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  立即注册
=======
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="确认密码"
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}>
                  注册
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

<<<<<<< HEAD
export default Login;
=======
export default Login;
>>>>>>> 46349feb07a9b5298ab241eeb463bd0577bbc3ce
