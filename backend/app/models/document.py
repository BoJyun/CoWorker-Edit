from datetime import datetime, timezone
from typing import Any

from beanie import Document as BeanieDocument, PydanticObjectId
from pydantic import Field


DEFAULT_BACKGROUND = (
    "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1"
    "?auto=format&fit=crop&w=1632&q=80"
)


class Document(BeanieDocument):
    """一份協作文件。

    id 由前端產生的 UUID 字串當主鍵（與 Co-Edit 的作法一致），
    所以使用者一開新網址就等於開一份新文件。
    """

    id: str  # noqa: A003 — 對應 MongoDB 的 _id
    title: str = Field(default="Untitled Document", max_length=50)

    # Quill Delta，形如 {"ops": [...]}
    data: dict[str, Any] = Field(default_factory=lambda: {"ops": []})

    host: PydanticObjectId
    background: str = DEFAULT_BACKGROUND
    last_modified: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "documents"
