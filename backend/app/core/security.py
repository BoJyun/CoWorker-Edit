from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.models import User


# 前端送出的 header 是 "JWT <token>"（沿用 Co-Edit 的格式），
# 所以自訂 scheme 而不是用預設的 Bearer。
class JWTBearer(HTTPBearer):
    def __init__(self) -> None:
        super().__init__(scheme_name="JWT", auto_error=True)

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials:  # type: ignore[override]
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="缺少授權資訊",
            )
        scheme, _, token = authorization.partition(" ")
        if scheme.upper() not in ("JWT", "BEARER") or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="授權格式不正確",
            )
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=token)


jwt_scheme = JWTBearer()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """解出 token payload，失敗時拋 401。"""
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="登入已過期，請重新登入"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的授權"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(jwt_scheme),
) -> User:
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的授權"
        )

    user = await User.get(PydanticObjectId(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="使用者不存在"
        )
    return user
