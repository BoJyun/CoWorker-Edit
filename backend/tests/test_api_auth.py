from tests.conftest import HOST_USER, auth_header


async def test_signup_succeeds(client):
    resp = await client.post("/api/auth/signup", json=HOST_USER)
    assert resp.status_code == 200
    assert "註冊成功" in resp.json()["message"]


async def test_duplicate_email_rejected(client):
    await client.post("/api/auth/signup", json=HOST_USER)
    resp = await client.post("/api/auth/signup", json=HOST_USER)
    assert resp.status_code == 400


async def test_signup_rejects_short_password(client):
    resp = await client.post(
        "/api/auth/signup",
        json={"name": "王小明", "email": "a@example.com", "password": "abc"},
    )
    assert resp.status_code == 422


async def test_login_returns_token_and_profile(client):
    await client.post("/api/auth/signup", json=HOST_USER)
    resp = await client.post(
        "/api/auth/login",
        json={"email": HOST_USER["email"], "password": HOST_USER["password"]},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["token"].startswith("JWT ")
    assert body["email"] == HOST_USER["email"]
    assert body["name"] == HOST_USER["name"]
    # 前端 authSlice 會整包存進 localStorage
    assert set(body) == {"token", "id", "name", "email", "image"}


async def test_login_with_wrong_password_rejected(client):
    await client.post("/api/auth/signup", json=HOST_USER)
    resp = await client.post(
        "/api/auth/login",
        json={"email": HOST_USER["email"], "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_login_with_unknown_email_rejected(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "testtest"},
    )
    # 與密碼錯誤回同樣的狀態碼，避免洩漏哪些 email 有註冊
    assert resp.status_code == 401


async def test_password_is_not_returned_anywhere(client):
    await client.post("/api/auth/signup", json=HOST_USER)
    resp = await client.post(
        "/api/auth/login",
        json={"email": HOST_USER["email"], "password": HOST_USER["password"]},
    )
    assert "password" not in resp.text


async def test_protected_route_requires_token(client):
    resp = await client.get("/api/doc/mydoc")
    assert resp.status_code == 401


async def test_protected_route_rejects_bad_token(client):
    resp = await client.get(
        "/api/doc/mydoc", headers={"Authorization": "JWT not-a-real-token"}
    )
    assert resp.status_code == 401


async def test_protected_route_accepts_valid_token(client, host):
    resp = await client.get("/api/doc/mydoc", headers=auth_header(host))
    assert resp.status_code == 200
    assert resp.json() == []
