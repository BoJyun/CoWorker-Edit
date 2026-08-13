from datetime import datetime, timezone

from beanie import Document as BeanieDocument
from pydantic import BaseModel, EmailStr, Field
from pymongo import IndexModel


DEFAULT_THUMBNAIL = (
    "https://cdn4.iconfinder.com/data/icons/music-ui-solid-24px/24/"
    "user_account_profile-2-512.png"
)


class RecentlyOpened(BaseModel):
    """使用者最近開啟過的文件（doc_id 對應 Document.id，為字串 UUID）。"""

    doc_id: str
    last_opened: datetime


class User(BeanieDocument):
    name: str = Field(max_length=50)
    email: EmailStr
    password: str | None = Field(default=None, max_length=1024)

    thumbnail: str = DEFAULT_THUMBNAIL
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # 別人分享給我的文件 id
    subscribe: list[str] = Field(default_factory=list)
    # 最近開啟紀錄，最多保留 20 筆
    recently_opened: list[RecentlyOpened] = Field(default_factory=list)

    about: str = ""
    link: str = ""

    class Settings:
        name = "users"
        indexes = [IndexModel("email", unique=True)]
