"""
网络加密磁盘系统 - Flask主应用
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import json
from dotenv import load_dotenv
# 确保 utils/mailer.py 文件存在
from utils.mailer import send_email, generate_code
import time
from datetime import datetime, timedelta
import secrets

# 加载环境变量
load_dotenv()

# 初始化Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32).hex()
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///encrypted_disk.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# 验证码内存存储
# 格式: { '邮箱地址': {'code': '123456', 'time': 1700000000} }
email_codes_storage = {} 

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 初始化数据库扩展
from models import db
db.init_app(app)

# 配置CORS
CORS(app, 
     supports_credentials=True,
     resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization", "X-Session-Token"],
     expose_headers=["X-Encrypted-File-Key", "X-File-Group-Id"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# 导入模型（必须在db初始化后）
from models import User, File, UserGroup, GroupMember, GroupJoinRequest, Session, EmailCode

# 导入API路由
from api.auth import auth_bp
from api.files import files_bp
from api.groups import groups_bp

# 注册蓝图
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(files_bp, url_prefix='/api/files')
app.register_blueprint(groups_bp, url_prefix='/api/groups')

# ==========================================
#  邮箱验证相关接口
# ==========================================

# --- 接口1：发送验证码 ---
@app.route('/api/auth/send-email-code', methods=['POST'])
def send_code_api():
    data = request.json
    if not data:
        return jsonify({'status': 'fail', 'msg': '无有效数据'})
        
    email = data.get('email')
    
    if not email:
        return jsonify({'status': 'fail', 'msg': '请输入邮箱'})

    # 生成并发送
    code = generate_code()
    if send_email(email, code):
        email_codes_storage[email] = {
            'code': code,
            'time': time.time()
        }
        print(f"DEBUG: 验证码 {code} 已发送至 {email}") 
        return jsonify({'status': 'success', 'msg': '验证码已发送'})
    else:
        return jsonify({'status': 'fail', 'msg': '发送失败，请检查邮箱配置'})

from crypto.key_manager import KeyManager
from crypto.rsa import RSAEncryption
from auth.email import EmailAuth

# --- 接口2：邮箱验证码登录  ---
@app.route('/api/auth/login-email', methods=['POST'])
def login_email_api():
    try:
        data = request.json
        print(f"------------ 邮箱登录请求 ------------")
        
        if not data:
            return jsonify({'status': 'fail', 'msg': '无数据'})

        email = data.get('email')
        input_code = str(data.get('code')).strip()
        client_public_key = data.get('public_key')
        
        # 1. 验证码检查
        if not EmailAuth.verify_email_code(email, input_code, 'login'):
            # 降级检查：如果 EmailAuth 失败，检查内存存储（兼容旧逻辑）
            if email in email_codes_storage:
                record = email_codes_storage[email]
                if time.time() - record['time'] <= 300 and str(record['code']) == input_code:
                    print("✅ 内存验证码匹配成功")
                    del email_codes_storage[email]
                else:
                    return jsonify({'status': 'fail', 'msg': '验证码错误或已过期'})
            else:
                return jsonify({'status': 'fail', 'msg': '验证码错误或已过期'})

        # ===============================================
        # ✅ 核心逻辑：写入数据库 Session
        # ===============================================
        
        # 1. 查找用户
        user = User.query.filter_by(email=email).first()
        if not user:
            print(f"❌ 用户不存在: {email}")
            return jsonify({'status': 'fail', 'msg': '用户不存在，请先注册'})

        # 2. 生成会话密钥（一次一密）
        session_key = KeyManager.generate_session_key()
        
        # 3. 生成 Session Token (包含加密传输用的密钥)
        token_core = secrets.token_hex(32)
        session_token = f"{token_core}.{session_key.hex()}"
        
        # 4. 加密会话密钥 (使用客户端传来的公钥或用户存储的公钥)
        pub_key_to_use = client_public_key or user.public_key
        if not pub_key_to_use:
            return jsonify({'status': 'fail', 'msg': '缺少加密公钥，无法建立安全会话'})
            
        encrypted_session_key = RSAEncryption.encrypt(session_key, pub_key_to_use)
        
        expires_at = datetime.now() + timedelta(days=1)
        
        new_session = Session(
            user_id=user.id,
            session_token=session_token,
            encrypted_session_key=encrypted_session_key,
            expires_at=expires_at
        )
        
        db.session.add(new_session)
        db.session.commit()
        
        print(f"✅ 登录成功! Token: {token_core[:10]}...")

        return jsonify({
                    'status': 'success', 
                    'session_token': session_token, 
                    'encrypted_session_key': encrypted_session_key,
                    'encrypted_master_key': user.encrypted_master_key,
                    'recovery_package': json.loads(user.recovery_package) if user.recovery_package else None,
                    'user': user.to_dict(),
                    'msg': '登录成功'
                })

    except Exception as e:
        print(f"❌ 系统异常: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'status': 'error', 'msg': f"登录失败: {str(e)}"})

# ==========================================
#  通用接口
# ==========================================

@app.route('/')
def index():
    return {'message': '网络加密磁盘系统 API', 'version': '1.0.0'}

@app.route('/api/health')
def health():
    return {'status': 'ok'}

# ==========================================
#  启动代码
# ==========================================
if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()
            print("数据库初始化完成")
        except Exception as e:
            print(f"数据库初始化警告: {e}")
            
        print("服务器启动在 http://0.0.0.0:5000")
        
    app.run(host='0.0.0.0', port=5000, debug=True)
