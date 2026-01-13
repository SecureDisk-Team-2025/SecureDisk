/**
 * 客户端加密工具
 * 注意：这里使用Web Crypto API实现，不使用SSL/TLS
 */

// RSA加密实现（使用Web Crypto API）
export const RSAEncryption = {
  async generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
    // 使用Web Crypto API生成密钥对
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    // 导出公钥
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);
    const publicKeyPEM = formatPEM(publicKeyBase64, 'PUBLIC KEY');

    // 导出私钥
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer);
    const privateKeyPEM = formatPEM(privateKeyBase64, 'PRIVATE KEY');

    // 保存密钥对象供后续使用
    (window as any).__cryptoKeyPair = keyPair;

    return {
      privateKey: privateKeyPEM,
      publicKey: publicKeyPEM,
    };
  },

  async encrypt(data: string, publicKeyPEM: string): Promise<string> {
    try {
      // 解析PEM格式的公钥
      const publicKeyBuffer = parsePEM(publicKeyPEM);
      const publicKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      );

      // 加密数据
      const dataBuffer = new TextEncoder().encode(data);
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        publicKey,
        dataBuffer
      );

      return arrayBufferToBase64(encryptedBuffer);
    } catch (error) {
      console.error('RSA加密失败:', error);
      // 降级处理：返回base64编码
      return btoa(data);
    }
  },

  async decrypt(encryptedData: string, privateKeyPEM: string): Promise<string> {
    try {
      // 解析PEM格式的私钥
      const privateKeyBuffer = parsePEM(privateKeyPEM);
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['decrypt']
      );

      // 解密数据
      const encryptedBuffer = base64ToArrayBuffer(encryptedData);
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        privateKey,
        encryptedBuffer
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('RSA解密失败:', error);
      // 降级处理
      return atob(encryptedData);
    }
  },
};

// AES加密实现
export const AESEncryption = {
  async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(data: ArrayBuffer, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      data
    );
    return { ciphertext, iv };
  },

  async decrypt(encryptedData: { ciphertext: ArrayBuffer; iv: Uint8Array }, key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encryptedData.iv.buffer as ArrayBuffer,
      },
      key,
      encryptedData.ciphertext
    );
  },
};

// 工具函数
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function formatPEM(base64: string, type: string): string {
  const lines = [];
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64));
  }
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

function parsePEM(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s/g, '');
  return base64ToArrayBuffer(base64);
}
