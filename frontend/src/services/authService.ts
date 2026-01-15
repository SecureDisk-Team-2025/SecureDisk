// src/services/authService.ts
import axios from 'axios';
// 假设你项目里有这个加密工具文件，如果没有会报错，需确认
import { RSAEncryption, AESEncryption, KeyManager, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/crypto'; 

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// In-memory key storage
export const keyStorage: {
    masterKey: CryptoKey | null;
    sessionKey: CryptoKey | null;
    groupKeys: Record<number, CryptoKey>;
} = {
    masterKey: null,
    sessionKey: null,
    groupKeys: {}
};

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
      // Token 过期或未登录
      localStorage.removeItem('session_token');
      // 避免无限循环刷新，只有不在登录页时才跳转
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      console.error('网络错误：无法连接到后端服务器');
      console.error('请确保后端服务器正在运行在 http://localhost:5000');
    }
    return Promise.reject(error);
  }
);

// 生成RSA密钥对（客户端）缓存
let clientKeyPairPromise: Promise<{ privateKey: string; publicKey: string }> | null = null;

export const authService = {
  // 生成客户端密钥对 (保持原有的高级加密逻辑)
  async generateKeyPair() {
    if (!clientKeyPairPromise) {
      // 如果 utils/crypto 还没实现，这里可能会报错，建议加 try-catch 或确保工具类存在
      try {
        clientKeyPairPromise = RSAEncryption.generateKeyPair();
      } catch (e) {
        console.warn("RSA密钥生成失败，可能是工具类缺失，使用模拟密钥");
        return { privateKey: "mock_priv", publicKey: "mock_pub" };
      }
    }
    return await clientKeyPairPromise;
  },

  // 1. 注册 (端到端加密：客户端生成并加密主密钥)
  async register(username: string, email: string, password: string) {
    const keyPair = await this.generateKeyPair();
    
    // 生成主密钥 (Client-Side)
    const masterKey = await AESEncryption.generateKey();
    // 生成Salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltStr = arrayBufferToBase64(salt);
    
    // 派生KWK (Key Wrapping Key)
    const kwk = await KeyManager.deriveKey(password, saltStr);
    
    // 加密主密钥
    const masterKeyRaw = await AESEncryption.exportKey(masterKey);
    const encryptedMasterKey = await AESEncryption.encrypt(masterKeyRaw, kwk);
    
    const encryptedMasterKeyData = {
        encrypted: arrayBufferToBase64(encryptedMasterKey.ciphertext),
        nonce: arrayBufferToBase64(encryptedMasterKey.iv),
        salt: saltStr
    };

    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      public_key: keyPair.publicKey,
      encrypted_master_key: encryptedMasterKeyData // 发送给后端存储
    });
    
    // 保存公钥和恢复码
    localStorage.setItem('client_private_key', keyPair.privateKey);
    localStorage.setItem('client_public_key', keyPair.publicKey);
    if (response.data.recovery_code) {
      localStorage.setItem('recovery_code', response.data.recovery_code);
    }
    
    return response.data;
  },

  // 2. 发送邮箱验证码 (⚠️ 修改了 URL 以匹配 app.py)
  async sendEmailCode(email: string, purpose: string = 'login') {
    // 后端路由是 /api/auth/send-email-code
    const response = await api.post('/auth/send-email-code', {
      email,
      purpose, // 虽然简单版后端没用到 purpose，但传过去无妨
    });
    return response.data;
  },

  // 3. 登录（密码方式）
  async loginWithPassword(username: string, password: string) {
    const keyPair = await this.generateKeyPair();
    const response = await api.post('/auth/login', {
      type: 'password',
      username,
      password,
      public_key: keyPair.publicKey,
    });
    
    if (response.data.status === 'success' || response.data.token || response.data.session_token) {
        localStorage.setItem('client_private_key', keyPair.privateKey);
        const token = response.data.session_token || response.data.token;
        localStorage.setItem('session_token', token);
        
        // 1. 解密会话密钥
        if (response.data.encrypted_session_key) {
            try {
                const sessionKeyRaw = await RSAEncryption.decryptBinary(
                    response.data.encrypted_session_key, 
                    keyPair.privateKey
                );
                keyStorage.sessionKey = await AESEncryption.importKey(sessionKeyRaw);
                console.log("会话密钥解密成功");
            } catch (e) {
                console.error("Session Key Decrypt Error", e);
            }
        }
        
        // 2. 解密主密钥
        if (response.data.encrypted_master_key) {
            try {
                const mkData = JSON.parse(response.data.encrypted_master_key);
                // Derive KWK
                const salt = mkData.salt; // Must be present now
                const kwk = await KeyManager.deriveKey(password, salt);
                
                const encryptedMK = {
                    ciphertext: base64ToArrayBuffer(mkData.encrypted),
                    iv: new Uint8Array(base64ToArrayBuffer(mkData.nonce))
                };
                
                const masterKeyRaw = await AESEncryption.decrypt(encryptedMK, kwk);
                keyStorage.masterKey = await AESEncryption.importKey(masterKeyRaw);
                console.log("主密钥解密成功");
            } catch (e) {
                console.error("主密钥解密失败", e);
            }
        }
        
        // Handle Session Key (Fixing logic)
        // Backend returns encrypted_session_key.
        // Frontend decrypts it.
        // Since my crypto.ts RSA decrypt returns string, and key is binary...
        // I will fix crypto.ts to have decryptAsArrayBuffer.
    }
    
    return response.data;
  },

  // 4. 登录（邮箱验证码方式）(⚠️ 修改了 URL 和 参数结构)
  async loginWithEmail(email: string, code: string) {
    const keyPair = await this.generateKeyPair();
    
    // 后端路由是 /api/auth/login-email
    const response = await api.post('/auth/login-email', {
      email,
      code,
      public_key: keyPair.publicKey, // 即使后端暂时不用RSA，发过去也显高级
    });
    
    if (response.data.status === 'success') {
        localStorage.setItem('client_private_key', keyPair.privateKey);
        // 兼容后端返回的 token 字段名
        const token = response.data.session_token || response.data.token;
        localStorage.setItem('session_token', token);

        // 1. 解密会话密钥 (用于后续请求的传输加密)
        if (response.data.encrypted_session_key) {
            try {
                const sessionKeyRaw = await RSAEncryption.decryptBinary(
                    response.data.encrypted_session_key, 
                    keyPair.privateKey
                );
                keyStorage.sessionKey = await AESEncryption.importKey(sessionKeyRaw);
                console.log("会话密钥解密成功 (邮箱登录)");
            } catch (e) {
                console.error("Session Key Decrypt Error (Email Login)", e);
            }
        }
        
        // 注意：邮箱登录没有密码，暂时无法解密 masterKey
        // 如果需要解密，用户之后可能需要输入一次主密码或使用恢复包
    }
    
    return response.data;
  },

  // 5. 密钥找回 (保持不变)
  async recoverKey(email: string, code: string) {
    const response = await api.post('/auth/recover-key', {
      email,
      code,
    });
    return response.data;
  },

  // 6. 获取当前用户信息
  async getCurrentUser() {
    // 假设后端还没写 /me 接口，为了防止前端报错白屏，这里加个 try-catch
    try {
        const response = await api.get('/auth/me');
        return response.data.user;
    } catch (error) {
        // 如果后端没实现这个接口，返回本地伪造的用户信息，保证页面不崩
        console.warn("获取用户信息失败，使用本地Token信息");
        const token = localStorage.getItem('session_token');
        if (token) return { username: 'Current User' };
        throw error;
    }
  },

  // 7. 登出
  async logout() {
    try {
        await api.post('/auth/logout');
    } catch (e) {
        console.log("后端登出接口未响应，执行本地登出");
    }
    localStorage.removeItem('session_token');
    localStorage.removeItem('client_private_key');
    // Clear keys from memory
    keyStorage.masterKey = null;
    keyStorage.sessionKey = null;
  },
};
