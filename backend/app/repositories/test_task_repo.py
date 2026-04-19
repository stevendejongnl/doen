from datetime import datetime, timedelta, timezone

import pytest
from app.repositories.task_repo import TaskRepository


@pytest.mark.asyncio
async def test_create_task_persists_with_defaults(db_session, seed_data):
    # Given alice's personal project
    repo = TaskRepository(db_session)

    # When a task is created
    task = await repo.create(
        title="Wash dishes",
        notes=None,
        project_id=seed_data["henk_personal"].id,
        assignee_id=None,
        priority="medium",
        due_date=None,
    )

    # Then it is retrievable with correct defaults
    fetched = await repo.get_by_id(task.id)
    assert fetched is not None
    assert fetched.title == "Wash dishes"
    assert fetched.status == "todo"
    assert fetched.priority == "medium"
    assert fetched.completed_at is None


@pytest.mark.asyncio
async def test_list_for_project_returns_all_tasks(db_session, seed_data):
    # Given alice's personal project has tasks in seed data (todo, done, overdue)
    repo = TaskRepository(db_session)

    # When listing tasks for that project
    tasks = await repo.list_for_project(seed_data["henk_personal"].id)
    titles = {t.title for t in tasks}

    # Then all seeded tasks are present
    assert "De rommel in de garage opruimen" in titles
    assert "Boodschappen doen (eindelijk)" in titles
    assert "Belasting aangifte (al 3 dagen te laat)" in titles


@pytest.mark.asyncio
async def test_list_accessible_filters_overdue(db_session, seed_data):
    # Given project IDs accessible to alice
    repo = TaskRepository(db_session)
    project_ids = [seed_data["henk_personal"].id, seed_data["gezamenlijke_ellende"].id]

    # When filtering for overdue tasks
    tasks = await repo.list_accessible(project_ids, overdue=True)
    titles = {t.title for t in tasks}

    # Then only overdue (past due_date, not done) tasks appear
    assert "Belasting aangifte (al 3 dagen te laat)" in titles
    assert "Boodschappen doen (eindelijk)" not in titles
    assert "De rommel in de garage opruimen" not in titles  # no due date


@pytest.mark.asyncio
async def test_complete_task_sets_status_and_timestamp(db_session, seed_data):
    # Given the todo task
    repo = TaskRepository(db_session)
    task = await repo.get_by_id(seed_data["todo_task"].id)
    assert task is not None
    assert task.status == "todo"

    # When completed
    completed = await repo.complete(task)

    # Then status is done and completed_at is set
    assert completed.status == "done"
    assert completed.completed_at is not None


@pytest.mark.asyncio
async def test_update_task_title(db_session, seed_data):
    # Given the todo task
    repo = TaskRepository(db_session)
    task = await repo.get_by_id(seed_data["todo_task"].id)
    assert task is not None

    # When title is updated
    updated = await repo.update(task, {"title": "Updated title"})

    # Then the change persists
    assert updated.title == "Updated title"


@pytest.mark.asyncio
async def test_delete_task(db_session, seed_data):
    # Given the todo task
    repo = TaskRepository(db_session)
    task = await repo.get_by_id(seed_data["todo_task"].id)
    assert task is not None

    # When deleted
    await repo.delete(task)

    # Then it no longer exists
    assert await repo.get_by_id(seed_data["todo_task"].id) is None


@pytest.mark.asyncio
async def test_create_recurring_rule(db_session, seed_data):
    # Given a task with no recurring rule yet (the todo task)
    repo = TaskRepository(db_session)
    existing = await repo.get_recurring_rule(seed_data["todo_task"].id)
    assert existing is None

    # When a recurring rule is created
    rule = await repo.create_recurring_rule(
        task_id=seed_data["todo_task"].id,
        schedule_cron="0 9 * * 1",
        notify_on_spawn=True,
    )

    # Then it is retrievable
    fetched = await repo.get_recurring_rule(seed_data["todo_task"].id)
    assert fetched is not None
    assert fetched.schedule_cron == "0 9 * * 1"
    assert fetched.active is True


@pytest.mark.asyncio
async def test_get_recurring_rule_from_seed_data(db_session, seed_data):
    # Given the recurring template task from seed data
    repo = TaskRepository(db_session)

    # Then its rule is retrievable
    rule = await repo.get_recurring_rule(seed_data["recurring_template"].id)
    assert rule is not None
    assert rule.id == seed_data["recurring_rule"].id


@pytest.mark.asyncio
async def test_delete_recurring_rule(db_session, seed_data):
    # Given the seeded recurring rule
    repo = TaskRepository(db_session)
    rule = await repo.get_recurring_rule_by_id(seed_data["recurring_rule"].id)
    assert rule is not None

    # When deleted
    await repo.delete_recurring_rule(rule)

    # Then it no longer exists
    assert await repo.get_recurring_rule_by_id(seed_data["recurring_rule"].id) is None
