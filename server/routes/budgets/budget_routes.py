import json
import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict

from services.sp_service import execute_stored_procedure
from utils.auth_dependencies import get_current_user
from utils.cryptography import decryptAesText
from db.sp_response import validate_sp_response

router = APIRouter(prefix="/budgets", tags=["Budgets"])


class BudgetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str
    ciphertext: str


def get_budget_request_data(
    request: BudgetRequest,
) -> dict[str, Any]:
    aes_key = os.getenv("REQUEST_AES_KEY")

    if not aes_key:
        raise HTTPException(
            status_code=500,
            detail="Request encryption key is not configured",
        )

    try:
        aes_key_bytes = aes_key.encode("utf-8")

        if len(aes_key_bytes) not in (16, 24, 32):
            raise ValueError("Invalid AES key length")

        decrypted_text = decryptAesText(
            request.ciphertext,
            request.nonce,
            aes_key_bytes,
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


def build_budget_parameters(body: dict[str, Any]) -> list:
    return [
        body.get("budget_id"),  # P_BUDGET_ID
        body.get("user_id"),  # P_USER_ID
        body.get("category_id"),  # P_CATEGORY_ID
        body.get("budget_amount"),  # P_BUDGET_AMOUNT
        body.get("budget_month"),  # P_BUDGET_MONTH
        body.get("budget_year"),  # P_BUDGET_YEAR
        body.get("enable_flag"),  # P_ENABLE_FLAG
        body.get("created_by"),  # P_CREATED_BY
        body.get("last_updated_by"),  # P_LAST_UPDATED_BY
        body.get("last_update_login"),  # P_LAST_UPDATE_LOGIN
        body.get("action"),  # P_ACTION
        None,  # P_DML_STATUS OUT
        None,  # P_DML_MESSAGE OUT
        None,  # P_DML_ID OUT
    ]


def flatten_budget_result(result: dict) -> list:
    result_sets = result.get("data", [])
    return [record for result_set in result_sets for record in result_set]


# CREATE / UPDATE / UPDATE STATUS BUDGET API
@router.post("/manageBudget")
def manage_budget(
    request: BudgetRequest, current_user: dict = Depends(get_current_user)
):
    body = get_budget_request_data(request)

    # Always use the logged-in user's ID, not the client-supplied ID.
    body["user_id"] = current_user["user_id"]
    body["last_updated_by"] = current_user["user_id"]

    if body.get("action") == "CreateBudget":
        body["created_by"] = current_user["user_id"]

    parameters = build_budget_parameters(body)

    try:
        result = execute_stored_procedure("SPEND_BUDGET_SP", parameters)

        validate_sp_response(result)

        return {
            "status": result["status"],
            "message": result["message"],
            "id": result["id"],
            "data": flatten_budget_result(result),
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("BUDGET API ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Unable to process budget request")


# GET BUDGET API
@router.get("/getBudget")
def get_budget(
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
            detail="Unable to decrypt budget request",
        )

    # This endpoint is exclusively for retrieving budgets.
    body["action"] = "GetBudget"

    # Force the authenticated user's ID.
    body["user_id"] = current_user["user_id"]

    parameters = build_budget_parameters(body)

    try:
        result = execute_stored_procedure(
            "SPEND_BUDGET_SP",
            parameters,
        )
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
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve budget details",
        )


# # GET BUDGET API
# @router.get("/getBudget")
# def get_budget(
#     request: BudgetRequest,
#     current_user: dict = Depends(get_current_user),
# ):
#     body = get_budget_request_data(request)

#     # This endpoint is exclusively for retrieving budgets
#     if body.get("action") != "GetBudget":
#         raise HTTPException(
#             status_code=400,
#             detail="Action must be GetBudget",
#         )

#     body["user_id"] = current_user["user_id"]

#     parameters = build_budget_parameters(body)

#     try:
#         result = execute_stored_procedure(
#             "SPEND_BUDGET_SP",
#             parameters,
#         )

#         validate_sp_response(result)

#         return {
#             "status": result["status"],
#             "message": result["message"],
#             "id": result["id"],
#             "data": flatten_budget_result(result),
#         }

#     except HTTPException:
#         raise

#     except Exception:
#         raise HTTPException(
#             status_code=500,
#             detail="Unable to retrieve budget details",
#         )
