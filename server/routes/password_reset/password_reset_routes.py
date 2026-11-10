import hashlib
import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException
from pydantic import ConfigDict

from db.database import get_db_connection
from services.email_service import send_password_reset_email
from services.sp_service import execute_stored_procedure
from utils.cryptography import encrypt_password

from routes.users.user_routes import (
    UserRequest,
    get_request_data,
    build_user_parameters,
    flatten_result_sets,
)

router = APIRouter(
    prefix="/password-reset",
    tags=["Password Reset"],
)


def get_password_reset_template():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT SUBJECT, BODY_HTML, BODY_TEXT
            FROM SPEND_EMAIL_TEMPLATES
            WHERE TEMPLATE_CODE = %s
              AND ENABLE_FLAG = 'Y'
            LIMIT 1
            """,
            ("PASSWORD_RESET",),
        )

        return cursor.fetchone()

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def get_sp_user_by_email(email: str):
    parameters = build_user_parameters(
        {
            "email": email,
            "action": "GetUserByEmail",
        }
    )

    result = execute_stored_procedure(
        "SPEND_USER_SP",
        parameters,
    )

    if str(result.get("status", "")).upper() not in ("S", "SUCCESS"):
        raise RuntimeError("Unable to retrieve user")

    users = flatten_result_sets(result)

    if not users:
        return None

    return {str(key).lower(): value for key, value in users[0].items()}


def get_sp_status(result: dict) -> bool:
    return str(result.get("status", "")).upper() in ("S", "SUCCESS")


@router.post("/forgot-password")
async def forgot_password(request: UserRequest):
    try:
        body = get_request_data(request)

        email = body.get("email")

        if not isinstance(email, str) or not email.strip():
            raise HTTPException(
                status_code=400,
                detail="Valid email is required",
            )

        email = email.strip().lower()

        # Check whether the email belongs to an active user.
        user = get_sp_user_by_email(email)

        # Return an error if the email is not registered.
        if not user:
            return {
                "status": "FAILED",
                "message": "This email address is not registered with SpendWise.",
            }

        template = get_password_reset_template()

        if not template:
            raise RuntimeError("Password reset email template is unavailable")

        user_id = user.get("user_id")
        user_name = user.get("user_name") or "User"

        if not user_id:
            raise RuntimeError("User ID was not returned")

        # Generate a secure, temporary reset token.
        reset_token = secrets.token_urlsafe(32)

        # Store only the SHA-256 hash of the token.
        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()

        create_parameters = build_user_parameters(
            {
                "user_id": user_id,
                "email": token_hash,
                "action": "CreatePasswordReset",
            }
        )

        create_result = execute_stored_procedure(
            "SPEND_USER_SP",
            create_parameters,
        )

        if not get_sp_status(create_result):
            raise RuntimeError("Unable to create password reset token")

        frontend_url = os.getenv("FRONTEND_URL")

        if not frontend_url:
            raise RuntimeError("FRONTEND_URL is not configured")

        reset_link = (
            f"{frontend_url.rstrip('/')}/reset-password?"
            f"{urlencode({'token': reset_token})}"
        )

        # Send reset email only for an existing user.
        await send_password_reset_email(
            recipient_email=email,
            user_name=user_name,
            reset_link=reset_link,
            email_template=template,
        )

        return {
            "status": "SUCCESS",
            "message": "Password reset link has been sent successfully. Please check your inbox.",
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Forgot password error:", str(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to process password reset request",
        )


@router.post("/reset-password")
async def reset_password(request: UserRequest):
    try:
        body = get_request_data(request)

        reset_token = body.get("token")
        new_password = body.get("new_password")

        if not isinstance(reset_token, str) or not reset_token.strip():
            raise HTTPException(
                status_code=400,
                detail="Reset token is required",
            )

        if not isinstance(new_password, str) or not new_password:
            raise HTTPException(
                status_code=400,
                detail="New password is required",
            )

        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()

        # Preserve the existing SpendWise password encryption approach.
        encrypted_password = encrypt_password(new_password)

        parameters = build_user_parameters(
            {
                "email": token_hash,
                "password_hash": encrypted_password,
                "action": "CompletePasswordReset",
            }
        )

        result = execute_stored_procedure(
            "SPEND_USER_SP",
            parameters,
        )

        if not get_sp_status(result):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired password reset link",
            )

        return {
            "status": "SUCCESS",
            "message": "Your password has been reset successfully",
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Reset password error:", str(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to reset password",
        )
