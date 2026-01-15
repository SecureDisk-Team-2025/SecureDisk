import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.message === 'Network Error') {
      console.error('网络错误：无法连接到后端服务器，请确保后端正在运行在 http://localhost:5000');
    }
    return Promise.reject(error);
  }
);

export const groupService = {
  // 获取用户组列表
  async getGroupList() {
    const response = await api.get('/groups/list');
    return response.data.groups;
  },

  // 获取所有组列表（包含创建者信息和已加入状态）
  async getAllGroups() {
    const response = await api.get('/groups/all');
    return response.data.groups;
  },

  // 创建用户组
  async createGroup(name: string, description?: string) {
    const response = await api.post('/groups/create', {
      name,
      description,
    });
    return response.data.group;
  },

  // 加入用户组（创建申请）
  async joinGroup(groupId: number, message?: string) {
    const response = await api.post('/groups/join', {
      group_id: groupId,
      message: message,
    });
    return response.data;
  },

  // 获取组成员
  async getGroupMembers(groupId: number) {
    const response = await api.get(`/groups/${groupId}/members`);
    return response.data.members;
  },

  // 获取用户组的加入申请
  async getGroupRequests() {
    const response = await api.get('/groups/requests');
    return response.data.requests;
  },

  // 批准加入申请
  async approveJoinRequest(requestId: number) {
    const response = await api.post(`/groups/requests/${requestId}/approve`);
    return response.data;
  },

  // 拒绝加入申请
  async rejectJoinRequest(requestId: number) {
    const response = await api.post(`/groups/requests/${requestId}/reject`);
    return response.data;
  },
};
