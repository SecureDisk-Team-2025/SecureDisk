"""
邮箱认证模块
"""
import secrets
import string
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

def get_db():
    """获取数据库实例"""
    from models import db
    return db

def get_email_code_model():
    """获取EmailCode模型"""
    from models import EmailCode
    return EmailCode

class EmailAuth:
    """邮箱认证类"""
    
    @staticmethod
    def generate_code(length: int = 6) -> str:
        """
        生成数字验证码
        
        Args:
            length: 验证码长度
        
        Returns:
            str: 验证码
        """
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    @staticmethod
    def create_email_code(email: str, purpose: str = 'login', expires_minutes: int = 10) -> str:
        """
        创建邮箱验证码记录
        
        Args:
            email: 邮箱地址
            purpose: 用途（login, recover）
            expires_minutes: 过期时间（分钟）
        
        Returns:
            str: 验证码
        """
        from models import EmailCode, db
        
        code = EmailAuth.generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
        
        # 使旧验证码失效
        EmailCode.query.filter_by(email=email, purpose=purpose, used=False).update({'used': True})
        
        email_code = EmailCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            used=False
        )
        
        db.session.add(email_code)
        db.session.commit()
        
        # 发送邮件验证码
        try:
            EmailAuth.send_email_code(email, code, purpose)
            print(f"[EMAIL CODE] 验证码已发送到 {email}: {code}")
        except Exception as e:
            # 如果发送失败，仍然打印到控制台以便测试
            print(f"[EMAIL CODE] 邮件发送失败，验证码: {code} (Purpose: {purpose}, Expires: {expires_at})")
            print(f"[ERROR] 邮件发送错误: {str(e)}")
        
        return code
    
    @staticmethod
    def verify_email_code(email: str, code: str, purpose: str = 'login') -> bool:
        """
        验证邮箱验证码
        
        Args:
            email: 邮箱地址
            code: 验证码
            purpose: 用途
        
        Returns:
            bool: 是否有效
        """
        from models import EmailCode, db
        
        email_code = EmailCode.query.filter_by(
            email=email,
            code=code,
            purpose=purpose,
            used=False
        ).first()
        
        if not email_code:
            return False
        
        if datetime.utcnow() > email_code.expires_at:
            return False
        
        # 标记为已使用
        email_code.used = True
        db.session.commit()
        
        return True
    
    @staticmethod
    def send_email_code(email: str, code: str, purpose: str = 'login'):
        """
        发送邮箱验证码到QQ邮箱
        
        Args:
            email: 接收邮箱地址
            code: 验证码
            purpose: 用途（login/recover）
        """
        # 从环境变量或配置文件读取QQ邮箱配置
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.qq.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.getenv('SMTP_USER', '')  # QQ邮箱账号
        smtp_password = os.getenv('SMTP_PASSWORD', '')  # QQ邮箱授权码（不是密码）
        
        # 如果没有配置邮箱，则只打印日志（演示模式）
        if not smtp_user or not smtp_password:
            print(f"[EMAIL] 未配置SMTP，验证码: {code}")
            print(f"[EMAIL] To: {email}")
            print(f"[EMAIL] Subject: 网络加密磁盘系统 - 验证码")
            print(f"[EMAIL] Message: 您的验证码是：{code}，有效期10分钟。")
            return
        
        # 构建邮件内容
        subject = "网络加密磁盘系统 - 验证码" if purpose == 'login' else "网络加密磁盘系统 - 密钥找回验证码"
        
        # HTML格式的邮件内容
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #667eea; text-align: center;">网络加密磁盘系统</h2>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="font-size: 16px; margin: 10px 0;">您的验证码是：</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; padding: 10px 20px; background-color: white; border-radius: 5px; display: inline-block;">
                            {code}
                        </span>
                    </div>
                    <p style="font-size: 14px; color: #666; margin: 10px 0;">
                        验证码有效期：<strong>10分钟</strong>
                    </p>
                </div>
                <p style="font-size: 12px; color: #999; text-align: center; margin-top: 30px;">
                    此邮件由系统自动发送，请勿回复。
                </p>
            </div>
        </body>
        </html>
        """
        
        # 纯文本格式的邮件内容
        text_content = f"""
        网络加密磁盘系统
        
        您的验证码是：{code}
        
        验证码有效期：10分钟
        
        此邮件由系统自动发送，请勿回复。
        """
        
        # 创建邮件对象
        msg = MIMEMultipart('alternative')
        msg['From'] = f"网络加密磁盘系统 <{smtp_user}>"
        msg['To'] = email
        msg['Subject'] = subject
        
        # 添加文本和HTML内容
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        
        # 发送邮件
        try:
            # 使用TLS连接（端口587）
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()  # 启用TLS加密
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [email], msg.as_string())
            server.quit()
            print(f"[EMAIL] 邮件已成功发送到 {email}")
        except smtplib.SMTPAuthenticationError:
            raise Exception("QQ邮箱认证失败，请检查邮箱账号和授权码是否正确")
        except smtplib.SMTPException as e:
            raise Exception(f"邮件发送失败: {str(e)}")
        except Exception as e:
            raise Exception(f"邮件发送错误: {str(e)}")
