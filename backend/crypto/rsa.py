"""
RSA加密实现
用于密钥交换和会话密钥加密传输
"""
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
import base64

class RSAEncryption:
    """RSA加密类"""
    
    @staticmethod
    def generate_key_pair():
        """
        生成RSA密钥对
        
        Returns:
            tuple: (private_key, public_key) 都是PEM格式字符串
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return private_pem.decode('utf-8'), public_pem.decode('utf-8')
    
    @staticmethod
    def load_private_key(private_key_pem: str):
        """从PEM字符串加载私钥"""
        return serialization.load_pem_private_key(
            private_key_pem.encode('utf-8'),
            password=None,
            backend=default_backend()
        )
    
    @staticmethod
    def load_public_key(public_key_pem: str):
        """从PEM字符串加载公钥"""
        return serialization.load_pem_public_key(
            public_key_pem.encode('utf-8'),
            backend=default_backend()
        )
    
    @staticmethod
    def encrypt(data: bytes, public_key_pem: str) -> str:
        """
        使用公钥加密数据
        
        Args:
            data: 要加密的数据（最大245字节，因为RSA-2048）
            public_key_pem: PEM格式的公钥字符串
        
        Returns:
            str: base64编码的密文
        """
        public_key = RSAEncryption.load_public_key(public_key_pem)
        
        ciphertext = public_key.encrypt(
            data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        return base64.b64encode(ciphertext).decode('utf-8')
    
    @staticmethod
    def decrypt(encrypted_data: str, private_key_pem: str) -> bytes:
        """
        使用私钥解密数据
        
        Args:
            encrypted_data: base64编码的密文
            private_key_pem: PEM格式的私钥字符串
        
        Returns:
            bytes: 解密后的原始数据
        """
        private_key = RSAEncryption.load_private_key(private_key_pem)
        
        ciphertext = base64.b64decode(encrypted_data)
        
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        return plaintext
    
    @staticmethod
    def encrypt_large_data(data: bytes, public_key_pem: str) -> list:
        """
        加密大块数据（分块加密）
        
        Args:
            data: 要加密的数据
            public_key_pem: PEM格式的公钥字符串
        
        Returns:
            list: base64编码的密文块列表
        """
        chunk_size = 245  # RSA-2048最大加密块大小
        chunks = []
        
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            encrypted_chunk = RSAEncryption.encrypt(chunk, public_key_pem)
            chunks.append(encrypted_chunk)
        
        return chunks
    
    @staticmethod
    def decrypt_large_data(encrypted_chunks: list, private_key_pem: str) -> bytes:
        """
        解密大块数据（分块解密）
        
        Args:
            encrypted_chunks: base64编码的密文块列表
            private_key_pem: PEM格式的私钥字符串
        
        Returns:
            bytes: 解密后的原始数据
        """
        plaintext_chunks = []
        
        for chunk in encrypted_chunks:
            plaintext_chunk = RSAEncryption.decrypt(chunk, private_key_pem)
            plaintext_chunks.append(plaintext_chunk)
        
        return b''.join(plaintext_chunks)
