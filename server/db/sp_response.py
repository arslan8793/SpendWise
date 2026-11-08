from fastapi import HTTPException


def validate_sp_response(result: dict) -> None:
    # Read the status returned by the stored procedure.
    status = str(result.get("status", "")).strip().upper()
    message = result.get("message") or "Request failed"

    # Return normally when the stored procedure succeeds.
    if status in ("S", "SUCCESS"):
        return

    # Raise a client error when the stored procedure reports failure.
    if status in ("E", "ERROR", "F", "FAILED"):
        raise HTTPException(
            status_code=400,
            detail=message,
        )

    # Handle missing or unexpected stored procedure statuses.
    raise HTTPException(
        status_code=500,
        detail="Unexpected response from stored procedure",
    )
