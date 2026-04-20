from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.base import new_uuid
from app.models.group import GroupMember
from app.models.project import Project
from app.models.task import RecurringRule, Task
from app.services.sse_bus import sse_bus


async def spawn_due_tasks(Session: async_sessionmaker[AsyncSession]) -> int:
    """Query all active recurring rules and spawn tasks that are due. Returns spawn count."""
    now = datetime.now(UTC)
    spawned = 0

    async with Session() as session:
        result = await session.execute(
            select(RecurringRule).where(RecurringRule.active == True)  # noqa: E712
        )
        rules = list(result.scalars().all())

        for rule in rules:
            if not _is_due(rule, now):
                continue

            template_result = await session.execute(
                select(Task).where(Task.id == rule.template_task_id)
            )
            template = template_result.scalar_one_or_none()
            if not template:
                continue

            task = Task(
                id=new_uuid(),
                title=template.title,
                notes=template.notes,
                project_id=template.project_id,
                assignee_id=template.assignee_id,
                priority=template.priority,
                status="todo",
            )
            session.add(task)
            rule.last_spawned_at = now
            spawned += 1

            await session.flush()
            user_ids = await _user_ids_for_project(session, template.project_id)
            await sse_bus.publish_to_group(
                user_ids=user_ids,
                event="task_created",
                data={
                    "id": task.id,
                    "title": task.title,
                    "project_id": task.project_id,
                    "status": task.status,
                    "priority": task.priority,
                    "from_recurring_rule": rule.id,
                },
            )

        if spawned:
            await session.commit()

    return spawned


async def _user_ids_for_project(session: AsyncSession, project_id: str) -> list[str]:
    """Return all user IDs who have access to the project (owner + group members)."""
    proj_result = await session.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        return []

    user_ids = {project.owner_id}

    if project.group_id:
        members_result = await session.execute(
            select(GroupMember.user_id).where(GroupMember.group_id == project.group_id)
        )
        for uid in members_result.scalars().all():
            user_ids.add(uid)

    return list(user_ids)


# ── Structured recurrence evaluation ──────────────────────────────────────────

def _is_due(rule: RecurringRule, now: datetime) -> bool:
    """True if the most recent scheduled time for this rule is later than last_spawned_at."""
    last_expected = _previous_scheduled_time(rule, now)
    if last_expected is None:
        return False
    if rule.last_spawned_at is None:
        return True
    last = rule.last_spawned_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    return last_expected > last


def _previous_scheduled_time(rule: RecurringRule, now: datetime) -> datetime | None:
    """Find the most recent scheduled firing time <= now, honoring the rule's anchor.

    Returns None if the rule has no scheduled time before `now` (e.g. brand-new rule
    whose first tick is in the future, or malformed rule).
    """
    tod = _parse_time_of_day(rule.time_of_day)
    anchor_dt = _anchor_aware(rule)
    anchor_date = anchor_dt.date()
    interval = max(1, rule.interval or 1)
    parity = rule.parity or "any"

    today = now.astimezone(UTC).date()
    # Search backwards up to ~400 days — enough for monthly/interval-heavy rules.
    for offset in range(0, 400):
        candidate = today - timedelta(days=offset)
        if candidate < anchor_date:
            return None
        if not _date_matches(rule, candidate, anchor_date, interval, parity):
            continue
        candidate_dt = datetime.combine(candidate, tod, tzinfo=UTC)
        if candidate_dt > now:
            continue
        if candidate_dt < anchor_dt:
            # Scheduled time falls before the rule was created — skip to avoid spurious backfills.
            return None
        return candidate_dt
    return None


def _date_matches(
    rule: RecurringRule, d: date, anchor: date, interval: int, parity: str
) -> bool:
    if rule.unit == "day":
        days = (d - anchor).days
        if days < 0 or days % interval != 0:
            return False
        return _parity_ok(d.day, parity)
    if rule.unit == "week":
        weekdays = _parse_weekdays(rule.weekdays)
        if not weekdays or d.weekday() not in weekdays:
            return False
        weeks = ((d - _monday_of(anchor)).days) // 7
        if weeks < 0 or weeks % interval != 0:
            return False
        iso_week = d.isocalendar().week
        return _parity_ok(iso_week, parity)
    if rule.unit == "month":
        if rule.month_day is None or d.day != rule.month_day:
            return False
        months = (d.year - anchor.year) * 12 + (d.month - anchor.month)
        if months < 0 or months % interval != 0:
            return False
        return _parity_ok(d.month, parity)
    return False


def _anchor_aware(rule: RecurringRule) -> datetime:
    anchor = rule.created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    return anchor


def _parse_weekdays(csv: str | None) -> set[int]:
    if not csv:
        return set()
    out: set[int] = set()
    for part in csv.split(","):
        part = part.strip()
        if part.isdigit():
            n = int(part)
            if 0 <= n <= 6:
                out.add(n)
    return out


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _parse_time_of_day(s: str | None) -> time:
    if not s:
        return time(8, 0)
    try:
        hh, mm = s.split(":")
        return time(int(hh), int(mm))
    except (ValueError, AttributeError):
        return time(8, 0)


def _parity_ok(n: int, parity: str) -> bool:
    if parity == "odd":
        return n % 2 == 1
    if parity == "even":
        return n % 2 == 0
    return True
