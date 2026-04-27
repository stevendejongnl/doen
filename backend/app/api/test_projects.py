import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household_points import PointTransaction, TaskOffer
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


@pytest.mark.asyncio
async def test_create_project_defaults_offers_enabled_true(seeded_client, seed_data):
    resp = await seeded_client.post(
        "/projects",
        json={"name": "Test", "color": "#ff0000"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 201
    assert resp.json()["offers_enabled"] is True


@pytest.mark.asyncio
async def test_update_project_disables_offers(seeded_client, seed_data):
    resp = await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": False},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["offers_enabled"] is False


@pytest.mark.asyncio
async def test_update_project_reenables_offers(seeded_client, seed_data):
    # disable first
    await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": False},
        headers=_headers(seed_data["henk"]),
    )
    # re-enable
    resp = await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": True},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["offers_enabled"] is True


@pytest.mark.asyncio
async def test_disabling_offers_deletes_point_transactions_and_offers(
    seeded_client, seed_data, db_session: AsyncSession
):
    """When offers_enabled is set to False, all PointTransaction rows and
    TaskOffer rows linked to tasks in that project must be removed."""
    group_task_id = seed_data["group_task"].id
    project_id = seed_data["gezamenlijke_ellende"].id

    # 1. Create an offer for the group task
    created = await seeded_client.post(
        f"/tasks/{group_task_id}/offer",
        json={"reward_note": "test reward"},
        headers=_headers(seed_data["henk"]),
    )
    assert created.status_code == 201
    offer_id = created.json()["id"]

    # 2. Accept and approve the offer so PointTransaction rows are written
    await seeded_client.post(
        f"/offers/{offer_id}/accept",
        headers=_headers(seed_data["piet"]),
    )
    decided = await seeded_client.post(
        f"/offers/{offer_id}/decision",
        json={"approved": True, "reopen": False},
        headers=_headers(seed_data["henk"]),
    )
    assert decided.status_code == 200

    # Confirm transactions exist before disabling
    tx_before = (
        await db_session.execute(
            select(PointTransaction).where(PointTransaction.task_id == group_task_id)
        )
    ).scalars().all()
    assert len(tx_before) >= 2, "Expected at least two offer transactions"

    offer_before = (
        await db_session.execute(
            select(TaskOffer).where(TaskOffer.id == offer_id)
        )
    ).scalar_one_or_none()
    assert offer_before is not None, "Offer should exist before disable"

    # 3. Disable offers on the project
    resp = await seeded_client.put(
        f"/projects/{project_id}",
        json={"offers_enabled": False},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert resp.json()["offers_enabled"] is False

    # 4. Verify all point transactions for the project's tasks are gone
    tx_after = (
        await db_session.execute(
            select(PointTransaction).where(PointTransaction.task_id == group_task_id)
        )
    ).scalars().all()
    assert tx_after == [], "PointTransaction rows should have been deleted"

    # 5. Verify the offer is gone too
    offer_after = (
        await db_session.execute(
            select(TaskOffer).where(TaskOffer.id == offer_id)
        )
    ).scalar_one_or_none()
    assert offer_after is None, "TaskOffer should have been deleted"
