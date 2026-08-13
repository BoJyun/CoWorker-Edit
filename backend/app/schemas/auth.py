from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    """回傳格式對齊前端 authSlice 存進 localStorage 的欄位。"""

    token: str
    id: str
    name: str
    email: EmailStr
    image: str


class MessageResponse(BaseModel):
    message: str
