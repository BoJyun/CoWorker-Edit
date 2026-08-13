"""Schema 測試。

重點在序列化出來的欄位名稱：前端 DocCard 讀的是 `_id` / `lastModified`，
如果後端吐 `id` / `last_modified`，畫面會整片空白而且很難查，
所以這裡把欄位命名當成契約來測。
"""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginResponse, SignupRequest
from app.schemas.doc import AccessRequest, DocDetail, DocSummary, HostInfo

NOW = datetime(2026, 8, 13, 12, 0, tzinfo=timezone.utc)


# --------------------------- 註冊/登入 ---------------------------


def test_signup_accepts_valid_payload():
    payload = SignupRequest(
        name="王小明", email="ming@example.com", password="testtest"
    )
    assert payload.email == "ming@example.com"


@pytest.mark.parametrize("password", ["", "abc", "12345"])
def test_signup_rejects_short_password(password):
    with pytest.raises(ValidationError):
        SignupRequest(name="王小明", email="ming@example.com", password=password)


@pytest.mark.parametrize("email", ["not-an-email", "a@", "@example.com", ""])
def test_signup_rejects_invalid_email(email):
    with pytest.raises(ValidationError):
        SignupRequest(name="王小明", email=email, password="testtest")


def test_signup_rejects_overlong_name():
    with pytest.raises(ValidationError):
        SignupRequest(
            name="x" * 51, email="ming@example.com", password="testtest"
        )


def test_login_response_shape_matches_frontend():
    """authSlice 會把整包存進 localStorage，欄位少一個前端就抓不到。"""
    resp = LoginResponse(
        token="JWT abc",
        id="507f1f77bcf86cd799439011",
        name="王小明",
        email="ming@example.com",
        image="https://example.com/a.png",
    )
    dumped = resp.model_dump()
    assert set(dumped) == {"token", "id", "name", "email", "image"}


# --------------------------- 文件 ---------------------------


def test_doc_summary_serializes_to_frontend_field_names():
    summary = DocSummary(
        id="a7f3c1e8",
        title="Q3 會議記錄",
        background="https://example.com/bg.jpg",
        host=HostInfo(name="王小明", email="ming@example.com"),
        last_modified=NOW,
    )
    dumped = summary.model_dump(by_alias=True)

    assert "_id" in dumped and dumped["_id"] == "a7f3c1e8"
    assert "lastModified" in dumped
    # 不能吐出 Python 端的名字，前端讀不到
    assert "id" not in dumped
    assert "last_modified" not in dumped


def test_doc_summary_carries_last_opened_for_recent_list():
    summary = DocSummary(
        id="a7f3c1e8",
        title="Q3 會議記錄",
        background="https://example.com/bg.jpg",
        last_opened=NOW,
    )
    dumped = summary.model_dump(by_alias=True)
    assert dumped["lastOpened"] is not None
    assert "last_opened" not in dumped


def test_doc_detail_serializes_to_frontend_field_names():
    detail = DocDetail(
        id="a7f3c1e8",
        title="Q3 會議記錄",
        data={"ops": [{"insert": "hello"}]},
        host=HostInfo(name="王小明", email="ming@example.com"),
        background="https://example.com/bg.jpg",
        last_modified=NOW,
    )
    dumped = detail.model_dump(by_alias=True)

    assert dumped["_id"] == "a7f3c1e8"
    assert dumped["data"] == {"ops": [{"insert": "hello"}]}
    assert dumped["host"]["email"] == "ming@example.com"
    assert "lastModified" in dumped


def test_access_request_accepts_frontend_camel_case():
    """前端送的是 {email, docId}。"""
    req = AccessRequest.model_validate(
        {"email": "yijun@example.com", "docId": "a7f3c1e8"}
    )
    assert req.doc_id == "a7f3c1e8"


def test_access_request_rejects_invalid_email():
    with pytest.raises(ValidationError):
        AccessRequest.model_validate({"email": "nope", "docId": "a7f3c1e8"})


def test_access_request_requires_doc_id():
    with pytest.raises(ValidationError):
        AccessRequest.model_validate({"email": "yijun@example.com"})
