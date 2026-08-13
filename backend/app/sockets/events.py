"""Socket.io 即時協作事件。

事件名稱與參數順序刻意與前端 Editor.jsx 對齊，
使用 python-socketio（協定相容 socket.io JS client 4.x）。
"""

from datetime import datetime, timezone

import socketio
from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.core.security import decode_access_token
from app.models import Document, RecentlyOpened, User

RECENTLY_OPENED_LIMIT = 20

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[settings.client_origin],
)

# doc_id -> {sid: 使用者資訊}；用 sid 當 key，同一人開多個分頁才不會互相覆蓋
_online: dict[str, dict[str, dict]] = {}


def _room_users(doc_id: str) -> list[dict]:
    """回傳該文件目前線上的人，同一使用者多個分頁只算一次。"""
    seen: dict[str, dict] = {}
    for info in _online.get(doc_id, {}).values():
        seen.setdefault(info["userId"], info)
    return list(seen.values())


async def _broadcast_users(doc_id: str) -> None:
    await sio.emit("all-users", _room_users(doc_id), room=doc_id)


# ---------------------------------------------------------------------------
# 連線 / 斷線
# ---------------------------------------------------------------------------


@sio.event
async def connect(sid, environ, auth):
    """連線時就驗 JWT，之後所有事件都以這個身分為準。

    參考專案是讓前端自己傳 email 過來，等於任何人都能冒充別人；
    這裡改成從 token 取得身分，客戶端傳什麼都不影響。
    """
    token = (auth or {}).get("token", "")
    if token.upper().startswith("JWT "):
        token = token[4:]
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("缺少授權資訊")

    try:
        payload = decode_access_token(token)
    except Exception:
        raise socketio.exceptions.ConnectionRefusedError("授權無效或已過期")

    user = await User.get(PydanticObjectId(payload["_id"]))
    if user is None:
        raise socketio.exceptions.ConnectionRefusedError("使用者不存在")

    await sio.save_session(
        sid,
        {
            "userId": str(user.id),
            "userEmail": user.email,
            "username": user.name,
            "image": user.thumbnail,
            "docId": None,
        },
    )


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if not doc_id:
        return

    _online.get(doc_id, {}).pop(sid, None)
    if not _online.get(doc_id):
        _online.pop(doc_id, None)

    await sio.emit(
        "just-left",
        (session["username"], session["userId"]),
        room=doc_id,
        skip_sid=sid,
    )
    await _broadcast_users(doc_id)


# ---------------------------------------------------------------------------
# 進入文件
# ---------------------------------------------------------------------------


@sio.on("get-document")
async def get_document(sid, doc_id, _user_email=None):
    """加入文件房間。第二個參數只是為了相容舊版前端，實際不採用。"""
    session = await sio.get_session(sid)
    user = await User.get(PydanticObjectId(session["userId"]))
    if user is None:
        return

    doc = await Document.get(doc_id)
    if doc is None:
        # 與 REST 的 getOneOrCreate 同語意；兩邊可能同時建立，撞到就重讀
        doc = Document(
            id=doc_id, host=user.id, data={"ops": []},
            last_modified=datetime.now(timezone.utc),
        )
        try:
            await doc.insert()
        except DuplicateKeyError:
            doc = await Document.get(doc_id)
            if doc is None:
                return
    if doc.host != user.id and doc_id not in user.subscribe:
        await sio.emit("remove-user", session["userEmail"], to=sid)
        return

    try:
        await sio.enter_room(sid, doc_id)
    except ValueError:
        # 上面的權限查詢要跑好幾趟資料庫，這段期間對方可能已經關掉分頁。
        # 這時 sid 已經不在 namespace 裡，直接放生，不要留下未處理的 task exception。
        return
    session["docId"] = doc_id
    await sio.save_session(sid, session)

    # 更新最近開啟紀錄
    now = datetime.now(timezone.utc)
    for record in user.recently_opened:
        if record.doc_id == doc_id:
            record.last_opened = now
            break
    else:
        user.recently_opened.append(RecentlyOpened(doc_id=doc_id, last_opened=now))
    if len(user.recently_opened) > RECENTLY_OPENED_LIMIT:
        user.recently_opened = sorted(
            user.recently_opened, key=lambda r: r.last_opened, reverse=True
        )[:RECENTLY_OPENED_LIMIT]
    await user.save()

    _online.setdefault(doc_id, {})[sid] = {
        "docId": doc_id,
        "userId": session["userId"],
        "userEmail": session["userEmail"],
        "username": session["username"],
        "image": session["image"],
    }

    await sio.emit("just-joined", session["username"], room=doc_id, skip_sid=sid)
    await _broadcast_users(doc_id)

    # 通知前端「已加入房間」。在這之前打的字不會廣播出去，
    # 所以編輯器要等收到這個事件才開放編輯。
    await sio.emit("document-ready", doc_id, to=sid)


# ---------------------------------------------------------------------------
# 內容與游標同步
# ---------------------------------------------------------------------------


@sio.on("send-changes")
async def send_changes(sid, delta):
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if doc_id:
        await sio.emit("receive-changes", delta, room=doc_id, skip_sid=sid)


@sio.on("send-cursor")
async def send_cursor(sid, cursor_range, user_id, name, color):
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if doc_id:
        await sio.emit(
            "receive-cursor",
            (cursor_range, user_id, name, color),
            room=doc_id,
            skip_sid=sid,
        )


# ---------------------------------------------------------------------------
# 儲存
# ---------------------------------------------------------------------------


@sio.on("save-document")
async def save_document(sid, data):
    """回傳 ack；離開編輯前要靠這個確認內容真的落地了才能斷線。"""
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if not doc_id:
        return {"ok": False, "error": "尚未加入文件"}

    doc = await Document.get(doc_id)
    if doc is None:
        return {"ok": False, "error": "找不到這份文件"}
    doc.data = data if isinstance(data, dict) else {"ops": data}
    doc.last_modified = datetime.now(timezone.utc)
    await doc.save()
    return {"ok": True}


@sio.on("save-title")
async def save_title(sid, title):
    """回傳 ack 讓前端知道到底存了沒；靜靜失敗會讓使用者以為改好了。"""
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if not doc_id:
        return {"ok": False, "error": "尚未加入文件，請重新整理再試"}

    doc = await Document.get(doc_id)
    if doc is None:
        return {"ok": False, "error": "找不到這份文件"}
    doc.title = title[:50]
    await doc.save()
    await sio.emit("send-title", doc.title, room=doc_id, skip_sid=sid)
    return {"ok": True, "title": doc.title}


# ---------------------------------------------------------------------------
# 權限異動
# ---------------------------------------------------------------------------


@sio.on("delete-user")
async def delete_user(sid, delete_email):
    """擁有者移除協作者後，通知該使用者的畫面立即鎖住。"""
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if not doc_id:
        return

    doc = await Document.get(doc_id)
    if doc is None or str(doc.host) != session["userId"]:
        return
    await sio.emit("remove-user", delete_email, room=doc_id, skip_sid=sid)


@sio.on("end-session")
async def end_session(sid):
    """擁有者結束這次協作，把房間裡的人都請回自己的文件列表。

    這裡刻意不直接 sio.disconnect() 對方（delete-doc 那樣做是因為文件都刪了、
    沒東西好存）。文件還在，硬踢會吃掉協作者還沒 debounce 存檔的內容，
    所以只發通知，讓每個 client 自己存完再離開。
    """
    session = await sio.get_session(sid)
    doc_id = session.get("docId")
    if not doc_id:
        return {"ok": False, "error": "尚未加入文件"}

    doc = await Document.get(doc_id)
    if doc is None:
        return {"ok": False, "error": "找不到這份文件"}
    if str(doc.host) != session["userId"]:
        return {"ok": False, "error": "只有文件擁有者可以結束協作"}

    await sio.emit("session-ended", session["username"], room=doc_id, skip_sid=sid)
    return {"ok": True}


@sio.on("delete-doc")
async def delete_doc(sid, delete_doc_id):
    """文件被刪除，把整個房間的連線踢掉。"""
    session = await sio.get_session(sid)
    if session.get("docId") != delete_doc_id:
        return

    participants = list(sio.manager.get_participants("/", delete_doc_id))
    _online.pop(delete_doc_id, None)
    for participant_sid, _ in participants:
        if participant_sid != sid:
            await sio.disconnect(participant_sid)
