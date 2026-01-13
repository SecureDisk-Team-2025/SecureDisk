"""
网络加密磁盘系统 - Flask主应用
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
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
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# 导入模型
from models import User, File, UserGroup, GroupMember, Session, EmailCode

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

# --- 接口2：邮箱验证码登录 (完美适配数据库版) ---
@app.route('/api/auth/login-email', methods=['POST'])
def login_email_api():
    try:
        data = request.json
        print(f"------------ 邮箱登录请求 ------------")
        
        if not data:
            return jsonify({'status': 'fail', 'msg': '无数据'})

        email = data.get('email')
        input_code = str(data.get('code')).strip()
        
        # 1. 验证码检查
        if email not in email_codes_storage:
            print(f"❌ 内存无记录: {email}")
            return jsonify({'status': 'fail', 'msg': '验证码不存在(服务器重启)，请重发'})
    
        record = email_codes_storage[email]
        
        # 检查过期
        if time.time() - record['time'] > 300:
            return jsonify({'status': 'fail', 'msg': '验证码已过期'})
            
        # 检查匹配
        stored_code = str(record['code'])
        if stored_code != input_code:
            print(f"❌ 验证码不匹配: 存[{stored_code}] vs 输[{input_code}]")
            return jsonify({'status': 'fail', 'msg': '验证码错误'})

        # ===============================================
        # ✅ 核心逻辑：写入数据库 Session
        # ===============================================
        print("✅ 验证码正确，正在生成数据库会话...")
        
        # 1. 查找或创建用户
        user = User.query.filter_by(email=email).first()
        if not user:
            print(f"ℹ️ 用户不存在，自动注册: {email}")
            username = email.split('@')[0]
            # 防止重名
            if User.query.filter_by(username=username).first():
                username = f"{username}_{secrets.token_hex(2)}"
            
            user = User(username=username, email=email)
            user.set_password(secrets.token_hex(8))
            db.session.add(user)
            db.session.commit()

        # 2. 创建 Session (修复了之前的所有字段错误)
        token_str = secrets.token_hex(32)
        # 你的数据库要求 encrypted_session_key 不能为空，生成一个随机值填充
        dummy_session_key = secrets.token_hex(32)
        expires_at = datetime.now() + timedelta(days=1)
        
        new_session = Session(
            user_id=user.id,
            session_token=token_str,             # 对应 models.py 的字段名
            encrypted_session_key=dummy_session_key, # 对应 models.py 的字段名
            expires_at=expires_at
            # 删除了 ip_address 和 user_agent，因为你的数据库没有这些列
        )
        
        db.session.add(new_session)
        db.session.commit()
        
        del email_codes_storage[email] # 清除验证码

        print(f"✅ 登录成功! Token: {token_str[:10]}...")

        return jsonify({
            'status': 'success', 
            'token': token_str,         
            'session_token': token_str, 
            'username': user.username,
            'user': {'username': user.username, 'email': user.email},
            'msg': '登录成功'
        })

    except Exception as e:
        print(f"❌ 系统异常: {e}")
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