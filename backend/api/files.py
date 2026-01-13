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
        
        # 生成文件密钥
        file_key = KeyManager.generate_file_key()
        
        # 加密文件
        from flask import current_app
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        filename = file.filename
        file_path = os.path.join(upload_folder, f'{user.id}_{datetime.now().timestamp()}_{filename}')
        os.makedirs(upload_folder, exist_ok=True)
        
        # 保存原始文件
        file.save(file_path)
        
        # 加密文件
        encrypted_path = file_path + '.enc'
        AESEncryption.encrypt_file(file_path, file_key, encrypted_path)
        
        # 删除原始文件
        os.remove(file_path)
        
        # 获取主密钥（需要客户端提供密码解密）
        # 这里简化处理，实际应该从客户端获取解密后的主密钥
        # 或者使用会话密钥加密文件密钥传输
        
        # 加密文件密钥（使用主密钥，这里需要客户端提供）
        # 实际应用中，文件密钥应该使用主密钥加密后存储
        encrypted_file_key_json = json.dumps({
            'encrypted': base64.b64encode(file_key).decode('utf-8')  # 简化处理
        })
        
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
            'file': file_record.to_dict(),
            'file_key': base64.b64encode(file_key).decode('utf-8')  # 返回给客户端
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
        
        # 获取文件密钥（需要客户端提供主密钥解密）
        encrypted_file_key_data = json.loads(file_record.encrypted_file_key)
        file_key = base64.b64decode(encrypted_file_key_data['encrypted'])
        
        # 解密文件到临时位置
        temp_path = file_record.file_path.replace('.enc', '.tmp')
        AESEncryption.decrypt_file(file_record.file_path, file_key, temp_path)
        
        # 返回文件
        response = send_file(
            temp_path,
            as_attachment=True,
            download_name=file_record.original_filename
        )
        
        # 清理临时文件
        def remove_file(response):
            try:
                os.remove(temp_path)
            except:
                pass
            return response
        
        response.call_on_close(lambda: os.remove(temp_path) if os.path.exists(temp_path) else None)
        
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
