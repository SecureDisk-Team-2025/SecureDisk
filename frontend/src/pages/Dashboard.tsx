import React, { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Card,
  Table,
  Button,
  Upload,
  message,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Popconfirm,
} from 'antd';
import {
  FileOutlined,
  UploadOutlined,
  LogoutOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UserAddOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { AuthContext } from '../contexts/AuthContext';
import { fileService } from '../services/fileService';
import { groupService } from '../services/groupService';
import './Dashboard.css';

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;

const Dashboard: React.FC = () => {
  const { user, logout } = React.useContext(AuthContext);
  const [files, setFiles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [joinGroupModalVisible, setJoinGroupModalVisible] = useState(false);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [allGroupsLoading, setAllGroupsLoading] = useState(false);
  const [selectedGroupToJoin, setSelectedGroupToJoin] = useState<any>(null);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // 加载文件列表
  const loadFiles = async () => {
    // 直接调用带关键字的加载函数
    loadFilesWithKeyword(searchKeyword);
  };

  // 处理搜索
  const handleSearch = () => {
    // 直接使用searchInput的值进行搜索，避免状态更新的异步问题
    setSearchKeyword(searchInput);
    // 直接传递搜索值给loadFiles，而不是依赖searchKeyword状态
    loadFilesWithKeyword(searchInput);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchKeyword('');
    // 直接传递空字符串进行搜索
    loadFilesWithKeyword('');
  };

  // 带关键字的文件加载
  const loadFilesWithKeyword = async (keyword: string) => {
    setLoading(true);
    try {
      const fileList = await fileService.getFileList(selectedGroup, keyword);
      setFiles(fileList || []);
    } catch (error: any) {
      console.error('加载文件列表错误:', error);
      const errorMsg = error.response?.data?.error || error.message || '加载文件列表失败';
      message.error(errorMsg);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载用户组列表
  const loadGroups = async () => {
    try {
      const groupList = await groupService.getGroupList();
      setGroups(groupList || []);
    } catch (error: any) {
      console.error('加载用户组列表错误:', error);
      const errorMsg = error.response?.data?.error || error.message || '加载用户组列表失败';
      // 如果是401错误（未登录），不显示错误消息，因为会被重定向
      if (error.response?.status !== 401) {
        message.error(errorMsg);
      }
      setGroups([]);
    }
  };

  // 加载所有可选组列表
  const loadAllGroups = async () => {
    setAllGroupsLoading(true);
    try {
      const groupList = await groupService.getAllGroups();
      setAllGroups(groupList || []);
    } catch (error: any) {
      console.error('加载所有组列表错误:', error);
      message.error(error.response?.data?.error || '加载组列表失败');
    } finally {
      setAllGroupsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    loadGroups();
    loadPendingRequestsCount();
  }, [selectedGroup]);

  // 每30秒自动更新未处理申请数量
  useEffect(() => {
    const interval = setInterval(loadPendingRequestsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // 文件上传
  const handleUpload = async (file: File) => {
    try {
      console.log('开始上传文件:', file.name);
      const result = await fileService.uploadFile(file, selectedGroup);
      message.success('上传成功');
      loadFiles();
      return false; // 阻止默认上传行为
    } catch (error: any) {
      console.error('上传文件错误:', error);
      const errorMsg = error.response?.data?.error || error.message || '上传失败';
      message.error(errorMsg);
      return false;
    }
  };

  // 文件下载
  const handleDownload = async (file: any) => {
    try {
      await fileService.downloadFile(file.id, file.original_filename);
      message.success('下载成功');
    } catch (error: any) {
      message.error(error.response?.data?.error || '下载失败');
    }
  };

  // 文件删除
  const handleDelete = async (fileId: number) => {
    try {
      await fileService.deleteFile(fileId);
      message.success('删除成功');
      loadFiles();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  // 文件预览
  const handlePreview = async (file: any) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    try {
      // 调用预览服务获取文件内容
      const data = await fileService.previewFile(file.id, file.original_filename);
      setPreviewData(data);
      setPreviewModalVisible(true);
    } catch (error: any) {
      message.error(error.response?.data?.error || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 检查文件是否可预览
  const isPreviewable = (filename: string) => {
    const previewableExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', // 图片
      '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', // 文本文件
      '.pdf' // PDF文件
    ];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return previewableExtensions.includes(ext);
  };

  // 创建用户组
  const handleCreateGroup = async (values: any) => {
    try {
      await groupService.createGroup(values.name, values.description);
      message.success('创建成功');
      setGroupModalVisible(false);
      form.resetFields();
      loadGroups();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  // 加入用户组
  const handleJoinGroup = async (values: any) => {
    try {
      const result = await groupService.joinGroup(selectedGroupToJoin.id, values.message);
      message.success(result.message || '申请已提交');
      setApplyModalVisible(false);
      setJoinGroupModalVisible(false);
      joinForm.resetFields();
      loadAllGroups(); // 重新加载列表以更新状态
    } catch (error: any) {
      message.error(error.response?.data?.error || '加入失败');
    }
  };

  // 加载申请列表
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const requestList = await groupService.getGroupRequests();
      setRequests(requestList || []);
      setPendingRequestsCount(requestList?.length || 0);
    } catch (error: any) {
      console.error('加载申请列表错误:', error);
      const errorMsg = error.response?.data?.error || error.message || '加载申请列表失败';
      message.error(errorMsg);
      setRequests([]);
      setPendingRequestsCount(0);
    } finally {
      setRequestsLoading(false);
    }
  };

  // 加载未处理申请数量
  const loadPendingRequestsCount = async () => {
    try {
      const requestList = await groupService.getGroupRequests();
      setPendingRequestsCount(requestList?.length || 0);
    } catch (error) {
      console.error('加载未处理申请数量错误:', error);
      setPendingRequestsCount(0);
    }
  };

  // 批准申请
  const handleApproveRequest = async (requestId: number) => {
    try {
      await groupService.approveJoinRequest(requestId);
      message.success('批准成功');
      loadRequests();
      loadGroups();
      loadPendingRequestsCount();
    } catch (error: any) {
      message.error(error.response?.data?.error || '批准失败');
    }
  };

  // 拒绝申请
  const handleRejectRequest = async (requestId: number) => {
    try {
      await groupService.rejectJoinRequest(requestId);
      message.success('拒绝成功');
      loadRequests();
      loadPendingRequestsCount();
    } catch (error: any) {
      message.error(error.response?.data?.error || '拒绝失败');
    }
  };

  // 文件列表列定义
  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'original_filename',
      key: 'original_filename',
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {isPreviewable(record.original_filename) && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            >
              预览
            </Button>
          )}
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
          <Popconfirm
            title="确定要删除这个文件吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout className="dashboard-layout">
      <Header className="dashboard-header">
        <div className="header-left">
          <h1 style={{ color: 'white', margin: 0 }}>网络加密磁盘系统</h1>
        </div>
        <div className="header-right">
          <span style={{ color: 'white', marginRight: 16 }}>欢迎，{user?.username}</span>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            登出
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider width={250} className="dashboard-sider">
          <Menu
            mode="inline"
            selectedKeys={selectedGroup ? [`group-${selectedGroup}`] : ['all']}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item
              key="all"
              icon={<FileOutlined />}
              onClick={() => setSelectedGroup(undefined)}
            >
              全部文件
            </Menu.Item>
            <Menu.Divider />
            <Menu.ItemGroup title="用户组">
              {groups.map((group) => (
                <Menu.Item
                  key={`group-${group.id}`}
                  icon={<TeamOutlined />}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  {group.name} (ID: {group.id})
                </Menu.Item>
              ))}
              <Menu.Item
                key="create-group"
                icon={<PlusOutlined />}
                onClick={() => setGroupModalVisible(true)}
              >
                创建用户组
              </Menu.Item>
            <Menu.Item
                key="join-group"
                icon={<UserAddOutlined />}
                onClick={() => {
                  loadAllGroups();
                  setJoinGroupModalVisible(true);
                }}
              >
                加入用户组
              </Menu.Item>
              <Menu.Item
                key="manage-requests"
                icon={<TeamOutlined />}
                onClick={() => {
                  loadRequests();
                  setRequestsModalVisible(true);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  管理加入申请
                  {pendingRequestsCount > 0 && (
                    <span style={{
                      backgroundColor: '#ff4d4f',
                      color: 'white',
                      borderRadius: '10px',
                      padding: '0 8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {pendingRequestsCount}
                    </span>
                  )}
                </span>
              </Menu.Item>
            </Menu.ItemGroup>
          </Menu>
        </Sider>
        <Content className="dashboard-content">
          <Card
            title={
              <Space>
                <FileOutlined />
                <span>{selectedGroup ? '用户组文件' : '我的文件'}</span>
              </Space>
            }
            extra={
              <Space>
                <Input.Search
                  placeholder="搜索文件名"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onSearch={handleSearch}
                  style={{ width: 200 }}
                  allowClear
                  onClear={handleClearSearch}
                />
                <Upload
                  beforeUpload={handleUpload}
                  showUploadList={false}
                >
                  <Button type="primary" icon={<UploadOutlined />}>
                    上传文件
                  </Button>
                </Upload>
              </Space>
            }
          >
            <Table
              columns={fileColumns}
              dataSource={files}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 个文件`,
              }}
            />
          </Card>
        </Content>
      </Layout>

      {/* 创建用户组模态框 */}
      <Modal
        title="创建用户组"
        open={groupModalVisible}
        onCancel={() => {
          setGroupModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleCreateGroup}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="组名"
            rules={[{ required: true, message: '请输入组名' }]}
          >
            <Input placeholder="请输入组名" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => {
                setGroupModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 加入用户组模态框 */}
      <Modal
        title="加入用户组"
        open={joinGroupModalVisible}
        onCancel={() => {
          setJoinGroupModalVisible(false);
        }}
        footer={null}
        width={700}
      >
        <Table
          dataSource={allGroups}
          loading={allGroupsLoading}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            {
              title: '组名',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '创建者',
              dataIndex: 'creator_name',
              key: 'creator_name',
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true,
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: any) => {
                if (record.is_joined) {
                  return <Tag color="green">已加入</Tag>;
                }
                if (record.has_pending_request) {
                  return <Tag color="orange">申请中</Tag>;
                }
                return (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      setSelectedGroupToJoin(record);
                      setApplyModalVisible(true);
                    }}
                  >
                    申请加入
                  </Button>
                );
              },
            },
          ]}
        />
      </Modal>

      {/* 填写申请理由模态框 */}
      <Modal
        title={`申请加入: ${selectedGroupToJoin?.name}`}
        open={applyModalVisible}
        onCancel={() => {
          setApplyModalVisible(false);
          joinForm.resetFields();
        }}
        onOk={() => joinForm.submit()}
        okText="发送申请"
        cancelText="取消"
      >
        <Form
          form={joinForm}
          onFinish={handleJoinGroup}
          layout="vertical"
        >
          <Form.Item
            name="message"
            label="申请理由"
            rules={[
              { max: 500, message: '申请信息不能超过500个字符' }
            ]}
          >
            <TextArea rows={4} placeholder="请输入申请加入的理由（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理加入申请模态框 */}
      <Modal
        title="管理加入申请"
        open={requestsModalVisible}
        onCancel={() => setRequestsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={[
            {
              title: '申请人',
              dataIndex: 'user',
              key: 'user',
              render: (user: any) => user?.username || '未知用户',
            },
            {
              title: '申请加入的群组',
              dataIndex: 'group',
              key: 'group',
              render: (group: any) => group?.name || '未知群组',
            },
            {
              title: '申请信息',
              dataIndex: 'message',
              key: 'message',
              render: (message: string) => message || '无',
            },
            {
              title: '申请时间',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (time: string) => new Date(time).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: any) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleApproveRequest(record.id)}
                  >
                    批准
                  </Button>
                  <Button
                    danger
                    size="small"
                    onClick={() => handleRejectRequest(record.id)}
                  >
                    拒绝
                  </Button>
                </Space>
              ),
            },
          ]}
          dataSource={requests}
          loading={requestsLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 个申请`,
          }}
          locale={{
            emptyText: '暂无申请',
          }}
        />
      </Modal>

      {/* 文件预览模态框 */}
      <Modal
        title={`预览文件: ${previewFile?.original_filename}`}
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          // 清理blob URL，防止内存泄漏
          if (previewData && previewData.content && previewData.type !== 'text') {
            window.URL.revokeObjectURL(previewData.content);
          }
          setPreviewData(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPreviewModalVisible(false);
            // 清理blob URL，防止内存泄漏
            if (previewData && previewData.content && previewData.type !== 'text') {
              window.URL.revokeObjectURL(previewData.content);
            }
            setPreviewData(null);
          }}>
            关闭
          </Button>,
        ]}
        width={800}
        height={600}
      >
        <div style={{ padding: '20px', maxHeight: '500px', overflow: 'auto' }}>
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>预览加载中...</div>
          ) : (
            <div>
              {previewData ? (
                <>
                  {previewData.type === 'image' && (
                    <img
                      src={previewData.content}
                      alt={previewFile?.original_filename}
                      style={{ maxWidth: '100%', maxHeight: '400px' }}
                    />
                  )}
                  {previewData.type === 'pdf' && (
                    <div>
                      <iframe
                        src={previewData.content}
                        width="100%"
                        height="400px"
                        style={{ border: 'none' }}
                      />
                    </div>
                  )}
                  {previewData.type === 'text' && (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {previewData.content}
                    </pre>
                  )}
                  {previewData.type === 'other' && (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <p>无法预览此文件类型</p>
                      <Button 
                        type="primary" 
                        onClick={() => handleDownload(previewFile)}
                      >
                        下载文件
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px' }}>预览内容加载失败</div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
};

export default Dashboard;
