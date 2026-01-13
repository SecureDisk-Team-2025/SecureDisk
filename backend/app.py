"""
网络加密磁盘系统 - Flask主应用
"""
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 初始化Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32).hex()
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///encrypted_disk.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 初始化扩展
from models import db
db.init_app(app)
# 配置CORS，允许所有来源（开发环境）
CORS(app, 
     supports_credentials=True,
     resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization", "X-Session-Token"],
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

@app.route('/')
def index():
    return {'message': '网络加密磁盘系统 API', 'version': '1.0.0'}

@app.route('/api/health')
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("数据库初始化完成")
        print("服务器启动在 http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
