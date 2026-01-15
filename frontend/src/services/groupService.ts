import axios from 'axios';
import { AESEncryption, RSAEncryption, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/crypto';
import { keyStorage } from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    if (error.message === 'Network Error') {
      console.error('网络错误：无法连接到后端服务器，请确保后端正在运行在 http://localhost:5000');
    }
    return Promise.reject(error);
  }
);

export const groupService = {
  // 获取用户组列表
  async getGroupList() {
    const response = await api.get('/groups/list');
    return response.data.groups;
  },

  // 获取所有组列表（包含创建者信息和已加入状态）
  async getAllGroups() {
    const response = await api.get('/groups/all');
    return response.data.groups;
  },

  // 创建用户组
  async createGroup(name: string, description?: string) {
    if (!keyStorage.masterKey) {
        throw new Error("密钥未初始化，请重新登录");
    }

    // 1. 生成组密钥 (AES-GCM)
    const groupKey = await AESEncryption.generateKey();
    const groupKeyRaw = await AESEncryption.exportKey(groupKey);

    // 2. 使用主密钥加密组密钥 (为自己备份)
    const encryptedGroupKey = await AESEncryption.encrypt(groupKeyRaw, keyStorage.masterKey);
    const encryptedGroupKeyData = {
        encrypted: arrayBufferToBase64(encryptedGroupKey.ciphertext),
        nonce: arrayBufferToBase64(encryptedGroupKey.iv)
    };

    // 3. 发送请求
    const response = await api.post('/groups/create', {
      name,
      description,
      encrypted_group_key: encryptedGroupKeyData
    });

    // 缓存组密钥
    if (!keyStorage.groupKeys) keyStorage.groupKeys = {};
    keyStorage.groupKeys[response.data.group.id] = groupKey;

    return response.data.group;
  },

  // 获取并解密组密钥
  async getGroupKey(groupId: number): Promise<CryptoKey> {
    // 检查缓存
    if (keyStorage.groupKeys && keyStorage.groupKeys[groupId]) {
        return keyStorage.groupKeys[groupId];
    }

    if (!keyStorage.masterKey) {
        throw new Error("密钥未初始化，请重新登录");
    }

    const response = await api.get(`/groups/${groupId}/key`);
    const encryptedData = response.data.encrypted_key;

    let groupKey: CryptoKey;

    // 尝试解密。组密钥可能以两种方式存储：
    // 1. AES加密 (自己创建组时，用主密钥加密存的)
    // 2. RSA加密 (别人分享给我时，用我的RSA公钥加密的)
    
    if (encryptedData.nonce) {
        // AES 加密格式
        const encrypted = {
            ciphertext: base64ToArrayBuffer(encryptedData.encrypted),
            iv: new Uint8Array(base64ToArrayBuffer(encryptedData.nonce))
        };
        const rawKey = await AESEncryption.decrypt(encrypted, keyStorage.masterKey);
        groupKey = await AESEncryption.importKey(rawKey);
    } else {
         // RSA 加密格式
         const privateKeyPem = localStorage.getItem('client_private_key');
         if (!privateKeyPem) throw new Error("缺少本地私钥，无法解密共享密钥");
         
         // RSAEncryption.decryptBinary 接受 base64 字符串作为输入
         const rawKey = await RSAEncryption.decryptBinary(encryptedData, privateKeyPem);
         groupKey = await AESEncryption.importKey(rawKey);

         // 为了下次快速访问，建议将其重新用 MasterKey 加密并存回服务器 (可选优化)
     }

    if (!keyStorage.groupKeys) keyStorage.groupKeys = {};
    keyStorage.groupKeys[groupId] = groupKey;
    return groupKey;
  },

  // 共享组密钥给新成员 (由管理员调用)
   async shareGroupKey(groupId: number, targetUserId: number, targetPublicKey: string) {
     const groupKey = await this.getGroupKey(groupId);
     const groupKeyRaw = await AESEncryption.exportKey(groupKey);
 
     // 使用接收者的 RSA 公钥加密
     const encryptedKeyBase64 = await RSAEncryption.encrypt(groupKeyRaw, targetPublicKey);
 
     await api.post('/groups/share-key', {
         group_id: groupId,
         user_id: targetUserId,
         encrypted_key: encryptedKeyBase64
     });
   },

  // 加入用户组（创建申请）
  async joinGroup(groupId: number, message?: string) {
    const response = await api.post('/groups/join', {
      group_id: groupId,
      message: message,
    });
    return response.data;
  },

  // 获取组成员
  async getGroupMembers(groupId: number) {
    const response = await api.get(`/groups/${groupId}/members`);
    return response.data.members;
  },

  // 获取用户组的加入申请
  async getGroupRequests() {
    const response = await api.get('/groups/requests');
    return response.data.requests;
  },

  // 批准加入申请
  async approveJoinRequest(requestId: number) {
    const response = await api.post(`/groups/requests/${requestId}/approve`);
    return response.data;
  },

  // 拒绝加入申请
  async rejectJoinRequest(requestId: number) {
    const response = await api.post(`/groups/requests/${requestId}/reject`);
    return response.data;
  },
};
