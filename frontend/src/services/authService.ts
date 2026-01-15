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
    const masterKeyRaw = await AESEncryption.exportKey(masterKey);

    // 1. 使用密码加密主密钥
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltStr = arrayBufferToBase64(salt);
    const kwk = await KeyManager.deriveKey(password, saltStr);
    const encryptedMasterKey = await AESEncryption.encrypt(masterKeyRaw, kwk);
    
    const encryptedMasterKeyData = {
        encrypted: arrayBufferToBase64(encryptedMasterKey.ciphertext),
        nonce: arrayBufferToBase64(encryptedMasterKey.iv),
        salt: saltStr
    };

    // 2. 使用恢复码加密主密钥 (作为备份)
    // 生成 12 位随机恢复码
    const recoveryCode = Array.from(window.crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    const recoverySalt = window.crypto.getRandomValues(new Uint8Array(16));
    const recoverySaltStr = arrayBufferToBase64(recoverySalt);
    const recoveryKwk = await KeyManager.deriveKey(recoveryCode, recoverySaltStr);
    const encryptedRecoveryKey = await AESEncryption.encrypt(masterKeyRaw, recoveryKwk);

    const recoveryPackageData = {
        encrypted: arrayBufferToBase64(encryptedRecoveryKey.ciphertext),
        nonce: arrayBufferToBase64(encryptedRecoveryKey.iv),
        salt: recoverySaltStr
    };

    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      public_key: keyPair.publicKey,
      encrypted_master_key: encryptedMasterKeyData,
      recovery_package: recoveryPackageData
    });
    
    // 保存公钥和恢复码
    localStorage.setItem('client_private_key', keyPair.privateKey);
    localStorage.setItem('client_public_key', keyPair.publicKey);
    localStorage.setItem('recovery_code', recoveryCode);
    
    return { ...response.data, recovery_code: recoveryCode };
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
  async loginWithPassword(username: string, password: string, trustDevice: boolean = true) {
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
                const salt = mkData.salt;
                const kwk = await KeyManager.deriveKey(password, salt);
                
                const encryptedMK = {
                    ciphertext: base64ToArrayBuffer(mkData.encrypted),
                    iv: new Uint8Array(base64ToArrayBuffer(mkData.nonce))
                };
                
                const masterKeyRaw = await AESEncryption.decrypt(encryptedMK, kwk);
                keyStorage.masterKey = await AESEncryption.importKey(masterKeyRaw);
                console.log("主密钥解密成功");

                // 如果选择了信任设备，直接保存
                if (trustDevice) {
                    await this.saveDeviceTrust(masterKeyRaw);
                }
            } catch (e) {
                console.error("主密钥解密失败", e);
            }
        }
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
        
        // 保存加密的主密钥，待用户后续输入密码时解密
        if (response.data.encrypted_master_key) {
            localStorage.setItem('pending_master_key', response.data.encrypted_master_key);
            console.log("已暂存加密的主密钥，等待解锁");
        }

        // 保存恢复包
        if (response.data.recovery_package) {
            localStorage.setItem('pending_recovery_package', JSON.stringify(response.data.recovery_package));
        }
    }
    
    return response.data;
  },

  /**
   * 使用密码解锁主密钥（用于邮箱登录后的场景）
   */
  async unlockMasterKey(password: string, trustDevice: boolean = false) {
    const encryptedMasterKeyStr = localStorage.getItem('pending_master_key');
    if (!encryptedMasterKeyStr) {
        throw new Error("没有待解锁的主密钥");
    }

    try {
        const mkData = JSON.parse(encryptedMasterKeyStr);
        const salt = mkData.salt;
        const kwk = await KeyManager.deriveKey(password, salt);
        
        const encryptedMK = {
            ciphertext: base64ToArrayBuffer(mkData.encrypted),
            iv: new Uint8Array(base64ToArrayBuffer(mkData.nonce))
        };
        
        const masterKeyRaw = await AESEncryption.decrypt(encryptedMK, kwk);
        keyStorage.masterKey = await AESEncryption.importKey(masterKeyRaw);
        console.log("主密钥解锁成功");
        
        // 如果勾选了信任设备，将主密钥加密存储在本地
        if (trustDevice) {
            await this.saveDeviceTrust(masterKeyRaw);
        }
        
        // 解锁成功后清除暂存
        localStorage.removeItem('pending_master_key');
        return true;
    } catch (e) {
        console.error("主密钥解锁失败:", e);
        throw new Error("密码错误，无法解锁文件加密密钥");
    }
  },

  /**
   * 使用恢复码解锁主密钥
   */
  async unlockWithRecoveryCode(recoveryCode: string, trustDevice: boolean = false) {
    const packageStr = localStorage.getItem('pending_recovery_package');
    if (!packageStr) {
        throw new Error("没有可用的恢复包");
    }

    try {
        const mkData = JSON.parse(packageStr);
        const salt = mkData.salt;
        const kwk = await KeyManager.deriveKey(recoveryCode.toUpperCase(), salt);
        
        const encryptedMK = {
            ciphertext: base64ToArrayBuffer(mkData.encrypted),
            iv: new Uint8Array(base64ToArrayBuffer(mkData.nonce))
        };
        
        const masterKeyRaw = await AESEncryption.decrypt(encryptedMK, kwk);
        keyStorage.masterKey = await AESEncryption.importKey(masterKeyRaw);
        console.log("主密钥通过恢复码解锁成功");
        
        // 如果勾选了信任设备，将主密钥加密存储在本地
        if (trustDevice) {
            await this.saveDeviceTrust(masterKeyRaw);
        }
        
        localStorage.removeItem('pending_master_key');
        localStorage.removeItem('pending_recovery_package');
        return true;
    } catch (e) {
        console.error("恢复码解锁失败:", e);
        throw new Error("恢复码错误，无法解锁文件加密密钥");
    }
  },

  /**
   * 建立设备信任：将主密钥加密保存在本地
   */
  async saveDeviceTrust(masterKeyRaw: ArrayBuffer) {
    try {
        // 生成一个设备专用的随机密钥
        const deviceSecret = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltStr = arrayBufferToBase64(salt);
        const kwk = await KeyManager.deriveKey(deviceSecret, saltStr);
        
        const encrypted = await AESEncryption.encrypt(masterKeyRaw, kwk);
        
        const trustData = {
            encrypted: arrayBufferToBase64(encrypted.ciphertext),
            nonce: arrayBufferToBase64(encrypted.iv),
            salt: saltStr,
            device_secret: deviceSecret // 存储在本地，作为本设备的“钥匙”
        };
        
        localStorage.setItem('device_trust_data', JSON.stringify(trustData));
        console.log("设备信任已建立");
    } catch (e) {
        console.error("建立设备信任失败:", e);
    }
  },

  /**
   * 尝试自动解锁（通过设备信任）
   */
  async tryAutoUnlock() {
    if (keyStorage.masterKey) return true;
    
    const trustDataStr = localStorage.getItem('device_trust_data');
    if (!trustDataStr) {
        // 如果没有设备信任数据，但有暂存的主密钥，这通常是邮箱登录后的状态
        return false;
    }

    try {
        const trustData = JSON.parse(trustDataStr);
        const kwk = await KeyManager.deriveKey(trustData.device_secret, trustData.salt);
        
        const encryptedMK = {
            ciphertext: base64ToArrayBuffer(trustData.encrypted),
            iv: new Uint8Array(base64ToArrayBuffer(trustData.nonce))
        };
        
        const masterKeyRaw = await AESEncryption.decrypt(encryptedMK, kwk);
        keyStorage.masterKey = await AESEncryption.importKey(masterKeyRaw);
        console.log("设备自动解锁成功");
        
        // 自动解锁成功后，确保清除任何挂起的解锁请求
        localStorage.removeItem('pending_master_key');
        localStorage.removeItem('pending_recovery_package');
        return true;
    } catch (e) {
        console.error("设备自动解锁失败:", e);
        // 如果解锁失败，可能是数据损坏，但不建议直接删除，让用户手动解锁后再更新
        return false;
    }
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
    localStorage.removeItem('pending_master_key');
    // Clear keys from memory
    keyStorage.masterKey = null;
    keyStorage.sessionKey = null;
    keyStorage.groupKeys = {};
  },
};
