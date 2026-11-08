from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError

from utils.jwt_utils import verify_access_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        payload = verify_access_token(credentials.credentials)

        return {
            "user_id": int(payload["sub"]),
            "role_code": payload.get("role"),
        }

    except (InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except RuntimeError:
        raise HTTPException(
            status_code=500,
            detail="Authentication configuration error",
        )


# Optional authentication
def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
):
    if credentials is None:
        return None

    return get_current_user(credentials)


# admin module
def require_admin(
    current_user: dict = Depends(get_current_user),
):
    role_code = current_user.get("role_code")

    if not isinstance(role_code, str) or role_code.upper() != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user
