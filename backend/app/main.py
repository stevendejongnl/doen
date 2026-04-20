from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.api import api_keys, auth, groups, ha, invitations, projects, sse, tasks
from app.config import settings
from app.db.session import engine
from app.models import *  # noqa: F401, F403 — register all models with metadata
from app.scheduler.setup import create_scheduler, set_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Create tables if they don't exist (dev convenience; prod uses Alembic)
    from app.db.session import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)
    scheduler = create_scheduler(Session)
    set_scheduler(scheduler)
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(api_keys.router)
app.include_router(groups.router)
app.include_router(invitations.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(sse.router)
app.include_router(ha.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


# Serve frontend SPA — must be last so API routes take priority.
# Falls back gracefully if static/ doesn't exist (dev without a build).
_static = Path(__file__).parent.parent / "static"
if _static.exists():
    # SPA deep-links (like email invite URLs) need to serve index.html — StaticFiles would 404.
    @app.get("/invite/{token}", include_in_schema=False)
    async def _spa_invite_fallback(token: str) -> FileResponse:
        return FileResponse(str(_static / "index.html"))

    app.mount("/", StaticFiles(directory=str(_static), html=True), name="static")
