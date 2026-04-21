import pytest

from app.services.auth import create_access_token


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_create_task_returns_201(seeded_client, seed_data):
    # Given alice owns alice_personal
    resp = await seeded_client.post(
        f"/projects/{seed_data['henk_personal'].id}/tasks",
        json={"title": "Do dishes", "priority": "medium"},
        headers=_headers(seed_data["henk"]),
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Do dishes"
    assert data["status"] == "todo"
    assert data["project_id"] == seed_data["henk_personal"].id


@pytest.mark.asyncio
async def test_create_task_in_unauthorized_project_returns_403(seeded_client, seed_data):
    # Given bob has no access to alice's personal project
    resp = await seeded_client.post(
        f"/projects/{seed_data['henk_personal'].id}/tasks",
        json={"title": "Sneaky"},
        headers=_headers(seed_data["piet"]),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_tasks_for_project(seeded_client, seed_data):
    resp = await seeded_client.get(
        f"/projects/{seed_data['henk_personal'].id}/tasks",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    titles = {t["title"] for t in resp.json()}
    assert "De rommel in de garage opruimen" in titles
    assert "Boodschappen doen (eindelijk)" in titles
    assert "Belasting aangifte (al 3 dagen te laat)" in titles


@pytest.mark.asyncio
async def test_list_all_tasks_overdue_filter(seeded_client, seed_data):
    resp = await seeded_client.get("/tasks?overdue=true", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 200
    titles = {t["title"] for t in resp.json()}
    assert "Belasting aangifte (al 3 dagen te laat)" in titles
    assert "Boodschappen doen (eindelijk)" not in titles


@pytest.mark.asyncio
async def test_date_range_excludes_unscheduled_by_default(seeded_client, seed_data):
    # Given todo_task has no due_date
    resp = await seeded_client.get(
        "/tasks?date_from=2020-01-01T00:00:00Z&date_to=2030-01-01T00:00:00Z",
        headers=_headers(seed_data["henk"]),
    )
    titles = {t["title"] for t in resp.json()}
    assert "De rommel in de garage opruimen" not in titles  # unscheduled
    assert "Belasting aangifte (al 3 dagen te laat)" in titles  # has due_date


@pytest.mark.asyncio
async def test_date_range_with_include_unscheduled(seeded_client, seed_data):
    resp = await seeded_client.get(
        "/tasks?date_from=2020-01-01T00:00:00Z&date_to=2030-01-01T00:00:00Z"
        "&include_unscheduled=true",
        headers=_headers(seed_data["henk"]),
    )
    titles = {t["title"] for t in resp.json()}
    assert "De rommel in de garage opruimen" in titles
    assert "Belasting aangifte (al 3 dagen te laat)" in titles


@pytest.mark.asyncio
async def test_update_task(seeded_client, seed_data):
    resp = await seeded_client.put(
        f"/tasks/{seed_data['todo_task'].id}",
        json={"title": "Updated title"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated title"


@pytest.mark.asyncio
async def test_complete_task(seeded_client, seed_data):
    resp = await seeded_client.post(
        f"/tasks/{seed_data['todo_task'].id}/complete",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "done"
    assert data["completed_at"] is not None


@pytest.mark.asyncio
async def test_delete_task(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/tasks/{seed_data['todo_task'].id}",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_task_not_found_returns_404(seeded_client, seed_data):
    resp = await seeded_client.get("/tasks/nonexistent", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_recurring_rule(seeded_client, seed_data):
    resp = await seeded_client.post(
        f"/tasks/{seed_data['todo_task'].id}/recurring",
        json={
            "unit": "week",
            "interval": 1,
            "weekdays": "0",
            "time_of_day": "08:00",
            "parity": "any",
            "notify_on_spawn": True,
        },
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["unit"] == "week"
    assert data["weekdays"] == "0"
    assert data["active"] is True


@pytest.mark.asyncio
async def test_create_recurring_rule_conflict_returns_409(seeded_client, seed_data):
    # Given the recurring_template already has a rule
    resp = await seeded_client.post(
        f"/tasks/{seed_data['recurring_template'].id}/recurring",
        json={
            "unit": "week",
            "interval": 1,
            "weekdays": "1",
            "time_of_day": "09:00",
            "parity": "any",
            "notify_on_spawn": False,
        },
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_patch_recurring_rule_updates_fields(seeded_client, seed_data):
    rule_id = seed_data["recurring_rule"].id
    resp = await seeded_client.patch(
        f"/recurring/{rule_id}",
        json={"unit": "week", "interval": 2, "weekdays": "0,2,4", "time_of_day": "07:30"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == rule_id
    assert data["unit"] == "week"
    assert data["interval"] == 2
    assert data["weekdays"] == "0,2,4"
    assert data["time_of_day"] == "07:30"


@pytest.mark.asyncio
async def test_patch_recurring_rule_partial_update(seeded_client, seed_data):
    rule_id = seed_data["recurring_rule"].id
    resp = await seeded_client.patch(
        f"/recurring/{rule_id}",
        json={"active": False},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    # Other fields untouched
    assert resp.json()["unit"] == "day"  # from seed


@pytest.mark.asyncio
async def test_patch_recurring_rule_not_found_returns_404(seeded_client, seed_data):
    resp = await seeded_client.patch(
        "/recurring/does-not-exist",
        json={"active": False},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_recurring_rule(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/recurring/{seed_data['recurring_rule'].id}",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_bob_can_create_task_in_group_project(seeded_client, seed_data):
    # Given bob is a group member
    resp = await seeded_client.post(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}/tasks",
        json={"title": "Bob's task"},
        headers=_headers(seed_data["piet"]),
    )
    assert resp.status_code == 201
