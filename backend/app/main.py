from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_db, init_db
from app.routers import auth, doc
from app.sockets import sio


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="CoWorker Edit API",
    description="多人即時協作文件編輯器的後端 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(doc.router)


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok"}


# socket.io 掛在同一個 ASGI app 上（路徑 /socket.io/），
# 所以 REST 與即時通訊共用一個 port，不像參考專案要開兩個。
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
