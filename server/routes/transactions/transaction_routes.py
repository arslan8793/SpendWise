from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from services.sp_service import execute_stored_procedure
from utils.auth_dependencies import get_current_user
from utils.cryptography import decryptAesText
from db.sp_response import validate_sp_response

import json
import os

router = APIRouter(prefix="/transactions", tags=["Transactions"])


class TransactionRequest(BaseModel):
    nonce: str
    ciphertext: str


def get_transaction_request_data(
    request: TransactionRequest,
) -> dict[str, Any]:
    aes_key = os.getenv("REQUEST_AES_KEY")

    if not aes_key:
        raise HTTPException(
            status_code=500,
            detail="Encryption key is not configured",
        )

    try:
        decrypted_text = decryptAesText(
            request.ciphertext,
            request.nonce,
            aes_key.encode("utf-8"),
        )

        payload = json.loads(decrypted_text)
        return payload["data"]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid encrypted request",
        )


def build_transaction_parameters(
    body: dict[str, Any],
    current_user_id: int,
) -> list:
    return [
        body.get("transaction_id"),  # P_TRANSACTION_ID
        current_user_id,  # P_USER_ID
        body.get("category_id"),  # P_CATEGORY_ID
        body.get("transaction_type"),  # P_TRANSACTION_TYPE
        body.get("amount"),  # P_AMOUNT
        body.get("transaction_date"),  # P_TRANSACTION_DATE
        body.get("description"),  # P_DESCRIPTION
        body.get("payment_mode"),  # P_PAYMENT_MODE
        body.get("enable_flag"),  # P_ENABLE_FLAG
        current_user_id,  # P_CREATED_BY
        current_user_id,  # P_LAST_UPDATED_BY
        current_user_id,  # P_LAST_UPDATE_LOGIN
        body.get("action"),  # P_ACTION
        None,  # P_DML_STATUS OUT
        None,  # P_DML_MESSAGE OUT
        None,  # P_DML_ID OUT
    ]


# CREATE TRANSACTION API
@router.post("/createTransaction")
def create_transaction(
    request: TransactionRequest,
    current_user: dict = Depends(get_current_user),
):
    body = get_transaction_request_data(request)

    if body.get("action") == "CreateTransaction":
        body["created_by"] = current_user["user_id"]

    # Use the authenticated user's ID
    body["user_id"] = current_user["user_id"]
    body["last_updated_by"] = current_user["user_id"]

    # parameters = build_transaction_parameters(body)
    parameters = build_transaction_parameters(
        body,
        current_user["user_id"],
    )

    try:
        result = execute_stored_procedure(
            "SPEND_TRANSACTION_SP",
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
            detail="Unable to process transaction request",
        )


# # GET TRANSACTION API
@router.get("/getTransaction")
def get_transaction(
    nonce: str = Query(...),
    ciphertext: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    request = TransactionRequest(
        nonce=nonce,
        ciphertext=ciphertext,
    )

    body = get_transaction_request_data(request)

    # Use authenticated user's ID
    current_user_id = current_user["user_id"]
    body["user_id"] = current_user_id

    # parameters = build_transaction_parameters(body)
    parameters = build_transaction_parameters(body, current_user_id)
    try:
        result = execute_stored_procedure(
            "SPEND_TRANSACTION_SP",
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

    except Exception as exe:
        print("Trans exxxx ", (exe))
        raise HTTPException(
            status_code=500,
            detail="Unable to process transaction request",
        )
