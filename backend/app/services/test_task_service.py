import pytest

from app.exceptions import AccessDeniedError, ConflictError, NotFoundError
from app.repositories.group_repo import GroupRepository
from app.repositories.project_repo import ProjectRepository
from app.repositories.task_repo import TaskRepository
from app.services.project_service import ProjectService
from app.services.task_service import TaskService


def _service(db_session) -> TaskService:
    return TaskService(
        task_repo=TaskRepository(db_session),
        project_service=ProjectService(ProjectRepository(db_session), GroupRepository(db_session)),
        group_repo=GroupRepository(db_session),
    )


@pytest.mark.asyncio
async def test_list_tasks_for_project_returns_seeded_tasks(db_session, seed_data):
    # Given alice's personal project has tasks in the seed data
    svc = _service(db_session)

    # When alice lists tasks in her project
    tasks = await svc.list_tasks_for_project(
        seed_data["henk_personal"].id, seed_data["henk"].id
    )
    titles = {t.title for t in tasks}

    # Then all seeded tasks are present
    assert "De rommel in de garage opruimen" in titles
    assert "Boodschappen doen (eindelijk)" in titles
    assert "Belasting aangifte (al 3 dagen te laat)" in titles


@pytest.mark.asyncio
async def test_list_tasks_raises_access_denied_for_wrong_user(db_session, seed_data):
    # Given bob has no access to alice's personal project
    svc = _service(db_session)

    with pytest.raises(AccessDeniedError):
        await svc.list_tasks_for_project(
            seed_data["henk_personal"].id, seed_data["piet"].id
        )


@pytest.mark.asyncio
async def test_create_task_in_personal_project(db_session, seed_data):
    # Given alice owns alice_personal
    svc = _service(db_session)

    # When alice creates a task
    task, member_ids = await svc.create_task(
        project_id=seed_data["henk_personal"].id,
        requesting_user_id=seed_data["henk"].id,
        title="New task",
        notes=None,
        assignee_id=None,
        priority="medium",
        due_date=None,
    )

    # Then the task is created with correct fields
    assert task.title == "New task"
    assert task.status == "todo"
    # Then member_ids includes alice (personal project = owner only)
    assert seed_data["henk"].id in member_ids


@pytest.mark.asyncio
async def test_create_task_raises_access_denied_for_wrong_user(db_session, seed_data):
    # Given bob has no access to alice's personal project
    svc = _service(db_session)

    with pytest.raises(AccessDeniedError):
        await svc.create_task(
            project_id=seed_data["henk_personal"].id,
            requesting_user_id=seed_data["piet"].id,
            title="Sneaky task",
            notes=None,
            assignee_id=None,
            priority="none",
            due_date=None,
        )


@pytest.mark.asyncio
async def test_create_task_in_group_project_notifies_all_members(db_session, seed_data):
    # Given the group project is shared between alice and bob
    svc = _service(db_session)

    # When alice creates a task in the group project
    _, member_ids = await svc.create_task(
        project_id=seed_data["gezamenlijke_ellende"].id,
        requesting_user_id=seed_data["henk"].id,
        title="Shared task",
        notes=None,
        assignee_id=None,
        priority="none",
        due_date=None,
    )

    # Then both alice and bob are in the member_ids for SSE
    assert seed_data["henk"].id in member_ids
    assert seed_data["piet"].id in member_ids


@pytest.mark.asyncio
async def test_complete_task_sets_done_status(db_session, seed_data):
    # Given the todo task
    svc = _service(db_session)

    # When completed
    task, _ = await svc.complete_task(seed_data["todo_task"].id)

    # Then status is done and completed_at is set
    assert task.status == "done"
    assert task.completed_at is not None


@pytest.mark.asyncio
async def test_update_task_title(db_session, seed_data):
    svc = _service(db_session)
    updated, _ = await svc.update_task(seed_data["todo_task"].id, {"title": "Updated"})
    assert updated.title == "Updated"


@pytest.mark.asyncio
async def test_delete_task(db_session, seed_data):
    svc = _service(db_session)
    task_id, _ = await svc.delete_task(seed_data["todo_task"].id)

    # Then it is gone
    with pytest.raises(NotFoundError):
        await svc.get_task(task_id)


@pytest.mark.asyncio
async def test_get_task_raises_not_found(db_session, seed_data):
    svc = _service(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_task("nonexistent")


@pytest.mark.asyncio
async def test_create_recurring_rule(db_session, seed_data):
    # Given the todo task has no recurring rule
    svc = _service(db_session)

    # When creating a rule
    rule = await svc.create_recurring_rule(
        task_id=seed_data["todo_task"].id,
        schedule_cron="0 8 * * 1",
        notify_on_spawn=True,
    )

    # Then the rule is returned with correct fields
    assert rule.schedule_cron == "0 8 * * 1"
    assert rule.notify_on_spawn is True
    assert rule.active is True


@pytest.mark.asyncio
async def test_create_recurring_rule_raises_conflict_if_already_exists(db_session, seed_data):
    # Given the recurring_template already has a rule (from seed data)
    svc = _service(db_session)

    with pytest.raises(ConflictError):
        await svc.create_recurring_rule(
            task_id=seed_data["recurring_template"].id,
            schedule_cron="0 9 * * 2",
            notify_on_spawn=False,
        )


@pytest.mark.asyncio
async def test_delete_recurring_rule(db_session, seed_data):
    svc = _service(db_session)
    await svc.delete_recurring_rule(seed_data["recurring_rule"].id)

    # Then it is gone — creating a new rule on the template should now succeed
    rule = await svc.create_recurring_rule(
        task_id=seed_data["recurring_template"].id,
        schedule_cron="0 10 * * 3",
        notify_on_spawn=False,
    )
    assert rule.schedule_cron == "0 10 * * 3"


@pytest.mark.asyncio
async def test_list_all_tasks_overdue(db_session, seed_data):
    # Given alice has an overdue task in her personal project
    svc = _service(db_session)

    # When listing overdue tasks for alice
    tasks = await svc.list_all_tasks(seed_data["henk"].id, overdue=True)
    titles = {t.title for t in tasks}

    # Then the overdue task is in the results
    assert "Belasting aangifte (al 3 dagen te laat)" in titles
    assert "Boodschappen doen (eindelijk)" not in titles
