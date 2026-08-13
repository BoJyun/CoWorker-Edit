from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models import Document, User

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    """建立 MongoDB 連線並註冊 Beanie 模型。"""
    global _client
    # tz_aware=True：MongoDB 存的是 UTC，預設讀回來卻是 naive datetime，
    # 序列化後少了時區標記，前端會當成本地時間解讀而差 8 小時。
    _client = AsyncIOMotorClient(settings.db_connect, tz_aware=True)
    await init_beanie(
        database=_client[settings.db_name],
        document_models=[User, Document],
    )


async def close_db() -> None:
    if _client is not None:
        _client.close()
