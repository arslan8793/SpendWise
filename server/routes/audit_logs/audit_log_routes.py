# import json
# import os
# from typing import Any

# from fastapi import APIRouter, Depends, HTTPException, Query, Request
# from mysql.connector import Error
# from pydantic import BaseModel, ConfigDict


# from services.sp_service import execute_stored_procedure
# from db.sp_response import validate_sp_response
# from utils.auth_dependencies import get_current_user
# from utils.cryptography import decryptAesText

# router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


# class AuditLogRequest(BaseModel):
#     model_config = ConfigDict(extra="forbid")
#     nonce: str
#     ciphertext: str


# def build_audit_log_parameters(
#     body: dict[str, Any],
#     user_id: int,
# ) -> list:
#     action = body.get("action")

#     parameters = [
#         body.get("audit_log_id"),
#         user_id,
#         body.get("action_code"),
#         body.get("table_name"),
#         body.get("record_id"),
#         body.get("old_value"),
#         body.get("new_value"),
#         body.get("ip_address"),
#         body.get("description"),
#         action,
#         None,  # P_DML_STATUS
#         None,  # P_DML_MESSAGE
#         None,  # P_DML_ID
#     ]

#     return parameters


# @router.post("/")
# async def manage_audit_log(
#     request: Request,
#     current_user: dict = Depends(get_current_user),
# ):
#     try:
#         # Reuse the same request decryption helper used by
#         # your existing encrypted User/Category/Transaction APIs.
#         body = await get_request_data(request)

#         parameters = build_audit_log_parameters(
#             body,
#             current_user["user_id"],
#         )

#         result = execute_stored_procedure(
#             "SPEND_AUDIT_LOG_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "data": result["data"],
#             "id": result["id"],
#         }

#     except HTTPException:
#         raise

#     except Error as e:
#         print(f"Audit log database error: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail="Failed to process audit log request",
#         )


# class AuditLogRequest(BaseModel):
#     model_config = ConfigDict(extra="forbid")
#     nonce: str
#     ciphertext: str


# def get_audit_log_request_data(request: AuditLogRequest) -> dict[str, Any]:
#     aes_key = os.getenv("REQUEST_AES_KEY")

#     if not aes_key:
#         raise HTTPException(
#             status_code=500,
#             detail="Request encryption key is not configured",
#         )

#     try:
#         aes_key_bytes = aes_key.encode("utf-8")

#         if len(aes_key_bytes) not in (16, 24, 32):
#             raise ValueError("Invalid AES key length")

#         decrypted_text = decryptAesText(
#             request.ciphertext,
#             request.nonce,
#             aes_key_bytes,
#         )

#         payload = json.loads(decrypted_text)

#     except Exception:
#         raise HTTPException(
#             status_code=400,
#             detail="Invalid or undecryptable request body",
#         )

#     if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
#         raise HTTPException(
#             status_code=400,
#             detail="Invalid decrypted request format",
#         )

#     return payload["data"]


# def build_audit_log_parameters(body: dict[str, Any]) -> list:
#     return [
#         body.get("audit_log_id"),  # P_AUDIT_LOG_ID
#         body.get("user_id"),  # P_USER_ID
#         body.get("action_code"),  # P_ACTION_CODE
#         body.get("table_name"),  # P_TABLE_NAME
#         body.get("record_id"),  # P_RECORD_ID
#         (
#             json.dumps(body.get("old_value"))
#             if body.get("old_value") is not None
#             else None
#         ),  # P_OLD_VALUE
#         (
#             json.dumps(body.get("new_value"))
#             if body.get("new_value") is not None
#             else None
#         ),  # P_NEW_VALUE
#         body.get("ip_address"),  # P_IP_ADDRESS
#         body.get("description"),  # P_DESCRIPTION
#         body.get("action"),  # P_ACTION
#         None,  # P_DML_STATUS OUT
#         None,  # P_DML_MESSAGE OUT
#         None,  # P_DML_ID OUT
#     ]


# def flatten_audit_log_result(result: dict) -> list:
#     result_sets = result.get("data", [])
#     return [record for result_set in result_sets for record in result_set]


# # CREATE AUDIT LOG API
# @router.post("/manageAuditLog")
# def manage_audit_log(
#     request: AuditLogRequest,
#     current_user: dict = Depends(get_current_user),
# ):
#     body = get_audit_log_request_data(request)

#     # Always use the authenticated user's ID.
#     body["user_id"] = current_user["user_id"]

#     parameters = build_audit_log_parameters(body)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_AUDIT_LOG_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": flatten_audit_log_result(result),
#         }

#     except HTTPException:
#         raise

#     except Exception as e:
#         print(f"Audit log processing error: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to process audit log request",
#         )


# # GET AUDIT LOG API


# @router.get("/getAuditLog")
# def get_audit_log(
#     nonce: str = Query(...),
#     ciphertext: str = Query(...),
#     current_user: dict = Depends(get_current_user),
# ):
#     # Decrypt the encrypted request.
#     key_value = os.getenv("REQUEST_AES_KEY")
#     if not key_value:
#         raise HTTPException(
#             status_code=500,
#             detail="Request encryption key is not configured",
#         )

#     try:
#         aes_key = key_value.encode("utf-8")
#         decrypted_text = decryptAesText(ciphertext, nonce, aes_key)
#         payload = json.loads(decrypted_text)

#         if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
#             raise HTTPException(
#                 status_code=400,
#                 detail="Invalid decrypted request format",
#             )

#         body = payload["data"]

#     except HTTPException:
#         raise
#     except Exception:
#         raise HTTPException(
#             status_code=400,
#             detail="Unable to decrypt audit log request",
#         )

#     # This endpoint is exclusively for retrieving audit logs.
#     if body.get("action") != "GetAuditLog":
#         raise HTTPException(
#             status_code=400,
#             detail="Action must be GetAuditLog",
#         )

#     # Restrict retrieval to the authenticated user's audit logs.
#     body["user_id"] = current_user["user_id"]

#     parameters = build_audit_log_parameters(body)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_AUDIT_LOG_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         records = [
#             record for result_set in result.get("data", []) for record in result_set
#         ]

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": records,
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Audit log retrieval error: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to retrieve audit logs",
#         )


import json
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from services.sp_service import execute_stored_procedure
from db.sp_response import validate_sp_response
from utils.auth_dependencies import get_current_user
from utils.cryptography import decryptAesText

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str
    ciphertext: str


def decrypt_audit_log_request(
    nonce: str,
    ciphertext: str,
) -> dict[str, Any]:
    """Decrypt and validate an encrypted audit log request."""

    key_value = os.getenv("REQUEST_AES_KEY")

    if not key_value:
        raise HTTPException(
            status_code=500,
            detail="Request encryption key is not configured",
        )

    try:
        aes_key = key_value.encode("utf-8")

        if len(aes_key) not in (16, 24, 32):
            raise ValueError("Invalid AES key length")

        decrypted_text = decryptAesText(
            ciphertext,
            nonce,
            aes_key,
        )

        payload = json.loads(decrypted_text)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or undecryptable audit log request",
        )

    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid decrypted request format",
        )

    return payload["data"]


def build_audit_log_parameters(
    body: dict[str, Any],
    user_id: int,
) -> list:
    """Build parameters in SPEND_AUDIT_LOG_SP parameter order."""

    return [
        body.get("audit_log_id"),  # P_AUDIT_LOG_ID
        user_id,  # P_USER_ID - authenticated user
        body.get("action_code"),  # P_ACTION_CODE
        body.get("table_name"),  # P_TABLE_NAME
        body.get("record_id"),  # P_RECORD_ID
        (
            json.dumps(body.get("old_value"))
            if body.get("old_value") is not None
            else None
        ),  # P_OLD_VALUE
        (
            json.dumps(body.get("new_value"))
            if body.get("new_value") is not None
            else None
        ),  # P_NEW_VALUE
        body.get("ip_address"),  # P_IP_ADDRESS
        body.get("description"),  # P_DESCRIPTION
        body.get("action"),  # P_ACTION
        None,  # P_DML_STATUS OUT
        None,  # P_DML_MESSAGE OUT
        None,  # P_DML_ID OUT
    ]


def flatten_audit_log_result(result: dict) -> list:
    """Flatten stored procedure result sets into one records list."""

    return [
        record for result_set in (result.get("data") or []) for record in result_set
    ]


# CREATE AUDIT LOG API
@router.post("/manageAuditLog")
def manage_audit_log(
    request: AuditLogRequest,
    current_user: dict = Depends(get_current_user),
):
    body = decrypt_audit_log_request(
        request.nonce,
        request.ciphertext,
    )

    if body.get("action") != "CreateAuditLog":
        raise HTTPException(
            status_code=400,
            detail="Action must be CreateAuditLog",
        )

    parameters = build_audit_log_parameters(
        body,
        current_user["user_id"],
    )

    try:
        result = execute_stored_procedure(
            "SPEND_AUDIT_LOG_SP",
            parameters,
        )

        validate_sp_response(result)

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": flatten_audit_log_result(result),
        }

    except HTTPException:
        raise

    except Exception as e:
        print(f"Audit log creation error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to create audit log",
        )


# GET AUDIT LOG API
# @router.get("/getAuditLog")
# def get_audit_log(
#     nonce: str = Query(...),
#     ciphertext: str = Query(...),
#     current_user: dict = Depends(get_current_user),
# ):
#     role = str(current_user.get("role_code") or current_user.get("role") or "").upper()

#     if role != "ADMIN":
#         raise HTTPException(
#             status_code=403,
#             detail="Only administrators can view all audit logs",
#         )

#     body = decrypt_audit_log_request(nonce, ciphertext)

#     if body.get("action") != "GetAuditLog":
#         raise HTTPException(
#             status_code=400,
#             detail="Action must be GetAuditLog",
#         )

#     # NULL means retrieve records across all users.
#     parameters = build_audit_log_parameters(body, None)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_AUDIT_LOG_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": flatten_audit_log_result(result),
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Audit log retrieval error: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to retrieve audit logs",
#         )


@router.get("/getAuditLog")
def get_audit_log(
    nonce: str = Query(...),
    ciphertext: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    # Only administrators can view all audit logs.
    role = str(current_user.get("role_code") or current_user.get("role") or "").upper()

    if role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view all audit logs",
        )

    body = decrypt_audit_log_request(nonce, ciphertext)

    if body.get("action") != "GetAuditLog":
        raise HTTPException(
            status_code=400,
            detail="Action must be GetAuditLog",
        )

    # None means no user-specific filter.
    parameters = build_audit_log_parameters(body, None)

    try:
        result = execute_stored_procedure(
            "SPEND_AUDIT_LOG_SP",
            parameters,
        )

        validate_sp_response(result)

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": flatten_audit_log_result(result),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Audit log retrieval error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve audit logs",
        )
