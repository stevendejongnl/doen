from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.api import auth, groups, ha, projects, sse, tasks
from app.config import settings
from app.db.session import engine
from app.models import *  # noqa: F401, F403 — register all models with metadata
from app.scheduler.setup import create_scheduler, set_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
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
app.include_router(groups.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(sse.router)
app.include_router(ha.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name}
