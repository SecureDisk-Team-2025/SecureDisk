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

  async encrypt(data: string | BufferSource, publicKeyPEM: string): Promise<string> {
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
      const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
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
      // 降级处理
      return typeof data === 'string' ? btoa(data) : arrayBufferToBase64(data);
    }
  },

  async decrypt(encryptedData: string, privateKeyPEM: string): Promise<string> {
    try {
      const decryptedBuffer = await this.decryptBinary(encryptedData, privateKeyPEM);
      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('RSA解密失败:', error);
      // 降级处理
      try {
        return atob(encryptedData);
      } catch (e) {
        return encryptedData;
      }
    }
  },

  async decryptBinary(encryptedData: string, privateKeyPEM: string): Promise<ArrayBuffer> {
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
      return await crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        privateKey,
        encryptedBuffer
      );
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

  async encrypt(data: any, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );
    return { ciphertext: ciphertext as ArrayBuffer, iv };
  },

  async decrypt(encryptedData: { ciphertext: any; iv: any }, key: CryptoKey): Promise<ArrayBuffer> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encryptedData.iv,
      },
      key,
      encryptedData.ciphertext
    );
    return decrypted as ArrayBuffer;
  },

  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
  },

  async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  },
};

export const KeyManager = {
    async generateSessionKey(): Promise<CryptoKey> {
        return await AESEncryption.generateKey();
    },
    
    async deriveKey(password: string, salt: string): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );
        return await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: enc.encode(salt),
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );
    }
};

// 工具函数
/**
 * 将 ArrayBuffer 或 TypedArray 转换为 Base64 字符串
 * 使用 any 类型以绕过 TypeScript 对 SharedArrayBuffer 的严格检查
 */
export function arrayBufferToBase64(buffer: any): string {
  let bytes: Uint8Array;
  if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else if (buffer && buffer.buffer && (buffer.buffer instanceof ArrayBuffer || buffer.buffer instanceof SharedArrayBuffer)) {
    // 处理其他 TypedArray 或 DataView
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    // 最后的尝试：如果是类似数组的对象
    bytes = new Uint8Array(buffer);
  }
  
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
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
