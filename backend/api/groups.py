"""
用户组管理API接口
"""
from flask import Blueprint, request, jsonify
from models import UserGroup, GroupMember, GroupSharedKey, GroupJoinRequest, User, db
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
    """申请加入用户组"""
    try:
        data = request.get_json()
        group_id = data.get('group_id')
        message = data.get('message', '')
        
        if not group_id:
            return jsonify({'error': '缺少组ID'}), 400
        
        group = UserGroup.query.get_or_404(group_id)
        
        # 检查是否已经是成员
        existing_member = GroupMember.query.filter_by(
            user_id=user.id,
            group_id=group_id
        ).first()
        
        if existing_member:
            return jsonify({'error': '已经是该组成员'}), 400
        
        # 检查是否已经有未处理的申请
        existing_pending = GroupJoinRequest.query.filter_by(
            user_id=user.id,
            group_id=group_id,
            status='pending'
        ).first()
        
        if existing_pending:
            return jsonify({'error': '已经提交过申请，请等待审批'}), 400
        
        # 检查是否有被拒绝的申请
        existing_rejected = GroupJoinRequest.query.filter_by(
            user_id=user.id,
            group_id=group_id,
            status='rejected'
        ).first()
        
        if existing_rejected:
            # 删除旧的被拒绝申请
            db.session.delete(existing_rejected)
            db.session.commit()
        
        # 创建新的加入申请
        join_request = GroupJoinRequest(
            user_id=user.id,
            group_id=group_id,
            status='pending',
            message=message
        )
        
        db.session.add(join_request)
        db.session.commit()
        
        return jsonify({
            'message': '申请已提交，请等待管理员审批',
            'request_id': join_request.id
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/requests', methods=['GET'])
@require_auth
def get_group_requests(user):
    """获取用户组的加入申请（仅组管理员和创建者可查看）"""
    try:
        # 获取用户管理的所有组
        managed_groups = GroupMember.query.filter(
            GroupMember.user_id == user.id,
            GroupMember.role.in_(['owner', 'admin'])
        ).all()
        
        group_ids = [m.group_id for m in managed_groups]
        
        if not group_ids:
            return jsonify({'requests': []}), 200
        
        # 获取这些组的所有未处理申请
        requests = GroupJoinRequest.query.filter(
            GroupJoinRequest.group_id.in_(group_ids),
            GroupJoinRequest.status == 'pending'
        ).all()
        
        # 获取请求用户的信息
        request_data = []
        for req in requests:
            req_dict = req.to_dict()
            req_user = User.query.get(req.user_id)
            if req_user:
                req_dict['user'] = req_user.to_dict()
            req_group = UserGroup.query.get(req.group_id)
            if req_group:
                req_dict['group'] = req_group.to_dict()
            request_data.append(req_dict)
        
        return jsonify({'requests': request_data}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/requests/<int:request_id>/approve', methods=['POST'])
@require_auth
def approve_join_request(user, request_id):
    """批准加入申请"""
    try:
        # 获取申请
        join_request = GroupJoinRequest.query.get_or_404(request_id)
        
        # 检查用户是否有权限审批（组管理员或创建者）
        membership = GroupMember.query.filter(
            GroupMember.user_id == user.id,
            GroupMember.group_id == join_request.group_id,
            GroupMember.role.in_(['owner', 'admin'])
        ).first()
        
        if not membership:
            return jsonify({'error': '没有权限审批此申请'}), 403
        
        # 检查申请状态
        if join_request.status != 'pending':
            return jsonify({'error': '申请已经处理过'}), 400
        
        # 更新申请状态
        join_request.status = 'approved'
        
        # 添加用户为组成员
        member = GroupMember(
            user_id=join_request.user_id,
            group_id=join_request.group_id,
            role='member'
        )
        
        db.session.add(member)
        db.session.commit()
        
        return jsonify({'message': '批准成功'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/requests/<int:request_id>/reject', methods=['POST'])
@require_auth
def reject_join_request(user, request_id):
    """拒绝加入申请"""
    try:
        # 获取申请
        join_request = GroupJoinRequest.query.get_or_404(request_id)
        
        # 检查用户是否有权限审批（组管理员或创建者）
        membership = GroupMember.query.filter_by(
            user_id=user.id,
            group_id=join_request.group_id
        ).first()
        
        if not membership or membership.role not in ['owner', 'admin']:
            return jsonify({'error': '没有权限审批此申请'}), 403
        
        # 检查申请状态
        if join_request.status != 'pending':
            return jsonify({'error': '申请已经处理过'}), 400
        
        # 更新申请状态
        join_request.status = 'rejected'
        db.session.commit()
        
        return jsonify({'message': '拒绝成功'}), 200
    
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
