import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, ConfigDict

# import bcrypt
# from utils.cryptography import hash_password, decryptAesText
from utils.cryptography import encrypt_password, decryptAesText
from services.sp_service import execute_stored_procedure
from db.sp_response import validate_sp_response
from utils.auth_dependencies import (
    get_current_user,
    get_current_user_optional,
    require_admin,
)

router = APIRouter(prefix="/users", tags=["Users"])


class UserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nonce: str
    ciphertext: str


def build_user_parameters(body: dict[str, Any]) -> list:
    return [
        body.get("user_id"),  # P_USER_ID
        body.get("user_name"),  # P_USER_NAME
        body.get("email"),  # P_EMAIL
        body.get("password_hash"),  # P_PASSWORD_HASH
        body.get("role_code"),  # P_ROLE_CODE
        body.get("created_by"),  # P_CREATED_BY
        body.get("last_updated_by"),  # P_LAST_UPDATED_BY
        body.get("last_update_login"),  # P_LAST_UPDATE_LOGIN
        body.get("enable_flag"),  # P_ENABLE_FLAG
        body.get("action"),  # P_ACTION
        None,  # P_DML_STATUS OUT
        None,  # P_DML_MESSAGE OUT
        None,  # P_DML_ID OUT
    ]


def get_request_data(request: UserRequest) -> dict[str, Any]:
    key_value = os.getenv("REQUEST_AES_KEY")

    if not key_value:
        raise HTTPException(
            status_code=500,
            detail="Request encryption key is not configured",
        )

    try:
        # aes_key = base64.b64decode(key_value, validate=True)
        aes_key = key_value.encode("utf-8")

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


def flatten_result_sets(result: dict) -> list:
    result_sets = result.get("data", [])
    # Combine records from all result sets into a single list.
    return [record for result_set in result_sets for record in result_set]


def remove_sensitive_fields(records: list) -> list:
    # Create a new list containing records without sensitive fields.
    safe_records = []

    for record in records:
        # Handle dictionary records returned by the stored procedure.
        if not isinstance(record, dict):
            safe_records.append(record)
            continue

        # Exclude password hash fields before returning records to the client.
        safe_records.append(
            {
                key: value
                for key, value in record.items()
                if "password_hash" not in str(key).lower()
            }
        )

    return safe_records


# GET USER API
@router.get("/getUser")
def get_user(request: UserRequest):
    # body = request.data.copy()
    body = get_request_data(request)
    body["action"] = "GetUser"

    parameters = build_user_parameters(body)

    try:
        result = execute_stored_procedure(
            "SPEND_USER_SP",
            parameters,
        )

        validate_sp_response(result)

        result_sets = result.get("data", [])
        records = [record for result_set in result_sets for record in result_set]

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": records,
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to process user request",
        )


# only for admin module
@router.get("/getAllUsers")
def get_all_users(current_user: dict = Depends(require_admin)):
    body = {"action": "GetAllUsers"}

    parameters = build_user_parameters(body)

    try:
        result = execute_stored_procedure(
            "SPEND_USER_SP",
            parameters,
        )

        validate_sp_response(result)

        result_sets = result.get("data", [])
        records = [record for result_set in result_sets for record in result_set]

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": records,
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve users",
        )


@router.post("/updateUserStatus")
def update_user_status(
    request: UserRequest, current_user: dict = Depends(require_admin)
):
    # Decrypt the incoming request using your existing helper
    body = get_request_data(request)

    user_id = body.get("user_id")
    enable_flag = body.get("enable_flag")

    # Validate user ID
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    # Validate status flag
    if enable_flag not in ("Y", "N"):
        raise HTTPException(status_code=400, detail="enable_flag must be Y or N")

    # Prevent an Admin from deactivating their own account
    if enable_flag == "N" and int(user_id) == int(current_user["user_id"]):
        raise HTTPException(
            status_code=400, detail="You cannot deactivate your own account."
        )

    # Build the stored procedure request
    body["action"] = "UpdateUserStatus"
    body["user_id"] = user_id
    body["enable_flag"] = enable_flag
    body["last_updated_by"] = current_user["user_id"]

    # Execute stored procedure
    parameters = build_user_parameters(body)

    result = execute_stored_procedure("SPEND_USER_SP", parameters)

    # Return the stored procedure result
    if result.get("status") != "SUCCESS":
        raise HTTPException(
            status_code=400,
            detail=result.get("message", "Unable to update user status"),
        )

    return {
        "status": result.get("status"),
        "message": result.get("message"),
        "id": result.get("id"),
        "data": result.get("data", []),
    }


# REGISTER / UPDATE USER API
@router.post("/register")
def register_user(
    request: UserRequest, current_user: dict = Depends(get_current_user_optional)
):
    body = get_request_data(request)

    action = body.get("action")

    allowed_actions = ("RegisterUser", "UpdateUser")

    if action not in allowed_actions:
        raise HTTPException(status_code=400, detail="Invalid action")

    if action == "RegisterUser":

        password = body.get("password")

        if not isinstance(password, str) or not password:
            raise HTTPException(status_code=400, detail="Password is required")

        try:
            encrypted_password = encrypt_password(password)
        except Exception:
            raise HTTPException(status_code=500, detail="Unable to process password")

        body["password_hash"] = encrypted_password
        body.pop("password", None)

        body["created_by"] = 0
        body["last_updated_by"] = 0

    elif action == "UpdateUser":

        # Authentication is mandatory for profile updates.
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user_name = body.get("user_name")
        email = body.get("email")

        if not isinstance(user_name, str) or not user_name.strip():
            raise HTTPException(status_code=400, detail="User name is required")

        if not isinstance(email, str) or not email.strip():
            raise HTTPException(status_code=400, detail="Email is required")

        body["user_id"] = current_user["user_id"]
        body["last_updated_by"] = current_user["user_id"]

        body.pop("password", None)
        body.pop("password_hash", None)
        body.pop("role_code", None)
        body.pop("enable_flag", None)

    parameters = build_user_parameters(body)

    try:
        result = execute_stored_procedure("SPEND_USER_SP", parameters)

        validate_sp_response(result)

        records = flatten_result_sets(result)

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": remove_sensitive_fields(records),
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(status_code=500, detail="Unable to process user request")


# GET LOGGED-IN USER PROFILE API
@router.get("/profile")
def get_user_profile(
    current_user: dict = Depends(get_current_user),
):
    # print("get_current_user", get_current_user)
    print("get_current_user", current_user)
    body = {
        "user_id": current_user["user_id"],
        "action": "GetUser",
    }

    parameters = build_user_parameters(body)

    try:
        result = execute_stored_procedure(
            "SPEND_USER_SP",
            parameters,
        )

        validate_sp_response(result)
        records = flatten_result_sets(result)

        return {
            "status": result["status"],
            "message": result["message"],
            "data": remove_sensitive_fields(records),
        }

    except HTTPException:
        raise

    # except Exception:
    except Exception as exc:
        print("PROFILE API ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve user profile",
        )


# @router.post("/forgot-password")
# def forgot_password(request: UserRequest):

#     body = get_request_data(request)

#     email = body.get("email")
#     new_password = body.get("new_password")

#     if not isinstance(email, str) or not email.strip():
#         raise HTTPException(status_code=400, detail="Email is required")

#     if not isinstance(new_password, str) or not new_password:
#         raise HTTPException(status_code=400, detail="New password is required")

#     try:
#         password_hash = encrypt_password(new_password)
#     except Exception:
#         raise HTTPException(status_code=500, detail="Unable to process password")

#     parameters_body = {
#         "email": email.strip(),
#         "password_hash": password_hash,
#         "action": "ResetPassword",
#         "last_updated_by": 0,
#         "last_update_login": 0,
#     }

#     try:
#         result = execute_stored_procedure(
#             "SPEND_USER_SP", build_user_parameters(parameters_body)
#         )

#         validate_sp_response(result)

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#         }

#     except HTTPException:
#         raise

#     except Exception:
#         raise HTTPException(status_code=500, detail="Unable to reset password")
