import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_task_repo, raise_http
from app.api.schemas import TaskOut, TokenResponse
from app.config import settings
from app.exceptions import DoenError
from app.models.task import Task
from app.models.user import User
from app.repositories.group_repo import GroupRepository
from app.repositories.project_repo import ProjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.user_repo import UserRepository
from app.services.ha_oauth import (
    build_authorize_url,
    exchange_code,
    login_or_create_ha_user,
    pop_state,
)
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/ha", tags=["ha"])

# token_hash → user_id, for HA webhook action button auth
_webhook_tokens: dict[str, str] = {}


# ── OAuth ─────────────────────────────────────────────────────────────────────

@router.get("/login")
async def ha_login(
    redirect_uri: str = Query(default="http://localhost:5173/ha/callback"),
) -> dict:
    if not settings.ha_base_url or not settings.ha_client_id:
        raise HTTPException(status_code=501, detail="HA OAuth not configured")
    url, state = build_authorize_url(redirect_uri)
    return {"auth_url": url, "state": state}


@router.get("/callback", response_model=TokenResponse)
async def ha_callback(
    code: str = Query(),
    state: str = Query(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if not settings.ha_base_url:
        raise HTTPException(status_code=501, detail="HA OAuth not configured")

    redirect_uri = pop_state(state)
    if redirect_uri is None:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    try:
        user_repo = UserRepository(db)
        ha_tokens = await exchange_code(code, redirect_uri)
        access, refresh = await login_or_create_ha_user(ha_tokens, user_repo)
    except DoenError as exc:
        raise_http(exc)

    return TokenResponse(access_token=access, refresh_token=refresh)


# ── Sensors ───────────────────────────────────────────────────────────────────

@router.get("/sensors")
async def ha_sensors(
    current_user: User = Depends(get_current_user),
    task_repo: TaskRepository = Depends(get_task_repo),
) -> dict:
    """Sensor payload for HA custom integration entities."""
    now = datetime.now(UTC)
    session = task_repo._session

    group_repo = GroupRepository(session)
    project_repo = ProjectRepository(session)

    group_ids = await group_repo.list_group_ids_for_user(current_user.id)
    projects = await project_repo.list_for_user(current_user.id, group_ids)
    project_ids = [p.id for p in projects]

    if not project_ids:
        return {"tasks_total": 0, "tasks_due_today": 0, "tasks_overdue": 0, "has_overdue": False}

    total = (await session.execute(
        select(func.count()).where(Task.project_id.in_(project_ids), Task.status != "done")
    )).scalar_one()

    due_today = (await session.execute(
        select(func.count()).where(
            Task.project_id.in_(project_ids),
            Task.status != "done",
            func.date(Task.due_date) == func.date(now),
        )
    )).scalar_one()

    overdue = (await session.execute(
        select(func.count()).where(
            Task.project_id.in_(project_ids),
            Task.status != "done",
            Task.due_date < now,
        )
    )).scalar_one()

    return {
        "tasks_total": total,
        "tasks_due_today": due_today,
        "tasks_overdue": overdue,
        "has_overdue": overdue > 0,
    }


# ── Card data ─────────────────────────────────────────────────────────────────

@router.get("/card-data")
async def ha_card_data(
    current_user: User = Depends(get_current_user),
    task_repo: TaskRepository = Depends(get_task_repo),
    group_id: str | None = Query(default=None),
) -> dict:
    """Compact task payload for the HACS Lovelace card."""
    now = datetime.now(UTC)
    session = task_repo._session

    group_repo = GroupRepository(session)
    project_repo = ProjectRepository(session)

    group_ids = await group_repo.list_group_ids_for_user(current_user.id)
    projects = await project_repo.list_for_user(current_user.id, group_ids)

    if group_id:
        projects = [p for p in projects if p.group_id == group_id]

    project_ids = [p.id for p in projects]
    if not project_ids:
        return {"today": [], "overdue": []}

    def _slim(t: Task) -> dict:
        return {
            "id": t.id,
            "title": t.title,
            "priority": t.priority,
            "project_id": t.project_id,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }

    today_tasks = [
        _slim(t) for t in (await session.execute(
            select(Task).where(
                Task.project_id.in_(project_ids),
                Task.status != "done",
                func.date(Task.due_date) == func.date(now),
            ).order_by(Task.priority.desc())
        )).scalars().all()
    ]

    overdue_tasks = [
        _slim(t) for t in (await session.execute(
            select(Task).where(
                Task.project_id.in_(project_ids),
                Task.status != "done",
                Task.due_date < now,
            ).order_by(Task.due_date.asc())
        )).scalars().all()
    ]

    return {"today": today_tasks, "overdue": overdue_tasks}


# ── Webhook ───────────────────────────────────────────────────────────────────

class WebhookTokenResponse(BaseModel):
    token: str


@router.post("/webhook-token", response_model=WebhookTokenResponse)
async def create_webhook_token(current_user: User = Depends(get_current_user)) -> dict:
    """Generate a per-user webhook token for HA notification action buttons."""
    token = secrets.token_urlsafe(32)
    _webhook_tokens[hashlib.sha256(token.encode()).hexdigest()] = current_user.id
    return {"token": token}


class WebhookPayload(BaseModel):
    action: str  # "complete" | "snooze"
    task_id: str
    snooze_hours: int = 1


@router.post("/webhook/{token}", status_code=status.HTTP_200_OK)
async def ha_webhook(
    token: str,
    body: WebhookPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Inbound from HA notification action buttons (Done / Snooze 1h)."""
    user_id = _webhook_tokens.get(hashlib.sha256(token.encode()).hexdigest())
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    task_repo = TaskRepository(db)
    task = await task_repo.get_by_id(body.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.action == "complete":
        completed = await task_repo.complete(task)
        payload = TaskOut.model_validate(completed).model_dump(mode="json")
        await sse_bus.publish(user_id, "task_completed", payload)
        return {"result": "completed"}

    if body.action == "snooze":
        new_due = datetime.now(UTC) + timedelta(hours=body.snooze_hours)
        await task_repo.update(task, {"due_date": new_due})
        return {"result": "snoozed", "new_due": new_due.isoformat()}

    raise HTTPException(status_code=400, detail="Unknown action")
