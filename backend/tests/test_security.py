from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

USER_ID = "507f1f77bcf86cd799439011"
EMAIL = "test@example.com"


# --------------------------- 密碼雜湊 ---------------------------


def test_correct_password_verifies():
    hashed = hash_password("testtest")
    assert verify_password("testtest", hashed) is True


def test_wrong_password_rejected():
    hashed = hash_password("testtest")
    assert verify_password("wrongpassword", hashed) is False


def test_hash_is_salted():
    """同樣的密碼每次雜湊結果都要不同，否則等於沒加鹽。"""
    assert hash_password("testtest") != hash_password("testtest")


def test_password_never_stored_in_plaintext():
    hashed = hash_password("testtest")
    assert "testtest" not in hashed


def test_empty_hash_rejected():
    """Google 登入的使用者沒有密碼，這時任何密碼都不該通過。"""
    assert verify_password("anything", "") is False


# --------------------------- JWT ---------------------------


def test_jwt_roundtrip():
    token = create_access_token(USER_ID, EMAIL)
    payload = decode_access_token(token)
    assert payload["_id"] == USER_ID
    assert payload["email"] == EMAIL


def test_expired_token_rejected():
    expired = jwt.encode(
        {
            "_id": USER_ID,
            "email": EMAIL,
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(HTTPException) as exc:
        decode_access_token(expired)
    assert exc.value.status_code == 401


def test_tampered_token_rejected():
    token = create_access_token(USER_ID, EMAIL)
    # 動最後一個字元就足以讓簽章對不上
    tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
    with pytest.raises(HTTPException) as exc:
        decode_access_token(tampered)
    assert exc.value.status_code == 401


def test_token_signed_with_other_secret_rejected():
    forged = jwt.encode(
        {
            "_id": USER_ID,
            "email": EMAIL,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        "someone-elses-secret",
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(HTTPException) as exc:
        decode_access_token(forged)
    assert exc.value.status_code == 401


def test_garbage_token_rejected():
    with pytest.raises(HTTPException) as exc:
        decode_access_token("not-a-jwt-at-all")
    assert exc.value.status_code == 401
