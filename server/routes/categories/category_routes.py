import json
import os
from typing import Any

from fastapi import Query, APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from services.sp_service import execute_stored_procedure
from utils.auth_dependencies import get_current_user
from utils.cryptography import decryptAesText
from db.sp_response import validate_sp_response

router = APIRouter(prefix="/categories", tags=["Categories"])


class CategoryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str
    ciphertext: str


def get_category_request_data(request: CategoryRequest) -> dict[str, Any]:
    # Load the same AES key used by the existing encrypted APIs.
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

        # Decrypt the incoming request body.
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


# def build_category_parameters(body: dict[str, Any], current_user_id: int) -> list:
#     # Build parameters dynamically in the stored procedure's expected order.
#     return [
#         body.get("category_id"),  # P_CATEGORY_ID
#         current_user_id,  # P_USER_ID
#         body.get("category_name"),  # P_CATEGORY_NAME
#         body.get("category_type"),  # P_CATEGORY_TYPE
#         body.get("description"),  # P_DESCRIPTION
#         body.get("enable_flag"),  # P_ENABLE_FLAG
#         body.get("created_by"),  # P_CREATED_BY
#         body.get("last_updated_by"),  # P_LAST_UPDATED_BY
#         body.get("last_update_login"),  # P_LAST_UPDATE_LOGIN
#         body.get("action"),  # P_ACTION
#         None,  # P_DML_STATUS OUT
#         None,  # P_DML_MESSAGE OUT
#         None,  # P_DML_ID OUT
#     ]


def build_category_parameters(
    body: dict[str, Any],
    current_user_id: int,
) -> list:
    action = body.get("action")

    return [
        body.get("category_id"),  # P_CATEGORY_ID
        body.get("category_name"),  # P_CATEGORY_NAME
        body.get("category_type"),  # P_CATEGORY_TYPE
        body.get("description"),  # P_DESCRIPTION
        body.get("enable_flag"),  # P_ENABLE_FLAG
        current_user_id if action == "CreateCategory" else None,  # P_CREATED_BY
        current_user_id,  # P_LAST_UPDATED_BY
        current_user_id,  # P_LAST_UPDATE_LOGIN
        action,  # P_ACTION
        None,  # P_DML_STATUS OUT
        None,  # P_DML_MESSAGE OUT
        None,  # P_DML_ID OUT
    ]


# GET CATEGORY BY ID OR GET ALL CATEGORIES API
@router.get("/getCategory")
def get_category(
    nonce: str = Query(...),
    ciphertext: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    # Decrypt the encrypted request.
    key_value = os.getenv("REQUEST_AES_KEY")
    if not key_value:
        raise HTTPException(
            status_code=500,
            detail="Request encryption key is not configured",
        )

    try:
        aes_key = key_value.encode("utf-8")
        decrypted_text = decryptAesText(ciphertext, nonce, aes_key)
        payload = json.loads(decrypted_text)

        if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid decrypted request format",
            )

        body = payload["data"]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to decrypt category request",
        )

    # Validate category_id only when provided.
    category_id = body.get("category_id")

    if category_id is not None:
        if (
            isinstance(category_id, bool)
            or not isinstance(category_id, int)
            or category_id <= 0
        ):
            raise HTTPException(
                status_code=400,
                detail="Valid category ID is required",
            )

    body["action"] = "GetCategory"
    # parameters = build_category_parameters(body)
    parameters = build_category_parameters(
        body,
        current_user["user_id"],
    )

    try:
        result = execute_stored_procedure("SPEND_CATEGORY_SP", parameters)
        validate_sp_response(result)

        records = [
            record for result_set in result.get("data", []) for record in result_set
        ]

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": records,
        }

    except HTTPException:
        raise
    # except Exception:
    #     raise HTTPException(
    #         status_code=500,
    #         detail="Unable to retrieve category",
    #     )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve category",
        )


# CREATE CATEGORY API
@router.post("/createCategory")
def create_category(
    request: CategoryRequest,
    current_user: dict = Depends(get_current_user),
):
    # 1. Decrypt the request using the existing helper.
    body = get_category_request_data(request)

    # 2. Read the action from the decrypted payload.
    action = body.get("action")

    # 3. Validate category ID for update/status actions.
    if action in ("UpdateCategory", "UpdateCategoryStatus"):
        category_id = body.get("category_id")

        try:
            if (
                isinstance(category_id, bool)
                or category_id is None
                or str(category_id).strip() == ""
                or int(category_id) <= 0
            ):
                raise ValueError

            body["category_id"] = int(category_id)

        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="A valid category ID is required to update a category.",
            )

    # 4. Preserve the existing audit-field behavior.
    # if action == "CreateCategory":
    #     body["created_by"] = 0

    # body["last_updated_by"] = 0

    # 5. Build parameters in the existing stored procedure order.
    # parameters = build_category_parameters(body)
    parameters = build_category_parameters(
        body,
        current_user["user_id"],
    )

    try:
        # 6. Execute the existing stored procedure.
        result = execute_stored_procedure(
            "SPEND_CATEGORY_SP",
            parameters,
        )

        # 7. Keep the existing shared response validation.
        validate_sp_response(result)

        # 8. Flatten result sets using the existing response format.
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
            detail="Unable to process category request",
        )


# # CREATE CATEGORY API
# @router.post("/createCategory")
# def create_category(request: CategoryRequest):
#     body = get_category_request_data(request)

#     # CHANGED: Removed category_name and category_type validations.
#     # The stored procedure validates these fields and returns its error message.

#     body["created_by"] = 0
#     body["last_updated_by"] = 0

#     parameters = build_category_parameters(body)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_CATEGORY_SP",
#             parameters,
#         )

#         # Existing validation forwards the stored procedure's error.
#         validate_sp_response(result)

#         result_sets = result.get("data", [])
#         records = [record for result_set in result_sets for record in result_set]

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": records,
#         }

#     except HTTPException:
#         raise

#     except Exception:
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to process category request",
#         )


# # GET CATEGORY BY ID OR GET ALL CATEGORIES API
# @router.get("/getCategory")
# def get_category(
#     request: CategoryRequest,
#     current_user: dict = Depends(get_current_user),
# ):

#     # 1. Decrypt the encrypted request.
#     body = get_category_request_data(request)

#     # 2. Validate category_id only when provided.
#     category_id = body.get("category_id")

#     if category_id is not None:
#         if (
#             isinstance(category_id, bool)
#             or not isinstance(category_id, int)
#             or category_id <= 0
#         ):
#             raise HTTPException(
#                 status_code=400,
#                 detail="Valid category ID is required",
#             )

#     # 3. Set the action internally.
#     body["action"] = "GetCategory"

#     # 4. Build parameters in stored procedure signature order.
#     parameters = build_category_parameters(body)

#     try:
#         # 5. Execute the stored procedure.
#         result = execute_stored_procedure(
#             "SPEND_CATEGORY_SP",
#             parameters,
#         )

#         # 6. Validate the stored procedure response.
#         validate_sp_response(result)

#         # 7. Flatten result sets.
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

#     except Exception:
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to retrieve category",
#         )


# # CREATE CATEGORY API
# @router.post("/createCategory")
# def create_category(request: CategoryRequest):
#     # body = request.data.copy()
#     body = get_category_request_data(request)

#     category_name = body.get("category_name")
#     category_type = body.get("category_type")

#     if not isinstance(category_name, str) or not category_name.strip():
#         raise HTTPException(
#             status_code=400,
#             detail="Category name is required",
#         )

#     if not isinstance(category_type, str) or category_type.strip().upper() not in (
#         "INCOME",
#         "EXPENSE",
#     ):
#         raise HTTPException(
#             status_code=400,
#             detail="Category type must be INCOME or EXPENSE",
#         )

#     body["category_name"] = category_name.strip()
#     body["category_type"] = category_type.strip().upper()
#     body["created_by"] = 0
#     body["last_updated_by"] = 0

#     parameters = build_category_parameters(body)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_CATEGORY_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         result_sets = result.get("data", [])
#         records = [record for result_set in result_sets for record in result_set]

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": records,
#         }

#     except HTTPException:
#         raise

#     except Exception:
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to process category request",
#         )
