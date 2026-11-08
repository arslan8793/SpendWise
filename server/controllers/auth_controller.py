import json
import os
from typing import Any

import traceback

# from fastapi import APIRouter, HTTPException, Depends
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict

# from jwt.exceptions import InvalidTokenError

from fastapi import APIRouter, HTTPException, Depends
from utils.auth_dependencies import get_current_user


from routes.users.user_routes import build_user_parameters
from services.sp_service import execute_stored_procedure

# from utils.cryptography import verify_password, decryptAesText
from utils.cryptography import decrypt_password, decryptAesText

# from utils.jwt_utils import create_access_token, verify_access_token
from utils.jwt_utils import create_access_token

# security = HTTPBearer()
router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str
    ciphertext: str


def get_login_request_data(request: LoginRequest) -> dict[str, Any]:
    aes_key_value = os.getenv("REQUEST_AES_KEY")

    if not aes_key_value:
        raise HTTPException(
            status_code=500,
            detail="Request encryption key is not configured",
        )

    try:
        aes_key = aes_key_value.encode("utf-8")

        if len(aes_key) not in (16, 24, 32):
            raise ValueError("Invalid AES key length")

        decrypted_text = decryptAesText(
            request.ciphertext,
            request.nonce,
            aes_key,
        )

        payload = json.loads(decrypted_text)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or undecryptable request body",
        )

    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid decrypted request format",
        )

    return payload["data"]


@router.get("/me")
def get_logged_in_user(
    current_user: dict = Depends(get_current_user),
):
    return {
        "status": "SUCCESS",
        "message": "Token verified successfully",
        "data": current_user,
    }


@router.post("/login")
def login(request: LoginRequest):
    # Decrypt the request before reading login credentials.
    body = get_login_request_data(request)

    email = body.get("email")
    password = body.get("password")

    if not isinstance(email, str) or not email.strip():
        raise HTTPException(
            status_code=400,
            detail="Email is required",
        )

    if not isinstance(password, str) or not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required",
        )

    # Reuse the existing dynamic parameter builder.
    login_body = {
        "email": email.strip().lower(),
        "action": "LoginUser",
    }

    parameters = build_user_parameters(login_body)

    # try:
    #     result = execute_stored_procedure(
    #         "SPEND_USER_SP",
    #         parameters,
    #     )
    # except Exception:
    #     raise HTTPException(
    #         status_code=500,
    #         detail="Unable to process login request",
    #     )
    try:
        result = execute_stored_procedure(
            "SPEND_USER_SP",
            parameters,
        )

    except Exception as error:
        print("LOGIN STORED PROCEDURE ERROR:", str(error))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail="Unable to process login request",
        ) from error

    status = str(result.get("status", "")).strip().upper()

    if status not in ("S", "SUCCESS"):
        raise HTTPException(
            status_code=401,
            detail=result.get("message") or "Invalid email or password",
        )

    result_sets = result.get("data", [])
    records = [record for result_set in result_sets for record in result_set]

    if not records:
        raise HTTPException(
            status_code=401,
            detail=result.get("message") or "Invalid email or password",
        )

    # Normalize database column names.
    user = {str(key).lower(): value for key, value in records[0].items()}

    # password_hash = user.get("password_hash")
    # user_id = user.get("user_id")
    # role_code = user.get("role_code")

    # if not isinstance(password_hash, str) or user_id is None:
    #     raise HTTPException(
    #         status_code=500,
    #         detail="Required login information is missing",
    #     )

    # # Verify the password against the stored bcrypt hash.
    # if not verify_password(password, password_hash):
    #     raise HTTPException(
    #         status_code=401,
    #         detail="Invalid email or password",
    #     )

    encrypted_password = user.get("password_hash")
    user_id = user.get("user_id")
    role_code = user.get("role_code")

    if not isinstance(role_code, str) or role_code.upper() not in ("ADMIN", "USER"):
        raise HTTPException(
            status_code=403,
            detail="Invalid user role",
        )

    role_code = role_code.upper()

    if not isinstance(encrypted_password, str) or user_id is None:
        raise HTTPException(
            status_code=500,
            detail="Required login information is missing",
        )

    # Decrypt the password stored in the database.
    try:
        stored_password = decrypt_password(encrypted_password)
    except Exception:
        # Do not expose decryption details to the client.
        raise HTTPException(
            status_code=500,
            detail="Unable to process stored credentials",
        )

    # Compare the entered password with the decrypted password.
    if password != stored_password:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    try:
        access_token = create_access_token(user_id, role_code)
    except (RuntimeError, ValueError):
        raise HTTPException(
            status_code=500,
            detail="Authentication configuration error",
        )

    # Return safe user details and the JWT.
    return {
        "status": "SUCCESS",
        "message": "Login successful",
        "id": user_id,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": user_id,
                "user_name": user.get("user_name"),
                "email": user.get("email"),
                "role_code": role_code,
            },
        },
    }
