import os
import html
from email.message import EmailMessage
from pathlib import Path
import aiosmtplib
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

load_dotenv()


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")


async def send_password_reset_email(
    recipient_email: str,
    user_name: str,
    reset_link: str,
    email_template: dict,
):
    """
    Send password reset email using the database email template.
    """

    # Validate SMTP configuration
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        raise ValueError("Gmail SMTP configuration is missing")

    if not email_template:
        raise ValueError("Password reset email template not found")

    subject = email_template.get("SUBJECT")
    body_html = email_template.get("BODY_HTML")
    body_text = email_template.get("BODY_TEXT")

    if not subject or not body_html:
        raise ValueError("Email template subject or HTML is missing")

    # Escape user-provided content before inserting into HTML
    safe_user_name = html.escape(user_name or "User")

    # Dynamic placeholders
    html_placeholders = {
        "{{USER_NAME}}": safe_user_name,
        "{{RESET_LINK}}": html.escape(reset_link, quote=True),
        "{{EXPIRY_MINUTES}}": "15",
    }

    text_placeholders = {
        "{{USER_NAME}}": user_name or "User",
        "{{RESET_LINK}}": reset_link,
        "{{EXPIRY_MINUTES}}": "15",
    }

    # Replace placeholders in subject and HTML
    for placeholder, value in html_placeholders.items():
        subject = subject.replace(placeholder, value)
        body_html = body_html.replace(placeholder, value)

    # Replace placeholders in plain text
    if body_text:
        for placeholder, value in text_placeholders.items():
            body_text = body_text.replace(placeholder, value)

    # Create email
    message = EmailMessage()

    message["Subject"] = subject
    message["From"] = SMTP_EMAIL
    message["To"] = recipient_email

    # Plain-text alternative
    message.set_content(
        body_text
        or f"Hello {user_name or 'User'},\n\n"
        f"Reset your SpendWise password using this link:\n"
        f"{reset_link}\n\n"
        "This link expires in 15 minutes."
    )

    # HTML version from database
    message.add_alternative(body_html, subtype="html")

    # Send using Gmail SMTP
    await aiosmtplib.send(
        message,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        username=SMTP_EMAIL,
        password=SMTP_APP_PASSWORD,
        use_tls=(SMTP_PORT == 465),
        start_tls=(SMTP_PORT == 587),
    )
