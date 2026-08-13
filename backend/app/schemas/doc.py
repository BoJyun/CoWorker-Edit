from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class HostInfo(BaseModel):
    name: str
    email: EmailStr


class DocSummary(BaseModel):
    """列表用：不含 data，避免把整份 Delta 撈出來。

    序列化時輸出 camelCase / _id，對齊前端 DocCard 讀的欄位。
    """

    id: str = Field(serialization_alias="_id")
    title: str
    background: str
    host: HostInfo | None = None
    last_modified: datetime | None = Field(
        default=None, serialization_alias="lastModified"
    )
    last_opened: datetime | None = Field(
        default=None, serialization_alias="lastOpened"
    )


class DocDetail(BaseModel):
    """單一文件：前端 Editor 用 data 灌進 Quill。"""

    id: str = Field(serialization_alias="_id")
    title: str
    data: dict[str, Any]
    host: HostInfo
    background: str
    last_modified: datetime = Field(serialization_alias="lastModified")


class DocUser(BaseModel):
    name: str
    email: EmailStr


class AccessRequest(BaseModel):
    """前端送的是 {email, docId}。"""

    email: EmailStr
    doc_id: str = Field(validation_alias="docId")

    model_config = {"populate_by_name": True}


class MessageResponse(BaseModel):
    message: str
