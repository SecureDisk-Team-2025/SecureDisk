import axios from 'axios';
import { AESEncryption, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/crypto';
import { keyStorage } from './authService';
import { groupService } from './groupService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  console.log('发送请求:', config.method?.toUpperCase(), config.url);
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('请求超时');
    } else if (error.message === 'Network Error') {
      console.error('网络错误：无法连接到后端服务器，请确保后端正在运行在 http://localhost:5000');
    }
    return Promise.reject(error);
  }
);

export const fileService = {
  // 获取文件列表
  async getFileList(groupId?: number, keyword?: string) {
    const params: any = {};
    if (groupId) {
      params.group_id = groupId;
    }
    if (keyword) {
      params.keyword = keyword;
    }
    const response = await api.get('/files/list', { params });
    return response.data.files;
  },

  // 上传文件
  async uploadFile(file: File, groupId?: number) {
    if (!keyStorage.sessionKey) {
        throw new Error("会话密钥未初始化，请重新登录");
    }

    if (!keyStorage.masterKey) {
        if (localStorage.getItem('pending_master_key')) {
            throw new Error("NEED_UNLOCK:文件加密密钥尚未解锁，请输入密码解锁以继续操作");
        }
        throw new Error("加密密钥缺失，请重新登录");
    }

    // 1. 生成文件密钥
    const fileKey = await AESEncryption.generateKey();

    // 2. 读取文件内容
    const fileBuffer = await file.arrayBuffer();

    // 3. 第一层加密：使用文件密钥加密（端到端加密，服务器不可见）
    const layer1 = await AESEncryption.encrypt(fileBuffer, fileKey);
    // Combine IV and Ciphertext for storage: IV(12) + Ciphertext
    const layer1Data = new Uint8Array(layer1.iv.byteLength + layer1.ciphertext.byteLength);
    layer1Data.set(layer1.iv, 0);
    layer1Data.set(new Uint8Array(layer1.ciphertext), layer1.iv.byteLength);

    // 4. 第二层加密：使用会话密钥加密（传输层加密）
    const layer2 = await AESEncryption.encrypt(layer1Data, keyStorage.sessionKey!);
    // Combine IV and Ciphertext for transmission: IV(12) + Ciphertext
    const layer2Data = new Uint8Array(layer2.iv.byteLength + layer2.ciphertext.byteLength);
    layer2Data.set(layer2.iv, 0);
    layer2Data.set(new Uint8Array(layer2.ciphertext), layer2.iv.byteLength);

    // 5. 加密文件密钥
    const fileKeyRaw = await AESEncryption.exportKey(fileKey);
    
    let encryptionKey: CryptoKey;
    if (groupId) {
        // 如果是上传到组，使用组密钥加密文件密钥
        encryptionKey = await groupService.getGroupKey(groupId);
    } else {
        // 否则使用用户主密钥
        encryptionKey = keyStorage.masterKey!;
    }

    const encryptedFileKey = await AESEncryption.encrypt(fileKeyRaw, encryptionKey);
    const encryptedFileKeyJson = JSON.stringify({
        encrypted: arrayBufferToBase64(encryptedFileKey.ciphertext),
        nonce: arrayBufferToBase64(encryptedFileKey.iv)
    });

    // 6. 构造上传数据
    const formData = new FormData();
    // 使用Blob包装加密后的数据
    const encryptedBlob = new Blob([layer2Data], { type: 'application/octet-stream' });
    formData.append('file', encryptedBlob, file.name); // 保留原文件名
    formData.append('encrypted_file_key', encryptedFileKeyJson);
    
    if (groupId) {
      formData.append('group_id', groupId.toString());
    }

    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 下载文件
  async downloadFile(fileId: number, filename: string) {
    if (!keyStorage.sessionKey) {
        throw new Error("会话密钥未初始化，请重新登录");
    }

    if (!keyStorage.masterKey) {
        if (localStorage.getItem('pending_master_key')) {
            throw new Error("NEED_UNLOCK:文件解密密钥尚未解锁，请输入密码解锁以继续下载");
        }
        throw new Error("加密密钥缺失，请重新登录");
    }

    const response = await api.get(`/files/download/${fileId}`, {
      responseType: 'arraybuffer',
    });
    
    // 1. 获取加密的文件密钥
    const encryptedFileKeyHeader = response.headers['x-encrypted-file-key'];
    if (!encryptedFileKeyHeader) {
        throw new Error("服务器未返回文件密钥");
    }
    const encryptedFileKeyData = JSON.parse(encryptedFileKeyHeader);
    const encryptedFileKey = {
        ciphertext: base64ToArrayBuffer(encryptedFileKeyData.encrypted),
        iv: new Uint8Array(base64ToArrayBuffer(encryptedFileKeyData.nonce))
    };

    // 2. 解密文件密钥
    const fileGroupIdHeader = response.headers['x-file-group-id'];
    let decryptionKey: CryptoKey;
    
    if (fileGroupIdHeader) {
        // 如果文件属于组，使用组密钥解密
        decryptionKey = await groupService.getGroupKey(parseInt(fileGroupIdHeader));
    } else {
        // 否则使用用户主密钥
        decryptionKey = keyStorage.masterKey!;
    }

    const fileKeyRaw = await AESEncryption.decrypt(encryptedFileKey, decryptionKey);
    const fileKey = await AESEncryption.importKey(fileKeyRaw);

    // 3. 解密传输层 (Layer 2) -> Layer 1
    const layer2Data = new Uint8Array(response.data);
    const layer2Iv = layer2Data.slice(0, 12);
    const layer2Ciphertext = layer2Data.slice(12);
    
    const layer1DataRaw = await AESEncryption.decrypt(
        { ciphertext: layer2Ciphertext, iv: layer2Iv },
        keyStorage.sessionKey!
    );
    
    // 4. 解密端到端层 (Layer 1) -> Plaintext
    const layer1Data = new Uint8Array(layer1DataRaw);
    const layer1Iv = layer1Data.slice(0, 12);
    const layer1Ciphertext = layer1Data.slice(12);

    const plaintext = await AESEncryption.decrypt(
        { ciphertext: layer1Ciphertext, iv: layer1Iv },
        fileKey
    );

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([plaintext]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // 删除文件
  async deleteFile(fileId: number) {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },

  // 预览文件
  async previewFile(fileId: number, filename: string) {
    if (!keyStorage.sessionKey) {
        throw new Error("会话密钥未初始化，请重新登录");
    }

    if (!keyStorage.masterKey) {
        if (localStorage.getItem('pending_master_key')) {
            throw new Error("NEED_UNLOCK:文件解密密钥尚未解锁，请输入密码解锁以继续预览");
        }
        throw new Error("加密密钥缺失，请重新登录");
    }

    const response = await api.get(`/files/download/${fileId}`, {
      params: { preview: true },
      responseType: 'arraybuffer',
    });

    // 1. 获取加密的文件密钥
    const encryptedFileKeyHeader = response.headers['x-encrypted-file-key'];
    if (!encryptedFileKeyHeader) {
        throw new Error("服务器未返回文件密钥");
    }
    const encryptedFileKeyData = JSON.parse(encryptedFileKeyHeader);
    const encryptedFileKey = {
        ciphertext: base64ToArrayBuffer(encryptedFileKeyData.encrypted),
        iv: new Uint8Array(base64ToArrayBuffer(encryptedFileKeyData.nonce))
    };

    // 2. 解密文件密钥
    const fileGroupIdHeader = response.headers['x-file-group-id'];
    let decryptionKey: CryptoKey;
    
    if (fileGroupIdHeader) {
        // 如果文件属于组，使用组密钥解密
        decryptionKey = await groupService.getGroupKey(parseInt(fileGroupIdHeader));
    } else {
        // 否则使用用户主密钥
        decryptionKey = keyStorage.masterKey!;
    }

    const fileKeyRaw = await AESEncryption.decrypt(encryptedFileKey, decryptionKey);
    const fileKey = await AESEncryption.importKey(fileKeyRaw);

    // 3. 解密传输层 (Layer 2) -> Layer 1
    const layer2Data = new Uint8Array(response.data);
    const layer2Iv = layer2Data.slice(0, 12);
    const layer2Ciphertext = layer2Data.slice(12);
    
    const layer1DataRaw = await AESEncryption.decrypt(
        { ciphertext: layer2Ciphertext, iv: layer2Iv },
        keyStorage.sessionKey!
    );
    
    // 4. 解密端到端层 (Layer 1) -> Plaintext
    const layer1Data = new Uint8Array(layer1DataRaw);
    const layer1Iv = layer1Data.slice(0, 12);
    const layer1Ciphertext = layer1Data.slice(12);

    const plaintext = await AESEncryption.decrypt(
        { ciphertext: layer1Ciphertext, iv: layer1Iv },
        fileKey
    );
    
    // 获取文件扩展名
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    // 分类文件类型
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    const pdfExtensions = ['.pdf'];
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp'];
    
    let fileType = 'other';
    let mimeType = 'application/octet-stream';
    
    if (imageExtensions.includes(ext)) {
      fileType = 'image';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.bmp') mimeType = 'image/bmp';
    } else if (pdfExtensions.includes(ext)) {
      fileType = 'pdf';
      mimeType = 'application/pdf';
    } else if (textExtensions.includes(ext)) {
      fileType = 'text';
      mimeType = 'text/plain';
    }
    
    // 根据文件类型处理内容
    if (fileType === 'text') {
        const textDecoder = new TextDecoder();
        return {
          type: fileType,
          content: textDecoder.decode(plaintext)
        };
    }
    
    // 对于图片、PDF和其他类型，返回blob URL
    return {
      type: fileType,
      content: window.URL.createObjectURL(new Blob([plaintext], { type: mimeType }))
    };
  },
};
