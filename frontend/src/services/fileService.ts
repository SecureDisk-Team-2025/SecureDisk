import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  console.log('发送请求:', config.method?.toUpperCase(), config.url);
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('请求超时');
    } else if (error.message === 'Network Error') {
      console.error('网络错误：无法连接到后端服务器，请确保后端正在运行在 http://localhost:5000');
    }
    return Promise.reject(error);
  }
);

export const fileService = {
  // 获取文件列表
  async getFileList(groupId?: number) {
    const params = groupId ? { group_id: groupId } : {};
    const response = await api.get('/files/list', { params });
    return response.data.files;
  },

  // 上传文件
  async uploadFile(file: File, groupId?: number) {
    const formData = new FormData();
    formData.append('file', file);
    if (groupId) {
      formData.append('group_id', groupId.toString());
    }

    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 下载文件
  async downloadFile(fileId: number, filename: string) {
    const response = await api.get(`/files/download/${fileId}`, {
      responseType: 'blob',
    });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // 删除文件
  async deleteFile(fileId: number) {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },
};
