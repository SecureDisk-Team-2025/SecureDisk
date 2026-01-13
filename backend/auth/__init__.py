"""
认证模块
"""
from .password import PasswordAuth
from .email import EmailAuth

__all__ = ['PasswordAuth', 'EmailAuth']
