import pytest
from app.services.auth import create_access_token


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_create_personal_project_returns_201(seeded_client, seed_data):
    resp = await seeded_client.post(
        "/projects",
        json={"name": "My Project", "color": "#ff6b6b"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["group_id"] is None


@pytest.mark.asyncio
async def test_list_projects_includes_personal_and_group(seeded_client, seed_data):
    resp = await seeded_client.get("/projects", headers=_headers(seed_data["henk"]))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert seed_data["henk_personal"].id in ids
    assert seed_data["gezamenlijke_ellende"].id in ids


@pytest.mark.asyncio
async def test_list_projects_excludes_others_personal(seeded_client, seed_data):
    resp = await seeded_client.get("/projects", headers=_headers(seed_data["henk"]))
    ids = [p["id"] for p in resp.json()]
    assert seed_data["piet_personal"].id not in ids


@pytest.mark.asyncio
async def test_get_project_by_owner(seeded_client, seed_data):
    resp = await seeded_client.get(
        f"/projects/{seed_data['henk_personal'].id}", headers=_headers(seed_data["henk"])
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == seed_data["henk_personal"].id


@pytest.mark.asyncio
async def test_get_project_by_group_member(seeded_client, seed_data):
    # Given bob is a group member
    resp = await seeded_client.get(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}", headers=_headers(seed_data["piet"])
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_project_returns_403_for_unauthorized(seeded_client, seed_data):
    resp = await seeded_client.get(
        f"/projects/{seed_data['henk_personal'].id}", headers=_headers(seed_data["piet"])
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_project(seeded_client, seed_data):
    resp = await seeded_client.put(
        f"/projects/{seed_data['henk_personal'].id}",
        json={"name": "Renamed"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


@pytest.mark.asyncio
async def test_archive_project(seeded_client, seed_data):
    resp = await seeded_client.post(
        f"/projects/{seed_data['henk_personal'].id}/archive",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is not None


@pytest.mark.asyncio
async def test_delete_project_by_owner(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/projects/{seed_data['henk_personal'].id}", headers=_headers(seed_data["henk"])
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_project_by_non_owner_returns_403(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}", headers=_headers(seed_data["piet"])
    )
    assert resp.status_code == 403
