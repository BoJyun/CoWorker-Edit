from datetime import datetime, timezone

from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models import Document, User
from app.schemas.doc import (
    AccessRequest,
    DocDetail,
    DocSummary,
    DocUser,
    HostInfo,
    MessageResponse,
)

# 每個 endpoint 都自己注入 get_current_user 取得使用者，
# 這裡不再重複宣告 dependencies，否則每次請求會多查一次資料庫。
router = APIRouter(prefix="/api/doc", tags=["doc"])


async def _host_info(host_id) -> HostInfo | None:
    host = await User.get(host_id)
    if host is None:
        return None
    return HostInfo(name=host.name, email=host.email)


async def _get_doc_or_404(doc_id: str) -> Document:
    doc = await Document.get(doc_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="找不到這份文件"
        )
    return doc


def _require_host(doc: Document, user: User) -> None:
    if doc.host != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有文件擁有者可以執行這個操作",
        )


# ---------------------------------------------------------------------------
# 注意順序：固定路徑必須宣告在 /{doc_id} 之前，否則會被它吃掉
# ---------------------------------------------------------------------------


@router.get("/recentlyOpened", response_model=list[DocSummary])
async def recently_opened(user: User = Depends(get_current_user)):
    if not user.recently_opened:
        return []

    doc_ids = [r.doc_id for r in user.recently_opened]
    docs = await Document.find(In(Document.id, doc_ids)).to_list()
    doc_map = {d.id: d for d in docs}

    result: list[DocSummary] = []
    # 新開的排前面
    for record in sorted(
        user.recently_opened, key=lambda r: r.last_opened, reverse=True
    ):
        doc = doc_map.get(record.doc_id)
        if doc is None:  # 文件已被刪除
            continue
        result.append(
            DocSummary(
                id=doc.id,
                title=doc.title,
                background=doc.background,
                host=await _host_info(doc.host),
                last_opened=record.last_opened,
            )
        )
    return result


@router.get("/mydoc", response_model=list[DocSummary])
async def my_doc(user: User = Depends(get_current_user)):
    docs = await Document.find(Document.host == user.id).to_list()
    host = HostInfo(name=user.name, email=user.email)
    return [
        DocSummary(
            id=d.id,
            title=d.title,
            background=d.background,
            host=host,
            last_modified=d.last_modified,
        )
        for d in docs
    ]


@router.get("/shared", response_model=list[DocSummary])
async def shared(user: User = Depends(get_current_user)):
    if not user.subscribe:
        return []

    docs = await Document.find(In(Document.id, user.subscribe)).to_list()
    return [
        DocSummary(
            id=d.id,
            title=d.title,
            background=d.background,
            host=await _host_info(d.host),
            last_modified=d.last_modified,
        )
        for d in docs
    ]


@router.get("/users/{doc_id}", response_model=list[DocUser])
async def doc_user_list(doc_id: str, user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id)
    _require_host(doc, user)

    users = await User.find(In(User.subscribe, [doc_id])).to_list()
    return [DocUser(name=u.name, email=u.email) for u in users]


@router.patch("/access", response_model=MessageResponse)
async def grant_access(
    payload: AccessRequest, user: User = Depends(get_current_user)
):
    doc = await _get_doc_or_404(payload.doc_id)
    _require_host(doc, user)

    target = await User.find_one(User.email == payload.email)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="找不到這位使用者"
        )
    if target.id == user.id or payload.doc_id in target.subscribe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="這位使用者已經在協作名單裡了",
        )

    target.subscribe.append(payload.doc_id)
    await target.save()
    return MessageResponse(message="已加入協作者！")


@router.patch("/remove", response_model=MessageResponse)
async def remove_user(
    payload: AccessRequest, user: User = Depends(get_current_user)
):
    doc = await _get_doc_or_404(payload.doc_id)
    _require_host(doc, user)

    target = await User.find_one(User.email == payload.email)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="找不到這位使用者"
        )
    if payload.doc_id not in target.subscribe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="這位使用者不在協作名單裡",
        )

    target.subscribe.remove(payload.doc_id)
    target.recently_opened = [
        r for r in target.recently_opened if r.doc_id != payload.doc_id
    ]
    await target.save()
    return MessageResponse(message="已移除協作者！")


@router.get("/{doc_id}", response_model=DocDetail)
async def get_one_or_create(doc_id: str, user: User = Depends(get_current_user)):
    """讀取文件；不存在就以目前使用者為 host 建立一份新的。"""
    doc = await Document.get(doc_id)

    if doc is None:
        doc = Document(
            id=doc_id,
            host=user.id,
            data={"ops": []},
            last_modified=datetime.now(timezone.utc),
        )
        await doc.insert()
        host = HostInfo(name=user.name, email=user.email)
    else:
        if doc.host != user.id and doc_id not in user.subscribe:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="你沒有權限開啟這份文件",
            )
        host_info = await _host_info(doc.host)
        if host_info is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="文件擁有者已不存在"
            )
        host = host_info

    return DocDetail(
        id=doc.id,
        title=doc.title,
        data=doc.data,
        host=host,
        background=doc.background,
        last_modified=doc.last_modified,
    )


@router.delete("/{doc_id}", response_model=MessageResponse)
async def delete_doc(doc_id: str, user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id)
    _require_host(doc, user)

    # 連帶清掉其他使用者的 subscribe 與 recentlyOpened 參照
    await User.find(In(User.subscribe, [doc_id])).update(
        {"$pull": {"subscribe": doc_id}}
    )
    await User.find({"recently_opened.doc_id": doc_id}).update(
        {"$pull": {"recently_opened": {"doc_id": doc_id}}}
    )
    await doc.delete()
    return MessageResponse(message="文件已刪除！")
