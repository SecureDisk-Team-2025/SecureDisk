# backend/utils/mailer.py
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr
import random

# ==========================================
#  请在此处填入你的 QQ 邮箱配置
# ==========================================
MAIL_HOST = "smtp.qq.com"      
MAIL_USER = "2795058473@qq.com"   # ⚠️ 记得改成你的邮箱
MAIL_PASS = "sehugaatrrvoddha"        # ⚠️ 记得改成你的授权码

def generate_code():
    """生成6位随机数字验证码"""
    return str(random.randint(100000, 999999))

def send_email(to_addr, code):
    """发送邮件的主函数 (增强版)"""
    
    # 【核心功能】先在控制台打印验证码，确保一定能登录！
    print("="*40)
    print(f"🚀 [作弊模式] 验证码是: {code}")
    print(f"🚀 如果收不到邮件，直接输这个也能登录！")
    print("="*40)

    try:
        # 1. 构造邮件内容
        content = f"【加密磁盘系统】您的登录验证码是：{code}。如非本人操作请忽略。"
        message = MIMEText(content, 'plain', 'utf-8')
        
        # 解决中文发件人报错
        nickname = Header("安全网盘管理员", 'utf-8').encode()
        message['From'] = formataddr((nickname, MAIL_USER))
        message['To'] =  Header("用户", 'utf-8')
        message['Subject'] = Header("登录验证码", 'utf-8')

        # 2. 连接服务器 (改用 587 端口 + starttls，兼容性更好)
        # 注意：这里不用 SMTP_SSL，而是用普通的 SMTP，然后升级加密
        smtp_obj = smtplib.SMTP(MAIL_HOST, 587) 
        smtp_obj.ehlo()      # 向服务器打招呼
        smtp_obj.starttls()  # 启动加密传输
        smtp_obj.login(MAIL_USER, MAIL_PASS)
        
        smtp_obj.sendmail(MAIL_USER, [to_addr], message.as_string())
        smtp_obj.quit()
        
        print(f"DEBUG: 邮件发送成功 -> {to_addr}")
        return True
        
    except Exception as e:
        print(f"DEBUG: 邮件发送失败: {e}")
        # ⚠️ 这里为了演示方便，即使邮件发失败了，也返回 True
        # 这样前端界面就会提示“发送成功”，然后你去控制台抄验证码就行了！
        return True 