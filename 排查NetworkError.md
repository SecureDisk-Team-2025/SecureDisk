# NetworkError 排查指南

## 问题现象
前端显示 NetworkError，无法加载文件列表、用户组列表，无法上传文件。

## 原因分析
NetworkError 通常表示前端无法连接到后端服务器。

## 解决步骤

### 步骤1：确认后端服务器正在运行

1. **检查后端终端窗口**
   - 应该看到类似输出：
     ```
     数据库初始化完成
     服务器启动在 http://0.0.0.0:5000
      * Running on http://127.0.0.1:5000
     ```

2. **如果没有运行，启动后端**
   ```bash
   cd backend
   python app.py
   ```

### 步骤2：测试后端连接

在浏览器地址栏输入：
```
http://localhost:5000/api/health
```

**应该看到：**
```json
{"status": "ok"}
```

**如果看不到：**
- 后端没有运行 → 启动后端
- 端口被占用 → 检查是否有其他程序占用5000端口
- 防火墙阻止 → 允许Python通过防火墙

### 步骤3：检查端口占用

**Windows PowerShell:**
```powershell
netstat -ano | findstr :5000
```

如果看到输出，说明端口被占用。可以：
- 关闭占用端口的程序
- 或者修改后端端口（不推荐）

### 步骤4：检查防火墙

1. 打开 Windows 防火墙设置
2. 允许 Python 通过防火墙
3. 或者临时关闭防火墙测试

### 步骤5：检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 查看 Console（控制台）标签
3. 查看 Network（网络）标签
4. 刷新页面，查看请求状态

**正常情况：**
- 请求状态应该是 200（成功）
- 或者 401（未授权，但至少连接成功）

**异常情况：**
- 请求状态是 failed 或 pending
- 错误信息显示 "Network Error" 或 "ERR_NETWORK"

### 步骤6：检查CORS配置

后端已经配置了CORS，但如果还有问题，可以：

1. **检查后端终端是否有CORS错误**
2. **查看浏览器控制台的CORS错误信息**

### 步骤7：使用代理（如果直接连接失败）

如果直接连接 `http://localhost:5000` 失败，可以：

1. **使用package.json中的proxy配置**
   - 前端已经配置了 `"proxy": "http://localhost:5000"`
   - 但需要重启前端服务器

2. **重启前端服务器**
   ```bash
   # 停止当前服务器（Ctrl+C）
   cd frontend
   npm start
   ```

## 快速检查清单

- [ ] 后端服务器正在运行（`python backend/app.py`）
- [ ] 后端显示 "服务器启动在 http://0.0.0.0:5000"
- [ ] 可以访问 `http://localhost:5000/api/health`
- [ ] 浏览器控制台没有CORS错误
- [ ] 防火墙允许Python连接
- [ ] 端口5000没有被其他程序占用

## 常见错误信息

### 1. "Network Error" 或 "ERR_NETWORK"
**原因：** 无法连接到后端服务器
**解决：** 确保后端正在运行

### 2. "CORS policy" 错误
**原因：** 跨域请求被阻止
**解决：** 后端已配置CORS，检查后端是否正常运行

### 3. "Connection refused"
**原因：** 后端服务器没有运行
**解决：** 启动后端服务器

### 4. "Timeout"
**原因：** 请求超时
**解决：** 检查网络连接，后端是否响应慢

## 测试命令

### 测试后端API（使用curl或PowerShell）

**PowerShell:**
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health
```

**应该返回：**
```
StatusCode        : 200
Content           : {"status":"ok"}
```

## 如果还是不行

1. **检查后端日志**
   - 查看后端终端窗口的错误信息
   - 复制错误信息

2. **检查前端日志**
   - 打开浏览器控制台（F12）
   - 查看Console和Network标签
   - 复制错误信息

3. **提供以下信息：**
   - 后端终端显示的内容
   - 浏览器控制台的错误信息
   - 访问 `http://localhost:5000/api/health` 的结果
