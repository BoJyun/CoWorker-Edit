"""Layer 2 整合測試的共用 fixture。

測試會連到 .env 指定的 MongoDB，但用另一個資料庫名稱（`{DB_NAME}_test`），
所以不會動到開發資料。每個測試跑完都把 collection 清空。
"""

import pytest
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.main import app
from app.models import Document, User

TEST_DB_NAME = f"{settings.db_name}_test"


@pytest_asyncio.fixture
async def db():
    """連到測試資料庫並註冊 Beanie 模型；結束後清空。"""
    client = AsyncIOMotorClient(settings.db_connect, tz_aware=True)
    await init_beanie(
        database=client[TEST_DB_NAME], document_models=[User, Document]
    )
    # 確保每個測試都從乾淨狀態開始
    await User.delete_all()
    await Document.delete_all()

    yield client[TEST_DB_NAME]

    await User.delete_all()
    await Document.delete_all()
    client.close()


@pytest_asyncio.fixture
async def client(db):
    """不觸發 lifespan 的 HTTP client，資料庫由 db fixture 準備好。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# --------------------------- 測試資料 ---------------------------

HOST_USER = {
    "name": "王小明",
    "email": "ming@example.com",
    "password": "testtest",
}
GUEST_USER = {
    "name": "陳怡君",
    "email": "yijun@example.com",
    "password": "testtest",
}


async def register_and_login(client: AsyncClient, user: dict) -> dict:
    """註冊並登入，回傳含 token / id 的登入結果。"""
    await client.post("/api/auth/signup", json=user)
    resp = await client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_header(login_result: dict) -> dict:
    return {"Authorization": login_result["token"]}


@pytest_asyncio.fixture
async def host(client):
    """文件擁有者。"""
    return await register_and_login(client, HOST_USER)


@pytest_asyncio.fixture
async def guest(client):
    """另一位使用者，用來測分享與權限。"""
    return await register_and_login(client, GUEST_USER)
