"""
HMAC验证实现
用于消息完整性验证和防篡改
"""
import hmac
import hashlib
import time
import base64

class HMACVerifier:
    """HMAC验证类"""
    
    @staticmethod
    def generate_hmac(data: bytes, key: bytes) -> str:
        """
        生成HMAC-SHA256签名
        
        Args:
            data: 要签名的数据
            key: HMAC密钥
        
        Returns:
            str: base64编码的HMAC签名
        """
        signature = hmac.new(
            key,
            data,
            hashlib.sha256
        ).digest()
        
        return base64.b64encode(signature).decode('utf-8')
    
    @staticmethod
    def verify_hmac(data: bytes, signature: str, key: bytes) -> bool:
        """
        验证HMAC签名
        
        Args:
            data: 原始数据
            signature: base64编码的HMAC签名
            key: HMAC密钥
        
        Returns:
            bool: 验证是否通过
        """
        expected_signature = HMACVerifier.generate_hmac(data, key)
        return hmac.compare_digest(expected_signature, signature)
    
    @staticmethod
    def create_signed_message(data: dict, key: bytes) -> dict:
        """
        创建带签名的消息
        
        Args:
            data: 要签名的数据字典
            key: HMAC密钥
        
        Returns:
            dict: {
                'data': 原始数据,
                'timestamp': 时间戳,
                'signature': HMAC签名
            }
        """
        import json
        timestamp = int(time.time())
        data['timestamp'] = timestamp
        
        message_str = json.dumps(data, sort_keys=True)
        signature = HMACVerifier.generate_hmac(
            message_str.encode('utf-8'),
            key
        )
        
        return {
            'data': data,
            'timestamp': timestamp,
            'signature': signature
        }
    
    @staticmethod
    def verify_signed_message(signed_message: dict, key: bytes, max_age: int = 300) -> tuple:
        """
        验证带签名的消息
        
        Args:
            signed_message: 带签名的消息字典
            key: HMAC密钥
            max_age: 消息最大有效期（秒），默认5分钟
        
        Returns:
            tuple: (is_valid, data) - 是否有效和数据
        """
        import json
        
        # 检查时间戳
        timestamp = signed_message.get('timestamp', 0)
        current_time = int(time.time())
        if current_time - timestamp > max_age:
            return False, None
        
        # 验证签名
        data = signed_message.get('data', {})
        signature = signed_message.get('signature', '')
        
        # 重新计算签名
        data_copy = data.copy()
        if 'timestamp' in data_copy:
            del data_copy['timestamp']
        
        message_str = json.dumps(data_copy, sort_keys=True)
        expected_signature = HMACVerifier.generate_hmac(
            message_str.encode('utf-8'),
            key
        )
        
        if not hmac.compare_digest(expected_signature, signature):
            return False, None
        
        return True, data
