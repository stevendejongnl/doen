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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── API keys ──────────────────────────────────────────────────────────────────

class ApiKeyCreateRequest(BaseModel):
    name: str
    expires_at: datetime | None = None


class ApiKeyOut(BaseModel):
    id: str
    name: str
    token_prefix: str
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreateResponse(BaseModel):
    key: ApiKeyOut
    token: str  # plaintext; returned exactly once


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


# ── Invitations ───────────────────────────────────────────────────────────────

class InvitationDetailsOut(BaseModel):
    group_id: str
    group_name: str
    inviter_name: str
    email: str
    existing_user: bool


class InvitationAcceptRequest(BaseModel):
    """For new-user signup via invite. Omit to accept as the currently-logged-in user."""
    name: str | None = None
    password: str | None = None


class InvitationAcceptResponse(BaseModel):
    group_id: str
    user_id: str
    tokens: TokenResponse | None = None


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
    recurring_rule: "RecurringRuleOut | None" = None

    model_config = {"from_attributes": True}


# ── Recurring ─────────────────────────────────────────────────────────────────

class RecurringRuleCreate(BaseModel):
    unit: str = "week"            # day | week | month
    interval: int = 1
    weekdays: str | None = None   # CSV of 0..6 (Mon..Sun), used when unit='week'
    month_day: int | None = None  # 1..31, used when unit='month'
    time_of_day: str = "08:00"
    parity: str = "any"           # any | odd | even
    notify_on_spawn: bool = False


class RecurringRuleUpdate(BaseModel):
    unit: str | None = None
    interval: int | None = None
    weekdays: str | None = None
    month_day: int | None = None
    time_of_day: str | None = None
    parity: str | None = None
    notify_on_spawn: bool | None = None
    active: bool | None = None


class RecurringRuleOut(BaseModel):
    id: str
    template_task_id: str
    unit: str
    interval: int
    weekdays: str | None
    month_day: int | None
    time_of_day: str
    parity: str
    last_spawned_at: datetime | None
    notify_on_spawn: bool
    active: bool

    model_config = {"from_attributes": True}
