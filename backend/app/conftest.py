from datetime import UTC, datetime, timedelta

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import Base, get_db
from app.main import app
from app.models.base import new_uuid
from app.models.group import Group, GroupMember
from app.models.project import Project
from app.models.task import RecurringRule, Task
from app.models.user import LocalCredential, User
from app.services.auth import hash_password

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(loop_scope="function")
async def db_engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def db_session(db_engine) -> AsyncSession:
    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture(loop_scope="function")
async def seed_data(db_session: AsyncSession) -> dict:
    """Canonical dataset shared by all tests. Returns domain objects by name."""
    now = datetime.now(UTC)

    # ── Users ─────────────────────────────────────────────────────────────────
    alice = User(id=new_uuid(), email="henk@example.com", name="Henk")
    bob = User(id=new_uuid(), email="piet@example.com", name="Piet")
    db_session.add_all([alice, bob])
    await db_session.flush()

    db_session.add(LocalCredential(user_id=alice.id, password_hash=hash_password("henk123")))
    db_session.add(LocalCredential(user_id=bob.id, password_hash=hash_password("piet123")))
    await db_session.flush()

    # ── Group ─────────────────────────────────────────────────────────────────
    household = Group(id=new_uuid(), name="De Zooiboel", type="household", owner_id=alice.id)
    db_session.add(household)
    await db_session.flush()
    db_session.add(GroupMember(group_id=household.id, user_id=alice.id, role="admin"))
    db_session.add(GroupMember(group_id=household.id, user_id=bob.id, role="member"))
    await db_session.flush()

    # ── Projects ──────────────────────────────────────────────────────────────
    alice_personal = Project(
        id=new_uuid(), name="Henk Zijn Rommel", owner_id=alice.id, color="#6366f1"
    )
    bob_personal = Project(
        id=new_uuid(), name="Piet Zijn Puinhoop", owner_id=bob.id, color="#6366f1"
    )
    group_project = Project(
        id=new_uuid(),
        name="De Gezamenlijke Ellende",
        owner_id=alice.id,
        color="#10b981",
        group_id=household.id,
    )
    db_session.add_all([alice_personal, bob_personal, group_project])
    await db_session.flush()

    # ── Tasks ─────────────────────────────────────────────────────────────────
    todo_task = Task(
        id=new_uuid(),
        title="De rommel in de garage opruimen",
        project_id=alice_personal.id,
        status="todo",
        priority="medium",
    )
    done_task = Task(
        id=new_uuid(),
        title="Boodschappen doen (eindelijk)",
        project_id=alice_personal.id,
        status="done",
        priority="none",
        completed_at=now - timedelta(days=1),
    )
    overdue_task = Task(
        id=new_uuid(),
        title="Belasting aangifte (al 3 dagen te laat)",
        project_id=alice_personal.id,
        status="todo",
        priority="high",
        due_date=now - timedelta(days=3),
    )
    group_task = Task(
        id=new_uuid(),
        title="Piet moet de vaatwasser uitruimen",
        project_id=group_project.id,
        status="todo",
        priority="low",
        assignee_id=bob.id,
    )
    recurring_template = Task(
        id=new_uuid(),
        title="Wekelijks de vuilnisbakken buiten zetten",
        project_id=group_project.id,
        status="todo",
        priority="none",
    )
    db_session.add_all([todo_task, done_task, overdue_task, group_task, recurring_template])
    await db_session.flush()

    recurring_rule = RecurringRule(
        id=new_uuid(),
        template_task_id=recurring_template.id,
        schedule_cron="0 8 * * 1",
        notify_on_spawn=True,
        active=True,
    )
    db_session.add(recurring_rule)
    await db_session.commit()

    return {
        "henk": alice,
        "piet": bob,
        "zooiboel": household,
        "henk_personal": alice_personal,
        "piet_personal": bob_personal,
        "gezamenlijke_ellende": group_project,
        "todo_task": todo_task,
        "done_task": done_task,
        "overdue_task": overdue_task,
        "group_task": group_task,
        "recurring_template": recurring_template,
        "recurring_rule": recurring_rule,
    }


@pytest_asyncio.fixture(loop_scope="function")
async def client(db_session: AsyncSession):
    """HTTP client with empty DB — for auth registration/login tests."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=True),
        base_url="http://test",
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(loop_scope="function")
async def seeded_client(db_session: AsyncSession, seed_data: dict):
    """HTTP client with canonical seed data pre-loaded."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=True),
        base_url="http://test",
    ) as c:
        yield c
    app.dependency_overrides.clear()
