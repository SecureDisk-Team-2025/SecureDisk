"""
用户组管理API接口
"""
from flask import Blueprint, request, jsonify
from models import UserGroup, GroupMember, GroupSharedKey, User, db
from api.auth import require_auth
from datetime import datetime

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('/list', methods=['GET'])
@require_auth
def list_groups(user):
    """获取用户组列表"""
    try:
        # 获取用户所属的所有组
        memberships = GroupMember.query.filter_by(user_id=user.id).all()
        group_ids = [m.group_id for m in memberships]
        
        # 如果没有组，返回空列表
        if not group_ids:
            return jsonify({
                'groups': []
            }), 200
        
        groups = UserGroup.query.filter(UserGroup.id.in_(group_ids)).all()
        
        return jsonify({
            'groups': [g.to_dict() for g in groups]
        }), 200
    
    except Exception as e:
        import traceback
        print(f"获取用户组列表错误: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/create', methods=['POST'])
@require_auth
def create_group(user):
    """创建用户组"""
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')
        
        if not name:
            return jsonify({'error': '组名不能为空'}), 400
        
        # 创建用户组
        group = UserGroup(
            name=name,
            description=description,
            created_by=user.id
        )
        
        db.session.add(group)
        db.session.flush()
        
        # 添加创建者为组成员
        member = GroupMember(
            user_id=user.id,
            group_id=group.id,
            role='owner'
        )
        
        db.session.add(member)
        db.session.commit()
        
        return jsonify({
            'message': '创建成功',
            'group': group.to_dict()
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/join', methods=['POST'])
@require_auth
def join_group(user):
    """加入用户组"""
    try:
        data = request.get_json()
        group_id = data.get('group_id')
        
        if not group_id:
            return jsonify({'error': '缺少组ID'}), 400
        
        group = UserGroup.query.get_or_404(group_id)
        
        # 检查是否已经是成员
        existing = GroupMember.query.filter_by(
            user_id=user.id,
            group_id=group_id
        ).first()
        
        if existing:
            return jsonify({'error': '已经是该组成员'}), 400
        
        # 添加成员
        member = GroupMember(
            user_id=user.id,
            group_id=group_id,
            role='member'
        )
        
        db.session.add(member)
        db.session.commit()
        
        return jsonify({
            'message': '加入成功',
            'group': group.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/share-key', methods=['POST'])
@require_auth
def share_key(user):
    """在用户组内共享密钥"""
    try:
        data = request.get_json()
        group_id = data.get('group_id')
        encrypted_key = data.get('encrypted_key')  # 使用接收用户公钥加密的密钥
        
        if not group_id or not encrypted_key:
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 检查用户是否在组内
        membership = GroupMember.query.filter_by(
            user_id=user.id,
            group_id=group_id
        ).first()
        
        if not membership:
            return jsonify({'error': '不是该组成员'}), 403
        
        # 创建共享密钥记录
        shared_key = GroupSharedKey(
            group_id=group_id,
            encrypted_key=encrypted_key,
            shared_by=user.id
        )
        
        db.session.add(shared_key)
        db.session.commit()
        
        return jsonify({
            'message': '密钥共享成功',
            'shared_key_id': shared_key.id
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<int:group_id>/members', methods=['GET'])
@require_auth
def get_group_members(user, group_id):
    """获取组成员列表"""
    try:
        # 检查用户是否在组内
        membership = GroupMember.query.filter_by(
            user_id=user.id,
            group_id=group_id
        ).first()
        
        if not membership:
            return jsonify({'error': '不是该组成员'}), 403
        
        members = GroupMember.query.filter_by(group_id=group_id).all()
        
        return jsonify({
            'members': [m.to_dict() for m in members]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
