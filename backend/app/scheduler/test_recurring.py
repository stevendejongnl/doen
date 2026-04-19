from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.task import RecurringRule, Task
from app.scheduler.recurring import _is_due, spawn_due_tasks

# ── _is_due unit tests — use a plain dataclass, not a SQLAlchemy instance ─────

@dataclass
class _FakeRule:
    schedule_cron: str
    last_spawned_at: datetime | None
    active: bool = True


def test_is_due_when_never_spawned():
    rule = _FakeRule("* * * * *", None)
    assert _is_due(rule, datetime.now(UTC)) is True  # type: ignore[arg-type]


def test_is_due_when_last_spawn_before_last_expected_tick():
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    rule = _FakeRule("* * * * *", now - timedelta(minutes=2))
    assert _is_due(rule, now) is True  # type: ignore[arg-type]


def test_not_due_when_recently_spawned():
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    rule = _FakeRule("* * * * *", now)
    assert _is_due(rule, now) is False  # type: ignore[arg-type]


def test_is_due_handles_naive_last_spawned_at():
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    naive = (now - timedelta(minutes=5)).replace(tzinfo=None)
    rule = _FakeRule("* * * * *", naive)
    assert _is_due(rule, now) is True  # type: ignore[arg-type]


def test_is_due_returns_false_on_invalid_cron():
    rule = _FakeRule("not a cron expression at all", None)
    assert _is_due(rule, datetime.now(UTC)) is False  # type: ignore[arg-type]


# ── spawn_due_tasks integration tests ─────────────────────────────────────────

@pytest_asyncio.fixture(loop_scope="function")
async def session_factory(db_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Return a session factory bound to the test engine."""
    return async_sessionmaker(db_engine, expire_on_commit=False)


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_creates_task_from_template(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    rule: RecurringRule = seed_data["recurring_rule"]
    rule.last_spawned_at = None
    await db_session.commit()

    count = await spawn_due_tasks(session_factory)

    assert count == 1


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_copies_template_fields(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    from sqlalchemy import select

    rule: RecurringRule = seed_data["recurring_rule"]
    template: Task = seed_data["recurring_template"]
    # Capture values before expire_all invalidates the ORM objects
    template_id = template.id
    project_id = template.project_id
    expected_title = template.title
    expected_priority = template.priority
    rule.last_spawned_at = None
    await db_session.commit()

    await spawn_due_tasks(session_factory)

    # Expire so we pick up rows committed by the spawner's separate session
    db_session.expire_all()
    result = await db_session.execute(
        select(Task).where(
            Task.project_id == project_id,
            Task.title == expected_title,
            Task.id != template_id,
        )
    )
    spawned = result.scalars().all()
    assert len(spawned) == 1
    t = spawned[0]
    assert t.priority == expected_priority
    assert t.status == "todo"
    assert t.completed_at is None


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_updates_last_spawned_at(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    rule: RecurringRule = seed_data["recurring_rule"]
    rule.last_spawned_at = None
    await db_session.commit()
    before = datetime.now(UTC).replace(tzinfo=None)

    await spawn_due_tasks(session_factory)

    db_session.expire_all()
    await db_session.refresh(rule)
    assert rule.last_spawned_at is not None
    # SQLite stores without tz — strip tz from before for comparison
    stored = rule.last_spawned_at
    if stored.tzinfo is not None:
        stored = stored.replace(tzinfo=None)
    assert stored >= before


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_skips_when_not_due(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    rule: RecurringRule = seed_data["recurring_rule"]
    rule.last_spawned_at = datetime.now(UTC)
    await db_session.commit()

    count = await spawn_due_tasks(session_factory)

    assert count == 0


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_skips_inactive_rule(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    rule: RecurringRule = seed_data["recurring_rule"]
    rule.last_spawned_at = None
    rule.active = False
    await db_session.commit()

    count = await spawn_due_tasks(session_factory)

    assert count == 0


@pytest.mark.asyncio(loop_scope="function")
async def test_spawn_does_not_double_spawn(
    seed_data: dict, db_session: AsyncSession, session_factory
):
    rule: RecurringRule = seed_data["recurring_rule"]
    rule.last_spawned_at = None
    await db_session.commit()

    count1 = await spawn_due_tasks(session_factory)
    count2 = await spawn_due_tasks(session_factory)

    assert count1 == 1
    assert count2 == 0
