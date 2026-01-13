"""
密码认证模块
"""
import bcrypt
import secrets
import string

class PasswordAuth:
    """密码认证类"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        哈希密码
        
        Args:
            password: 明文密码
        
        Returns:
            str: bcrypt哈希后的密码
        """
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """
        验证密码
        
        Args:
            password: 明文密码
            password_hash: 哈希后的密码
        
        Returns:
            bool: 是否匹配
        """
        return bcrypt.checkpw(
            password.encode('utf-8'),
            password_hash.encode('utf-8')
        )
    
    @staticmethod
    def generate_token(length: int = 32) -> str:
        """
        生成随机token
        
        Args:
            length: token长度
        
        Returns:
            str: 随机token
        """
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple:
        """
        验证密码强度
        
        Args:
            password: 密码
        
        Returns:
            tuple: (is_valid, message)
        """
        if len(password) < 8:
            return False, "密码长度至少8位"
        
        if len(password) > 128:
            return False, "密码长度不能超过128位"
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
        
        if not (has_upper and has_lower and has_digit):
            return False, "密码必须包含大小写字母和数字"
        
        return True, "密码强度符合要求"
