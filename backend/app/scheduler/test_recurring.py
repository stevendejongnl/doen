from dataclasses import dataclass
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.task import RecurringRule, Task
from app.scheduler.recurring import _is_due, spawn_due_tasks

# ── _is_due unit tests — use a plain dataclass, not a SQLAlchemy instance ─────

@dataclass
class _FakeRule:
    unit: str = "week"
    interval: int = 1
    weekdays: str | None = "0"  # Monday
    month_day: int | None = None
    time_of_day: str = "08:00"
    parity: str = "any"
    created_at: datetime = datetime(2020, 1, 6, tzinfo=UTC)  # a Monday, far in the past
    last_spawned_at: datetime | None = None
    active: bool = True


def test_is_due_when_never_spawned_and_scheduled_time_passed():
    # Monday 2024-01-08 09:00 — past the 08:00 fire time on a weekly-Monday rule
    now = datetime(2024, 1, 8, 9, 0, tzinfo=UTC)
    rule = _FakeRule(last_spawned_at=None)
    assert _is_due(rule, now) is True  # type: ignore[arg-type]


def test_not_due_when_already_spawned_today():
    now = datetime(2024, 1, 8, 9, 0, tzinfo=UTC)  # Monday 09:00
    rule = _FakeRule(last_spawned_at=datetime(2024, 1, 8, 8, 0, tzinfo=UTC))
    assert _is_due(rule, now) is False  # type: ignore[arg-type]


def test_is_due_when_last_spawn_was_previous_week():
    now = datetime(2024, 1, 15, 9, 0, tzinfo=UTC)  # following Monday
    rule = _FakeRule(last_spawned_at=datetime(2024, 1, 8, 8, 0, tzinfo=UTC))
    assert _is_due(rule, now) is True  # type: ignore[arg-type]


def test_is_due_handles_naive_last_spawned_at():
    now = datetime(2024, 1, 15, 9, 0, tzinfo=UTC)
    naive = datetime(2024, 1, 8, 8, 0)  # no tz
    rule = _FakeRule(last_spawned_at=naive)
    assert _is_due(rule, now) is True  # type: ignore[arg-type]


def test_biweekly_skips_odd_weeks_from_anchor():
    # anchor Monday 2024-01-01 → fires on week 0, skips week 1, fires on week 2
    anchor = datetime(2024, 1, 1, tzinfo=UTC)
    # The rule already fired on week 0 Monday
    last = datetime(2024, 1, 1, 8, 0, tzinfo=UTC)
    rule = _FakeRule(
        unit="week", interval=2, weekdays="0", created_at=anchor, last_spawned_at=last
    )
    # Monday of week 1 — should NOT fire (skip week)
    assert _is_due(rule, datetime(2024, 1, 8, 9, 0, tzinfo=UTC)) is False  # type: ignore[arg-type]
    # Monday of week 2 — should fire
    assert _is_due(rule, datetime(2024, 1, 15, 9, 0, tzinfo=UTC)) is True  # type: ignore[arg-type]


def test_daily_every_3_days():
    anchor = datetime(2024, 1, 1, tzinfo=UTC)
    rule = _FakeRule(unit="day", interval=3, weekdays=None, created_at=anchor)
    # Day 0, 3, 6 match
    assert _is_due(rule, datetime(2024, 1, 4, 9, 0, tzinfo=UTC)) is True  # type: ignore[arg-type]
    rule2 = _FakeRule(
        unit="day", interval=3, weekdays=None, created_at=anchor,
        last_spawned_at=datetime(2024, 1, 4, 8, 0, tzinfo=UTC),
    )
    # Day 5 — not a match
    assert _is_due(rule2, datetime(2024, 1, 6, 9, 0, tzinfo=UTC)) is False  # type: ignore[arg-type]


def test_even_week_parity():
    anchor = datetime(2020, 1, 6, tzinfo=UTC)  # well in the past
    rule = _FakeRule(unit="week", interval=1, weekdays="0", parity="even", created_at=anchor)
    # 2024-01-08 is ISO week 2 (even) — fires
    assert _is_due(rule, datetime(2024, 1, 8, 9, 0, tzinfo=UTC)) is True  # type: ignore[arg-type]
    # 2024-01-15 is ISO week 3 (odd) — doesn't fire
    rule.last_spawned_at = datetime(2024, 1, 8, 8, 0, tzinfo=UTC)
    assert _is_due(rule, datetime(2024, 1, 15, 9, 0, tzinfo=UTC)) is False  # type: ignore[arg-type]


def test_monthly_on_day_15():
    anchor = datetime(2024, 1, 15, tzinfo=UTC)
    rule = _FakeRule(unit="month", interval=1, weekdays=None, month_day=15, created_at=anchor)
    # On the 15th, at 09:00 — fires
    assert _is_due(rule, datetime(2024, 2, 15, 9, 0, tzinfo=UTC)) is True  # type: ignore[arg-type]
    # On the 20th — no
    rule2 = _FakeRule(
        unit="month", interval=1, weekdays=None, month_day=15, created_at=anchor,
        last_spawned_at=datetime(2024, 2, 15, 8, 0, tzinfo=UTC),
    )
    assert _is_due(rule2, datetime(2024, 2, 20, 9, 0, tzinfo=UTC)) is False  # type: ignore[arg-type]


def test_not_due_when_rule_is_brand_new_and_no_tick_has_passed():
    # Created today at 11am, time_of_day=08:00 → next fire is tomorrow
    anchor = datetime(2024, 1, 8, 11, 0, tzinfo=UTC)  # a Monday
    rule = _FakeRule(unit="week", interval=1, weekdays="0", created_at=anchor)
    now = datetime(2024, 1, 8, 12, 0, tzinfo=UTC)
    assert _is_due(rule, now) is False  # type: ignore[arg-type]


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
