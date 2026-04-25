import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.api import (
    api_keys,
    auth,
    categories,
    groups,
    ha,
    household_points,
    invitations,
    projects,
    sse,
    tasks,
)
from app.config import settings
from app.db.session import engine
from app.models import *  # noqa: F401, F403 — register all models with metadata
from app.scheduler.setup import create_scheduler, set_scheduler
from app.services.telegram_service import TelegramNotificationService

logger = logging.getLogger(__name__)

telegram = TelegramNotificationService(
    bot_token=settings.telegram_bot_token,
    chat_id=settings.telegram_chat_id,
    app_name=settings.app_name,
    app_url=settings.app_base_url or None,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    from app.db.migrate import (
        migrate_add_project_offers_enabled,
        migrate_add_task_category_id,
        migrate_add_user_admin_fields,
        migrate_add_user_preferences,
        migrate_backfill_category_group,
        migrate_recurring_rules_to_structured,
    )
    from app.db.session import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await migrate_recurring_rules_to_structured(engine)
    await migrate_add_user_preferences(engine)
    await migrate_add_user_admin_fields(engine)
    await migrate_add_task_category_id(engine)
    await migrate_add_project_offers_enabled(engine)
    await migrate_backfill_category_group(engine)

    Session = async_sessionmaker(engine, expire_on_commit=False)
    scheduler = create_scheduler(Session)
    set_scheduler(scheduler)
    scheduler.start()

    await telegram.send_startup(version=settings.app_version, pod_name=settings.pod_name or None)

    shutdown_reason = "graceful"
    try:
        yield
    except BaseException as e:
        shutdown_reason = f"error: {type(e).__name__}"
        try:
            await telegram.send_crash(
                error=e,
                version=settings.app_version,
                pod_name=settings.pod_name or None,
            )
        except Exception:
            logger.exception("Failed to send crash notification")
        raise
    finally:
        scheduler.shutdown(wait=False)
        try:
            await telegram.send_shutdown(
                version=settings.app_version,
                pod_name=settings.pod_name or None,
                reason=shutdown_reason,
            )
        except Exception:
            logger.exception("Failed to send shutdown notification")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
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
app.include_router(categories.router)
app.include_router(tasks.router)
app.include_router(household_points.router)
app.include_router(sse.router)
app.include_router(ha.router)


@app.get("/health", response_model=None)
async def health() -> JSONResponse | dict:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        reason = f"db ping failed: {type(e).__name__}"
        logger.error(reason, exc_info=True)
        try:
            await telegram.send_health_failure(
                reason=reason,
                version=settings.app_version,
                pod_name=settings.pod_name or None,
            )
        except Exception:
            logger.exception("Failed to send health failure notification")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "app": settings.app_name, "database": "disconnected"},
        )
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}


# Serve frontend SPA — must be last so API routes take priority.
# Falls back gracefully if static/ doesn't exist (dev without a build).
_static = Path(__file__).parent.parent / "static"
if _static.exists():
    # Serve real asset files directly; fall back to index.html for all SPA routes.
    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa_catchall(full_path: str) -> FileResponse:
        candidate = _static / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_static / "index.html"))
