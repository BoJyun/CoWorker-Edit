from tests.conftest import auth_header

DOC_ID = "a7f3c1e8-1111-2222-3333-444455556666"
OTHER_DOC_ID = "b8e4d2f9-9999-8888-7777-666655554444"


async def create_doc(client, owner, doc_id=DOC_ID):
    """GET /api/doc/{id} 在文件不存在時會建立一份，host 為當前使用者。"""
    resp = await client.get(f"/api/doc/{doc_id}", headers=auth_header(owner))
    assert resp.status_code == 200, resp.text
    return resp.json()


# --------------------------- 建立與讀取 ---------------------------


async def test_get_creates_doc_when_missing(client, host):
    body = await create_doc(client, host)

    assert body["_id"] == DOC_ID
    assert body["title"] == "Untitled Document"
    assert body["data"] == {"ops": []}
    assert body["host"]["email"] == "ming@example.com"
    assert "lastModified" in body


async def test_get_existing_doc_does_not_duplicate(client, host):
    await create_doc(client, host)
    await create_doc(client, host)

    resp = await client.get("/api/doc/mydoc", headers=auth_header(host))
    assert len(resp.json()) == 1


async def test_mydoc_lists_own_docs_only(client, host, guest):
    await create_doc(client, host, DOC_ID)
    await create_doc(client, guest, OTHER_DOC_ID)

    resp = await client.get("/api/doc/mydoc", headers=auth_header(host))
    ids = [d["_id"] for d in resp.json()]
    assert ids == [DOC_ID]


async def test_timestamps_carry_timezone(client, host):
    """時間必須帶時區標記。

    少了它，前端 luxon 會把 UTC 時間當成本地時間解讀，
    在 UTC+8 會顯示成「8 小時前」。
    """
    await create_doc(client, host)
    resp = await client.get("/api/doc/mydoc", headers=auth_header(host))

    last_modified = resp.json()[0]["lastModified"]
    assert last_modified.endswith("Z") or "+00:00" in last_modified, (
        f"時間沒有時區標記：{last_modified}"
    )


async def test_doc_summary_uses_frontend_field_names(client, host):
    await create_doc(client, host)
    resp = await client.get("/api/doc/mydoc", headers=auth_header(host))

    doc = resp.json()[0]
    assert "_id" in doc and "lastModified" in doc
    assert "id" not in doc and "last_modified" not in doc


# --------------------------- 權限 ---------------------------


async def test_stranger_cannot_read_doc(client, host, guest):
    await create_doc(client, host)

    resp = await client.get(f"/api/doc/{DOC_ID}", headers=auth_header(guest))
    assert resp.status_code == 403


async def test_grant_access_lets_guest_read(client, host, guest):
    await create_doc(client, host)

    granted = await client.patch(
        "/api/doc/access",
        json={"email": "yijun@example.com", "docId": DOC_ID},
        headers=auth_header(host),
    )
    assert granted.status_code == 200

    resp = await client.get(f"/api/doc/{DOC_ID}", headers=auth_header(guest))
    assert resp.status_code == 200


async def test_granted_doc_appears_in_shared_list(client, host, guest):
    await create_doc(client, host)
    await client.patch(
        "/api/doc/access",
        json={"email": "yijun@example.com", "docId": DOC_ID},
        headers=auth_header(host),
    )

    resp = await client.get("/api/doc/shared", headers=auth_header(guest))
    assert [d["_id"] for d in resp.json()] == [DOC_ID]


async def test_guest_cannot_grant_access(client, host, guest):
    await create_doc(client, host)

    resp = await client.patch(
        "/api/doc/access",
        json={"email": "yijun@example.com", "docId": DOC_ID},
        headers=auth_header(guest),
    )
    assert resp.status_code == 403


async def test_grant_access_to_unknown_user_404(client, host):
    await create_doc(client, host)

    resp = await client.patch(
        "/api/doc/access",
        json={"email": "nobody@example.com", "docId": DOC_ID},
        headers=auth_header(host),
    )
    assert resp.status_code == 404


async def test_grant_access_twice_rejected(client, host, guest):
    await create_doc(client, host)
    payload = {"email": "yijun@example.com", "docId": DOC_ID}

    await client.patch(
        "/api/doc/access", json=payload, headers=auth_header(host)
    )
    resp = await client.patch(
        "/api/doc/access", json=payload, headers=auth_header(host)
    )
    assert resp.status_code == 400


async def test_remove_user_revokes_access(client, host, guest):
    await create_doc(client, host)
    payload = {"email": "yijun@example.com", "docId": DOC_ID}

    await client.patch(
        "/api/doc/access", json=payload, headers=auth_header(host)
    )
    removed = await client.patch(
        "/api/doc/remove", json=payload, headers=auth_header(host)
    )
    assert removed.status_code == 200

    resp = await client.get(f"/api/doc/{DOC_ID}", headers=auth_header(guest))
    assert resp.status_code == 403


# --------------------------- 協作者名單 ---------------------------


async def test_host_can_list_collaborators(client, host, guest):
    await create_doc(client, host)
    await client.patch(
        "/api/doc/access",
        json={"email": "yijun@example.com", "docId": DOC_ID},
        headers=auth_header(host),
    )

    resp = await client.get(
        f"/api/doc/users/{DOC_ID}", headers=auth_header(host)
    )
    assert resp.status_code == 200
    assert [u["email"] for u in resp.json()] == ["yijun@example.com"]


async def test_guest_cannot_list_collaborators(client, host, guest):
    await create_doc(client, host)

    resp = await client.get(
        f"/api/doc/users/{DOC_ID}", headers=auth_header(guest)
    )
    assert resp.status_code == 403


# --------------------------- 刪除 ---------------------------


async def test_host_can_delete_doc(client, host):
    await create_doc(client, host)

    resp = await client.delete(f"/api/doc/{DOC_ID}", headers=auth_header(host))
    assert resp.status_code == 200

    listing = await client.get("/api/doc/mydoc", headers=auth_header(host))
    assert listing.json() == []


async def test_guest_cannot_delete_doc(client, host, guest):
    await create_doc(client, host)

    resp = await client.delete(f"/api/doc/{DOC_ID}", headers=auth_header(guest))
    assert resp.status_code == 403


async def test_delete_removes_doc_from_others_shared_list(client, host, guest):
    await create_doc(client, host)
    await client.patch(
        "/api/doc/access",
        json={"email": "yijun@example.com", "docId": DOC_ID},
        headers=auth_header(host),
    )

    await client.delete(f"/api/doc/{DOC_ID}", headers=auth_header(host))

    resp = await client.get("/api/doc/shared", headers=auth_header(guest))
    assert resp.json() == []


async def test_delete_missing_doc_404(client, host):
    resp = await client.delete(
        "/api/doc/does-not-exist", headers=auth_header(host)
    )
    assert resp.status_code == 404
