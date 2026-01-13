# QQ邮箱SMTP配置说明

## 步骤1：获取QQ邮箱授权码

QQ邮箱不能直接使用登录密码发送邮件，需要使用**授权码**。

### 获取授权码步骤：

1. **登录QQ邮箱**
   - 访问 https://mail.qq.com
   - 使用QQ账号登录

2. **进入邮箱设置**
   - 点击右上角的"设置"
   - 选择"账户"标签页

3. **开启SMTP服务**
   - 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
   - 确保"POP3/SMTP服务"和"IMAP/SMTP服务"已开启
   - 如果未开启，点击"开启"按钮

4. **生成授权码**
   - 点击"生成授权码"按钮
   - 按照提示完成验证（可能需要手机验证）
   - **复制生成的授权码**（16位字符，类似：abcdefghijklmnop）
   - ⚠️ **重要**：授权码只显示一次，请妥善保存

## 步骤2：配置项目

### 方法1：使用环境变量文件（推荐）

1. **创建配置文件**
   ```bash
   cd backend
   copy .env.example .env
   ```
   或者在Windows PowerShell中：
   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

2. **编辑 .env 文件**
   打开 `backend/.env` 文件，填写你的QQ邮箱信息：
   ```env
   SMTP_SERVER=smtp.qq.com
   SMTP_PORT=587
   SMTP_USER=123456789@qq.com
   SMTP_PASSWORD=你的授权码
   ```
   
   **注意**：
   - `SMTP_USER` 填写完整的QQ邮箱地址（如：123456789@qq.com）
   - `SMTP_PASSWORD` 填写刚才获取的授权码（不是QQ密码！）

### 方法2：直接在代码中配置（不推荐，仅用于测试）

如果不想使用配置文件，可以直接修改 `backend/auth/email.py` 文件中的默认值：

```python
smtp_user = os.getenv('SMTP_USER', 'your_email@qq.com')  # 改为你的QQ邮箱
smtp_password = os.getenv('SMTP_PASSWORD', 'your_auth_code')  # 改为你的授权码
```

## 步骤3：测试邮件发送

1. **启动后端服务器**
   ```bash
   cd backend
   python app.py
   ```

2. **测试发送验证码**
   - 打开前端页面
   - 在登录页面选择"邮箱验证码登录"
   - 输入你的QQ邮箱地址
   - 点击"发送验证码"
   - 检查你的QQ邮箱收件箱（包括垃圾邮件文件夹）

## 常见问题

### 1. 提示"认证失败"
- ✅ 检查邮箱地址是否正确（必须是完整的邮箱地址）
- ✅ 确认使用的是**授权码**而不是QQ密码
- ✅ 确认授权码没有过期（授权码长期有效，除非重新生成）

### 2. 提示"连接失败"
- ✅ 检查网络连接
- ✅ 确认SMTP服务器地址：`smtp.qq.com`
- ✅ 确认端口：`587`（TLS）或 `465`（SSL）

### 3. 收不到邮件
- ✅ 检查垃圾邮件文件夹
- ✅ 确认邮箱地址输入正确
- ✅ 查看后端控制台的错误信息
- ✅ 确认QQ邮箱的SMTP服务已开启

### 4. 授权码在哪里找？
- 登录QQ邮箱 → 设置 → 账户 → POP3/IMAP/SMTP服务 → 生成授权码

## 安全提示

1. **不要将授权码提交到Git仓库**
   - `.env` 文件已在 `.gitignore` 中，不会被提交
   - 如果使用其他方式配置，请确保不泄露授权码

2. **定期更换授权码**
   - 如果怀疑授权码泄露，可以在QQ邮箱中重新生成

3. **使用环境变量**
   - 生产环境建议使用环境变量而不是配置文件

## 其他邮箱配置

如果需要使用其他邮箱服务商，可以参考以下配置：

### 163邮箱
```env
SMTP_SERVER=smtp.163.com
SMTP_PORT=465
SMTP_USER=your_email@163.com
SMTP_PASSWORD=your_auth_code
```

### Gmail（需要应用专用密码）
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 企业邮箱
根据企业邮箱服务商提供的SMTP配置填写。
