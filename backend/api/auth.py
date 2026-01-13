"""
认证API接口
"""
from flask import Blueprint, request, jsonify, session
from models import User, Session as SessionModel, EmailCode, db
from datetime import datetime, timedelta
from auth.password import PasswordAuth
from auth.email import EmailAuth
from crypto.key_manager import KeyManager
from crypto.rsa import RSAEncryption
from crypto.hmac import HMACVerifier
import secrets
import json

auth_bp = Blueprint('auth', __name__)

def get_current_user():
    """获取当前登录用户"""
    session_token = request.headers.get('X-Session-Token')
    if not session_token:
        return None
    
    from sqlalchemy import and_
    session_obj = SessionModel.query.filter(
        and_(
            SessionModel.session_token == session_token,
            SessionModel.expires_at > datetime.utcnow()
        )
    ).first()
    
    if not session_obj:
        return None
    
    # 更新最后活动时间
    session_obj.last_activity = datetime.utcnow()
    db.session.commit()
    
    return session_obj.user

def require_auth(f):
    """认证装饰器"""
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未登录或会话已过期'}), 401
        return f(user, *args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not all([username, email, password]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 验证密码强度
        is_valid, message = PasswordAuth.validate_password_strength(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # 检查用户是否已存在
        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': '邮箱已被注册'}), 400
        
        # 生成主密钥和RSA密钥对
        master_key = KeyManager.generate_master_key()
        private_key, public_key = RSAEncryption.generate_key_pair()
        
        # 加密主密钥
        encrypted_master_key_data = KeyManager.encrypt_master_key(master_key, password)
        encrypted_master_key_json = json.dumps(encrypted_master_key_data)
        
        # 创建恢复包（使用临时恢复码，实际应该通过邮箱发送）
        recovery_code = EmailAuth.generate_code(8)
        recovery_package = KeyManager.create_recovery_package(master_key, recovery_code)
        recovery_package_json = json.dumps(recovery_package)
        
        # 创建用户
        user = User(
            username=username,
            email=email,
            password_hash=PasswordAuth.hash_password(password),
            encrypted_master_key=encrypted_master_key_json,
            recovery_package=recovery_package_json
        )
        
        db.session.add(user)
        db.session.commit()
        
        # 返回公钥和恢复码（实际应用中恢复码应该通过邮件发送）
        return jsonify({
            'message': '注册成功',
            'user_id': user.id,
            'public_key': public_key,
            'recovery_code': recovery_code  # 仅用于演示，实际应通过邮件发送
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/email-code', methods=['POST'])
def send_email_code():
    """发送邮箱验证码"""
    try:
        data = request.get_json()
        email = data.get('email')
        purpose = data.get('purpose', 'login')
        
        if not email:
            return jsonify({'error': '缺少邮箱地址'}), 400
        
        if purpose not in ['login', 'recover']:
            return jsonify({'error': '无效的用途'}), 400
        
        code = EmailAuth.create_email_code(email, purpose)
        
        return jsonify({
            'message': '验证码已发送',
            'code': code  # 仅用于演示，实际不应返回
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录（密码或邮箱验证码）"""
    try:
        data = request.get_json()
        login_type = data.get('type', 'password')  # password 或 email
        username = data.get('username')
        email = data.get('email')
        
        # 根据登录类型验证
        if login_type == 'password':
            password = data.get('password')
            if not username or not password:
                return jsonify({'error': '缺少用户名或密码'}), 400
            
            user = User.query.filter_by(username=username).first()
            if not user or not PasswordAuth.verify_password(password, user.password_hash):
                return jsonify({'error': '用户名或密码错误'}), 401
        
        elif login_type == 'email':
            code = data.get('code')
            if not email or not code:
                return jsonify({'error': '缺少邮箱或验证码'}), 400
            
            if not EmailAuth.verify_email_code(email, code, 'login'):
                return jsonify({'error': '验证码无效或已过期'}), 401
            
            user = User.query.filter_by(email=email).first()
            if not user:
                return jsonify({'error': '用户不存在'}), 404
        
        else:
            return jsonify({'error': '无效的登录类型'}), 400
        
        # 更新最后登录时间
        user.last_login = datetime.utcnow()
        
        # 生成会话密钥（一次一密）
        session_key = KeyManager.generate_session_key()
        session_token = PasswordAuth.generate_token(32)
        
        # 获取客户端公钥（用于加密会话密钥）
        client_public_key = data.get('public_key')
        if not client_public_key:
            return jsonify({'error': '缺少客户端公钥'}), 400
        
        # 使用客户端公钥加密会话密钥
        encrypted_session_key = RSAEncryption.encrypt(session_key, client_public_key)
        
        # 创建会话记录
        expires_at = datetime.utcnow() + timedelta(hours=24)
        session_obj = SessionModel(
            user_id=user.id,
            session_token=session_token,
            encrypted_session_key=encrypted_session_key,
            expires_at=expires_at
        )
        
        db.session.add(session_obj)
        db.session.commit()
        
        return jsonify({
            'message': '登录成功',
            'session_token': session_token,
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/recover-key', methods=['POST'])
def recover_key():
    """密钥找回"""
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')
        
        if not email or not code:
            return jsonify({'error': '缺少邮箱或验证码'}), 400
        
        # 验证邮箱验证码
        if not EmailAuth.verify_email_code(email, code, 'recover'):
            return jsonify({'error': '验证码无效或已过期'}), 401
        
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        
        if not user.recovery_package:
            return jsonify({'error': '未找到恢复包'}), 404
        
        # 返回恢复包（客户端需要使用恢复码解密）
        recovery_package = json.loads(user.recovery_package)
        
        return jsonify({
            'message': '恢复包已获取',
            'recovery_package': recovery_package
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout(user):
    """登出"""
    try:
        session_token = request.headers.get('X-Session-Token')
        session_obj = SessionModel.query.filter_by(session_token=session_token).first()
        
        if session_obj:
            db.session.delete(session_obj)
            db.session.commit()
        
        return jsonify({'message': '登出成功'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user_info(user):
    """获取当前用户信息"""
    return jsonify({'user': user.to_dict()}), 200
