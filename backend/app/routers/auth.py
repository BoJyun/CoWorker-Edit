from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    SignupRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=MessageResponse)
async def signup(payload: SignupRequest) -> MessageResponse:
    existing = await User.find_one(User.email == payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="這個 email 已經註冊過了",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
    )
    await user.insert()
    return MessageResponse(message="註冊成功，可以登入了！")


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    user = await User.find_one(User.email == payload.email)
    # 帳號不存在與密碼錯誤回相同訊息，避免洩漏哪些 email 有註冊
    if user is None or not verify_password(payload.password, user.password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="email 或密碼錯誤",
        )

    token = create_access_token(str(user.id), user.email)
    return LoginResponse(
        token=f"JWT {token}",
        id=str(user.id),
        name=user.name,
        email=user.email,
        image=user.thumbnail,
    )
