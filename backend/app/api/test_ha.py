import pytest
from httpx import AsyncClient

from app.models.task import Task


def _headers(user) -> dict:
    from app.services.auth import create_access_token
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio(loop_scope="function")
async def test_ha_login_returns_auth_url_or_501(seeded_client: AsyncClient, seed_data):
    resp = await seeded_client.get("/ha/login", headers=_headers(seed_data["henk"]))
    # Returns 501 when HA not configured, 200 with auth_url when HA_BASE_URL is set
    assert resp.status_code in (200, 501)
    if resp.status_code == 200:
        assert "auth_url" in resp.json()


@pytest.mark.asyncio(loop_scope="function")
async def test_sensors_returns_counts(seeded_client: AsyncClient, seed_data):
    resp = await seeded_client.get("/ha/sensors", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 200
    data = resp.json()
    assert "tasks_total" in data
    assert "tasks_due_today" in data
    assert "tasks_overdue" in data
    assert isinstance(data["has_overdue"], bool)
    assert data["tasks_total"] >= 1
    # overdue task is in seed data
    assert data["tasks_overdue"] >= 1
    assert data["has_overdue"] is True


@pytest.mark.asyncio(loop_scope="function")
async def test_sensors_requires_auth(seeded_client: AsyncClient):
    resp = await seeded_client.get("/ha/sensors")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio(loop_scope="function")
async def test_card_data_returns_today_and_overdue(seeded_client: AsyncClient, seed_data):
    resp = await seeded_client.get("/ha/card-data", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 200
    data = resp.json()
    assert "today" in data
    assert "overdue" in data
    assert isinstance(data["today"], list)
    assert isinstance(data["overdue"], list)
    # overdue task should appear
    assert len(data["overdue"]) >= 1


@pytest.mark.asyncio(loop_scope="function")
async def test_card_data_group_filter(seeded_client: AsyncClient, seed_data):
    group_id = seed_data["zooiboel"].id
    resp = await seeded_client.get(
        f"/ha/card-data?group_id={group_id}",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    data = resp.json()
    # All returned tasks must belong to projects in the household group
    all_tasks = data["today"] + data["overdue"]
    # tasks from personal projects should not appear
    personal_project_id = seed_data["henk_personal"].id
    for task in all_tasks:
        assert task["project_id"] != personal_project_id


@pytest.mark.asyncio(loop_scope="function")
async def test_webhook_token_and_complete(seeded_client: AsyncClient, seed_data):
    # Get a webhook token
    resp = await seeded_client.post("/ha/webhook-token", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 200
    token = resp.json()["token"]

    # Use it to complete a task via webhook
    task: Task = seed_data["todo_task"]
    resp = await seeded_client.post(
        f"/ha/webhook/{token}",
        json={"action": "complete", "task_id": task.id},
    )
    assert resp.status_code == 200
    assert resp.json()["result"] == "completed"


@pytest.mark.asyncio(loop_scope="function")
async def test_webhook_token_and_snooze(seeded_client: AsyncClient, seed_data):
    resp = await seeded_client.post("/ha/webhook-token", headers=_headers(seed_data["henk"]))
    token = resp.json()["token"]

    task: Task = seed_data["overdue_task"]
    resp = await seeded_client.post(
        f"/ha/webhook/{token}",
        json={"action": "snooze", "task_id": task.id, "snooze_hours": 2},
    )
    assert resp.status_code == 200
    assert resp.json()["result"] == "snoozed"
    assert "new_due" in resp.json()


@pytest.mark.asyncio(loop_scope="function")
async def test_webhook_invalid_token_returns_401(seeded_client: AsyncClient, seed_data):
    task: Task = seed_data["todo_task"]
    resp = await seeded_client.post(
        "/ha/webhook/niet-geldig-token",
        json={"action": "complete", "task_id": task.id},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio(loop_scope="function")
async def test_webhook_unknown_action_returns_400(seeded_client: AsyncClient, seed_data):
    resp = await seeded_client.post("/ha/webhook-token", headers=_headers(seed_data["henk"]))
    token = resp.json()["token"]

    task: Task = seed_data["todo_task"]
    resp = await seeded_client.post(
        f"/ha/webhook/{token}",
        json={"action": "teleporteren", "task_id": task.id},
    )
    assert resp.status_code == 400
