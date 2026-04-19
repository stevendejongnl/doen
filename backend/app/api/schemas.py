from datetime import datetime

from pydantic import BaseModel, EmailStr

# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User ─────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Group ─────────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    type: str = "custom"  # personal | household | custom


class GroupUpdate(BaseModel):
    name: str | None = None
    type: str | None = None


class GroupOut(BaseModel):
    id: str
    name: str
    type: str
    owner_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "member"


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#6366f1"
    group_id: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    color: str
    group_id: str | None
    owner_id: str
    archived_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    notes: str | None = None
    assignee_id: str | None = None
    priority: str = "none"
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    assignee_id: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    notes: str | None
    project_id: str
    assignee_id: str | None
    status: str
    priority: str
    due_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Recurring ─────────────────────────────────────────────────────────────────

class RecurringRuleCreate(BaseModel):
    schedule_cron: str
    notify_on_spawn: bool = False


class RecurringRuleOut(BaseModel):
    id: str
    template_task_id: str
    schedule_cron: str
    last_spawned_at: datetime | None
    notify_on_spawn: bool
    active: bool

    model_config = {"from_attributes": True}
