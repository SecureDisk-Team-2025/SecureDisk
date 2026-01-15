"""
文件管理API接口
"""
from flask import Blueprint, request, jsonify, send_file
from models import File, db
from api.auth import require_auth, get_current_user
from crypto.aes import AESEncryption
from crypto.key_manager import KeyManager
from crypto.hmac import HMACVerifier
from datetime import datetime
import os
import base64
import json
import io

files_bp = Blueprint('files', __name__)

def get_session_key(user):
    """获取会话密钥（简化版，实际应从session中获取）"""
    from models import Session as SessionModel
    session_token = request.headers.get('X-Session-Token')
    if session_token:
        session_obj = SessionModel.query.filter_by(
            session_token=session_token,
            user_id=user.id
        ).first()
        if session_obj:
            # 实际应该使用客户端私钥解密
            # 这里简化处理，实际应用中需要客户端提供私钥
            return None  # 需要客户端提供私钥来解密
    return None

@files_bp.route('/list', methods=['GET'])
@require_auth
def list_files(user):
    """获取文件列表"""
    try:
        group_id = request.args.get('group_id', type=int)
        keyword = request.args.get('keyword', type=str)
        
        if group_id:
            # 检查用户是否在该组内
            from models import GroupMember
            membership = GroupMember.query.filter_by(
                user_id=user.id,
                group_id=group_id
            ).first()
            
            if not membership:
                return jsonify({'error': '不是该组成员'}), 403
            
            # 获取组内所有文件
            query = File.query.filter_by(group_id=group_id)
        else:
            # 获取用户自己的文件
            query = File.query.filter_by(owner_id=user.id)
        
        # 如果有搜索关键字，添加过滤条件
        if keyword:
            query = query.filter(File.original_filename.like(f'%{keyword}%'))
        
        files = query.order_by(File.created_at.desc()).all()
        
        return jsonify({
            'files': [f.to_dict() for f in files]
        }), 200
    
    except Exception as e:
        import traceback
        print(f"获取文件列表错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@files_bp.route('/upload', methods=['POST'])
@require_auth
def upload_file(user):
    """上传文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400
        
        file = request.files['file']
        group_id = request.form.get('group_id', type=int)
        
        if not file or file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
            
        # 获取传输层会话密钥
        token = request.headers.get('X-Session-Token')
        session_key = None
        if token and '.' in token:
            try:
                session_key = bytes.fromhex(token.split('.')[1])
            except:
                pass
        
        if not session_key:
            return jsonify({'error': '会话密钥丢失'}), 400
        
        # 直接在 uploads 目录下生成加密文件名
        from flask import current_app
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        filename = file.filename
        filename_on_disk = f'{user.id}_{datetime.now().timestamp()}_{filename}.enc'
        encrypted_path = os.path.join(upload_folder, filename_on_disk)
        os.makedirs(upload_folder, exist_ok=True)
        
        # 读取上传的文件流（这是传输层加密的数据 Layer 2）
        layer2_data = file.read()
        
        # 解密传输层，得到文件层加密数据 (Layer 1)
        try:
            layer1_data = AESEncryption.decrypt_raw(layer2_data, session_key)
        except Exception as e:
            return jsonify({'error': f'传输层解密失败: {str(e)}'}), 400
            
        # 将Layer 1数据（仍被File Key加密）写入磁盘
        # 服务器无法解密这一层，满足"服务器不能解开用户加密数据"的要求
        with open(encrypted_path, 'wb') as f:
            f.write(layer1_data)
        
        # 获取客户端上传的加密文件密钥
        encrypted_file_key_json = request.form.get('encrypted_file_key')
        if not encrypted_file_key_json:
            # 兼容旧逻辑（可选，或者直接报错）
            return jsonify({'error': '缺少加密文件密钥'}), 400
        
        # 创建文件记录
        file_record = File(
            filename=os.path.basename(encrypted_path),
            original_filename=filename,
            file_path=encrypted_path,
            file_size=os.path.getsize(encrypted_path),
            encrypted_file_key=encrypted_file_key_json,
            owner_id=user.id,
            group_id=group_id,
            mime_type=file.content_type
        )
        
        db.session.add(file_record)
        db.session.commit()
        
        return jsonify({
            'message': '上传成功',
            'file': file_record.to_dict()
        }), 201
    
    except Exception as e:
        import traceback
        print(f"上传文件错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@files_bp.route('/download/<int:file_id>', methods=['GET'])
@require_auth
def download_file(user, file_id):
    """下载文件"""
    try:
        file_record = File.query.get_or_404(file_id)
        
        # 检查权限
        if file_record.owner_id != user.id:
            # 如果不是文件所有者，检查是否是同一个用户组的成员
            if file_record.group_id:
                from models import GroupMember
                membership = GroupMember.query.filter_by(
                    user_id=user.id,
                    group_id=file_record.group_id
                ).first()
                
                if not membership:
                    return jsonify({'error': '无权访问此文件'}), 403
            else:
                return jsonify({'error': '无权访问此文件'}), 403
        
        # 获取传输层会话密钥
        token = request.headers.get('X-Session-Token')
        session_key = None
        if token and '.' in token:
            try:
                session_key = bytes.fromhex(token.split('.')[1])
            except:
                pass
        
        if not session_key:
            return jsonify({'error': '会话密钥丢失'}), 400

        # 读取加密文件内容 (Layer 1: 端到端加密数据)
        # 服务器直接读取磁盘上的密文，不进行解密
        if not os.path.exists(file_record.file_path):
            return jsonify({'error': '文件不存在'}), 404
            
        with open(file_record.file_path, 'rb') as f:
            layer1_data = f.read()

        # 传输层加密 (Layer 2: 会话密钥加密)
        # 使用会话密钥对Layer 1数据进行再次加密，防止传输过程被窃听
        try:
            layer2_data = AESEncryption.encrypt_raw(layer1_data, session_key)
        except Exception as e:
            return jsonify({'error': f'传输层加密失败: {str(e)}'}), 500

        # 返回双重加密的数据流
        # 客户端收到后需进行两层解密：
        # 1. 解密传输层 (Session Key) -> 得到 Layer 1
        # 2. 解密文件层 (File Key) -> 得到 Plaintext
        from flask import make_response
        response = make_response(layer2_data)
        response.headers['Content-Type'] = 'application/octet-stream'
        
        # 添加加密的文件密钥到响应头，以便客户端解密 Layer 1
        if file_record.encrypted_file_key:
             response.headers['X-Encrypted-File-Key'] = file_record.encrypted_file_key
             if file_record.group_id:
                 response.headers['X-File-Group-Id'] = str(file_record.group_id)
             # 确保CORS允许此Header (已在app.py中配置)
             
        return response
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/<int:file_id>', methods=['DELETE'])
@require_auth
def delete_file(user, file_id):
    """删除文件"""
    try:
        file_record = File.query.get_or_404(file_id)
        
        # 检查权限
        if file_record.owner_id != user.id:
            # 如果不是文件所有者，检查是否是同一个用户组的成员
            if file_record.group_id:
                from models import GroupMember
                membership = GroupMember.query.filter_by(
                    user_id=user.id,
                    group_id=file_record.group_id
                ).first()
                
                if not membership:
                    return jsonify({'error': '无权删除此文件'}), 403
            else:
                return jsonify({'error': '无权删除此文件'}), 403
        
        # 删除文件
        if os.path.exists(file_record.file_path):
            os.remove(file_record.file_path)
        
        db.session.delete(file_record)
        db.session.commit()
        
        return jsonify({'message': '删除成功'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
