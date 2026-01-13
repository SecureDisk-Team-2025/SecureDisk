import axios from 'axios';
import { RSAEncryption } from '../utils/crypto';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 配置axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加session token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('session_token');
      window.location.href = '/login';
    } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      console.error('网络错误：无法连接到后端服务器');
      console.error('请确保后端服务器正在运行在 http://localhost:5000');
      console.error('启动后端：cd backend && python app.py');
    }
    return Promise.reject(error);
  }
);

// 生成RSA密钥对（客户端）
let clientKeyPairPromise: Promise<{ privateKey: string; publicKey: string }> | null = null;

export const authService = {
  // 生成客户端密钥对
  async generateKeyPair() {
    if (!clientKeyPairPromise) {
      clientKeyPairPromise = RSAEncryption.generateKeyPair();
    }
    return await clientKeyPairPromise;
  },

  // 注册
  async register(username: string, email: string, password: string) {
    const keyPair = await this.generateKeyPair();
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
    });
    
    // 保存公钥和恢复码
    localStorage.setItem('client_private_key', keyPair.privateKey);
    localStorage.setItem('client_public_key', keyPair.publicKey);
    if (response.data.recovery_code) {
      localStorage.setItem('recovery_code', response.data.recovery_code);
    }
    
    return response.data;
  },

  // 发送邮箱验证码
  async sendEmailCode(email: string, purpose: string = 'login') {
    const response = await api.post('/auth/email-code', {
      email,
      purpose,
    });
    return response.data;
  },

  // 登录（密码方式）
  async loginWithPassword(username: string, password: string) {
    const keyPair = await this.generateKeyPair();
    const response = await api.post('/auth/login', {
      type: 'password',
      username,
      password,
      public_key: keyPair.publicKey,
    });
    
    // 保存私钥和会话token
    localStorage.setItem('client_private_key', keyPair.privateKey);
    localStorage.setItem('session_token', response.data.session_token);
    
    return response.data;
  },

  // 登录（邮箱验证码方式）
  async loginWithEmail(email: string, code: string) {
    const keyPair = await this.generateKeyPair();
    const response = await api.post('/auth/login', {
      type: 'email',
      email,
      code,
      public_key: keyPair.publicKey,
    });
    
    localStorage.setItem('client_private_key', keyPair.privateKey);
    localStorage.setItem('session_token', response.data.session_token);
    
    return response.data;
  },

  // 密钥找回
  async recoverKey(email: string, code: string) {
    const response = await api.post('/auth/recover-key', {
      email,
      code,
    });
    return response.data;
  },

  // 获取当前用户信息
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data.user;
  },

  // 登出
  async logout() {
    await api.post('/auth/logout');
  },
};
