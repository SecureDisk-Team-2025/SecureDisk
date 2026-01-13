"""
AES加密实现
使用AES-256-GCM模式，提供加密和完整性验证
"""
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import os
import base64

class AESEncryption:
    """AES-256-GCM加密类"""
    
    @staticmethod
    def generate_key():
        """生成32字节（256位）的AES密钥"""
        return os.urandom(32)
    
    @staticmethod
    def derive_key_from_password(password: str, salt: bytes = None):
        """从密码派生密钥（PBKDF2）"""
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = kdf.derive(password.encode('utf-8'))
        return key, salt
    
    @staticmethod
    def encrypt(data: bytes, key: bytes) -> dict:
        """
        加密数据
        
        Args:
            data: 要加密的数据
            key: AES密钥（32字节）
        
        Returns:
            dict: {
                'ciphertext': base64编码的密文,
                'nonce': base64编码的随机数,
                'tag': base64编码的认证标签
            }
        """
        if len(key) != 32:
            raise ValueError("密钥必须是32字节")
        
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)  # GCM推荐12字节nonce
        ciphertext = aesgcm.encrypt(nonce, data, None)
        
        # GCM模式下，tag包含在ciphertext的最后16字节
        return {
            'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
            'nonce': base64.b64encode(nonce).decode('utf-8')
        }
    
    @staticmethod
    def decrypt(encrypted_data: dict, key: bytes) -> bytes:
        """
        解密数据
        
        Args:
            encrypted_data: {
                'ciphertext': base64编码的密文,
                'nonce': base64编码的随机数
            }
            key: AES密钥（32字节）
        
        Returns:
            bytes: 解密后的原始数据
        """
        if len(key) != 32:
            raise ValueError("密钥必须是32字节")
        
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        nonce = base64.b64decode(encrypted_data['nonce'])
        
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext
    
    @staticmethod
    def encrypt_file(file_path: str, key: bytes, output_path: str = None):
        """
        加密文件
        
        Args:
            file_path: 原始文件路径
            key: AES密钥
            output_path: 输出文件路径（可选）
        
        Returns:
            str: 加密后的文件路径
        """
        if output_path is None:
            output_path = file_path + '.enc'
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        encrypted = AESEncryption.encrypt(data, key)
        
        # 将加密数据写入文件
        with open(output_path, 'wb') as f:
            f.write(base64.b64decode(encrypted['ciphertext']))
            f.write(b'|||')  # 分隔符
            f.write(base64.b64decode(encrypted['nonce']))
        
        return output_path
    
    @staticmethod
    def decrypt_file(encrypted_path: str, key: bytes, output_path: str = None):
        """
        解密文件
        
        Args:
            encrypted_path: 加密文件路径
            key: AES密钥
            output_path: 输出文件路径（可选）
        
        Returns:
            str: 解密后的文件路径
        """
        if output_path is None:
            output_path = encrypted_path.replace('.enc', '')
        
        with open(encrypted_path, 'rb') as f:
            content = f.read()
        
        # 分离密文和nonce
        parts = content.split(b'|||')
        if len(parts) != 2:
            raise ValueError("无效的加密文件格式")
        
        ciphertext_b64 = base64.b64encode(parts[0]).decode('utf-8')
        nonce_b64 = base64.b64encode(parts[1]).decode('utf-8')
        
        encrypted_data = {
            'ciphertext': ciphertext_b64,
            'nonce': nonce_b64
        }
        
        plaintext = AESEncryption.decrypt(encrypted_data, key)
        
        with open(output_path, 'wb') as f:
            f.write(plaintext)
        
        return output_path
