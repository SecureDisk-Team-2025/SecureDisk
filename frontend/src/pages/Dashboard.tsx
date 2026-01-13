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
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();

  // 加载文件列表
  const loadFiles = async () => {
    setLoading(true);
    try {
      const fileList = await fileService.getFileList(selectedGroup);
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

  useEffect(() => {
    loadFiles();
    loadGroups();
  }, [selectedGroup]);

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
      const groupId = parseInt(values.groupId);
      await groupService.joinGroup(groupId);
      message.success('加入成功');
      setJoinGroupModalVisible(false);
      joinForm.resetFields();
      loadGroups();
    } catch (error: any) {
      message.error(error.response?.data?.error || '加入失败');
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
                onClick={() => setJoinGroupModalVisible(true)}
              >
                加入用户组
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
              <Upload
                beforeUpload={handleUpload}
                showUploadList={false}
              >
                <Button type="primary" icon={<UploadOutlined />}>
                  上传文件
                </Button>
              </Upload>
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
          joinForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={joinForm}
          onFinish={handleJoinGroup}
          layout="vertical"
        >
          <Form.Item
            name="groupId"
            label="用户组 ID"
            rules={[
              { required: true, message: '请输入用户组 ID' },
              { pattern: /^\d+$/, message: '用户组 ID 必须是数字' }
            ]}
          >
            <Input placeholder="请输入用户组 ID" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                加入
              </Button>
              <Button onClick={() => {
                setJoinGroupModalVisible(false);
                joinForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default Dashboard;
