import pytest
from app.services.auth import create_access_token


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_create_group_returns_201(seeded_client, seed_data):
    # Given alice is authenticated
    # When creating a group
    resp = await seeded_client.post(
        "/groups",
        json={"name": "Work", "type": "custom"},
        headers=_headers(seed_data["henk"]),
    )

    # Then 201 with group data
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Work"
    assert data["owner_id"] == seed_data["henk"].id


@pytest.mark.asyncio
async def test_list_groups_returns_members_groups(seeded_client, seed_data):
    # Given alice is in the household group
    resp = await seeded_client.get("/groups", headers=_headers(seed_data["henk"]))

    assert resp.status_code == 200
    group_ids = [g["id"] for g in resp.json()]
    assert seed_data["zooiboel"].id in group_ids


@pytest.mark.asyncio
async def test_update_group_name(seeded_client, seed_data):
    # Given alice (admin) updates the household group
    resp = await seeded_client.put(
        f"/groups/{seed_data['zooiboel'].id}",
        json={"name": "Our Home"},
        headers=_headers(seed_data["henk"]),
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "Our Home"


@pytest.mark.asyncio
async def test_update_group_by_non_admin_returns_403(seeded_client, seed_data):
    # Given bob is a member (not admin)
    resp = await seeded_client.put(
        f"/groups/{seed_data['zooiboel'].id}",
        json={"name": "Bob's Home"},
        headers=_headers(seed_data["piet"]),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_group_by_owner(seeded_client, seed_data):
    # Given alice creates a group
    create = await seeded_client.post(
        "/groups", json={"name": "ToDelete"}, headers=_headers(seed_data["henk"])
    )
    gid = create.json()["id"]

    # When alice deletes it
    resp = await seeded_client.delete(f"/groups/{gid}", headers=_headers(seed_data["henk"]))

    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_group_by_non_owner_returns_403(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/groups/{seed_data['zooiboel'].id}", headers=_headers(seed_data["piet"])
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_invite_member_returns_201(seeded_client, seed_data):
    # Given alice creates a new group (without bob)
    create = await seeded_client.post(
        "/groups", json={"name": "Fresh"}, headers=_headers(seed_data["henk"])
    )
    gid = create.json()["id"]

    # When alice invites bob
    resp = await seeded_client.post(
        f"/groups/{gid}/members",
        json={"email": "piet@example.com", "role": "member"},
        headers=_headers(seed_data["henk"]),
    )

    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_invite_already_member_returns_409(seeded_client, seed_data):
    # Given bob is already in the household group
    resp = await seeded_client.post(
        f"/groups/{seed_data['zooiboel'].id}/members",
        json={"email": "piet@example.com", "role": "member"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_remove_member(seeded_client, seed_data):
    resp = await seeded_client.delete(
        f"/groups/{seed_data['zooiboel'].id}/members/{seed_data['piet'].id}",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 204
