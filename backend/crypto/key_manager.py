"""
密钥管理模块
管理主密钥、文件密钥、会话密钥等
"""
from .aes import AESEncryption
from .rsa import RSAEncryption
import os
import base64
import json

class KeyManager:
    """密钥管理器"""
    
    @staticmethod
    def generate_master_key():
        """生成主密钥"""
        return AESEncryption.generate_key()
    
    @staticmethod
    def encrypt_master_key(master_key: bytes, password: str) -> dict:
        """
        使用密码加密主密钥
        
        Args:
            master_key: 主密钥
            password: 用户密码
        
        Returns:
            dict: {
                'encrypted_key': base64编码的加密密钥,
                'salt': base64编码的盐值
            }
        """
        derived_key, salt = AESEncryption.derive_key_from_password(password)
        encrypted = AESEncryption.encrypt(master_key, derived_key)
        
        return {
            'encrypted_key': encrypted['ciphertext'],
            'nonce': encrypted['nonce'],
            'salt': base64.b64encode(salt).decode('utf-8')
        }
    
    @staticmethod
    def decrypt_master_key(encrypted_data: dict, password: str) -> bytes:
        """
        使用密码解密主密钥
        
        Args:
            encrypted_data: {
                'encrypted_key': base64编码的加密密钥,
                'nonce': base64编码的随机数,
                'salt': base64编码的盐值
            }
            password: 用户密码
        
        Returns:
            bytes: 解密后的主密钥
        """
        salt = base64.b64decode(encrypted_data['salt'])
        derived_key, _ = AESEncryption.derive_key_from_password(password, salt)
        
        encrypted_key_data = {
            'ciphertext': encrypted_data['encrypted_key'],
            'nonce': encrypted_data['nonce']
        }
        
        return AESEncryption.decrypt(encrypted_key_data, derived_key)
    
    @staticmethod
    def generate_file_key():
        """生成文件密钥"""
        return AESEncryption.generate_key()
    
    @staticmethod
    def encrypt_file_key(file_key: bytes, master_key: bytes) -> str:
        """
        使用主密钥加密文件密钥
        
        Args:
            file_key: 文件密钥
            master_key: 主密钥
        
        Returns:
            str: JSON字符串，包含加密的文件密钥
        """
        encrypted = AESEncryption.encrypt(file_key, master_key)
        return json.dumps(encrypted)
    
    @staticmethod
    def decrypt_file_key(encrypted_file_key: str, master_key: bytes) -> bytes:
        """
        使用主密钥解密文件密钥
        
        Args:
            encrypted_file_key: JSON字符串，包含加密的文件密钥
            master_key: 主密钥
        
        Returns:
            bytes: 解密后的文件密钥
        """
        encrypted_data = json.loads(encrypted_file_key)
        return AESEncryption.decrypt(encrypted_data, master_key)
    
    @staticmethod
    def generate_session_key():
        """生成会话密钥（一次一密）"""
        return AESEncryption.generate_key()
    
    @staticmethod
    def create_recovery_package(master_key: bytes, recovery_code: str) -> dict:
        """
        创建密钥恢复包
        
        Args:
            master_key: 主密钥
            recovery_code: 恢复码（邮箱验证码）
        
        Returns:
            dict: 恢复包数据
        """
        # 使用恢复码派生密钥加密主密钥
        recovery_key, salt = AESEncryption.derive_key_from_password(recovery_code)
        encrypted = AESEncryption.encrypt(master_key, recovery_key)
        
        return {
            'encrypted_key': encrypted['ciphertext'],
            'nonce': encrypted['nonce'],
            'salt': base64.b64encode(salt).decode('utf-8')
        }
    
    @staticmethod
    def recover_master_key(recovery_package: dict, recovery_code: str) -> bytes:
        """
        从恢复包恢复主密钥
        
        Args:
            recovery_package: 恢复包数据
            recovery_code: 恢复码
        
        Returns:
            bytes: 恢复的主密钥
        """
        salt = base64.b64decode(recovery_package['salt'])
        recovery_key, _ = AESEncryption.derive_key_from_password(recovery_code, salt)
        
        encrypted_key_data = {
            'ciphertext': recovery_package['encrypted_key'],
            'nonce': recovery_package['nonce']
        }
        
        return AESEncryption.decrypt(encrypted_key_data, recovery_key)
    
    @staticmethod
    def share_key_to_user(file_key: bytes, user_public_key: str) -> str:
        """
        使用用户公钥加密密钥，用于用户组共享
        
        Args:
            file_key: 要共享的文件密钥
            user_public_key: 接收用户的RSA公钥
        
        Returns:
            str: base64编码的加密密钥
        """
        return RSAEncryption.encrypt(file_key, user_public_key)
    
    @staticmethod
    def receive_shared_key(encrypted_key: str, user_private_key: str) -> bytes:
        """
        使用用户私钥解密共享的密钥
        
        Args:
            encrypted_key: base64编码的加密密钥
            user_private_key: 用户的RSA私钥
        
        Returns:
            bytes: 解密后的文件密钥
        """
        return RSAEncryption.decrypt(encrypted_key, user_private_key)
