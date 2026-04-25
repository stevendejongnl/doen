import pytest

from app.services.auth import create_access_token


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_list_household_balances(seeded_client, seed_data):
    resp = await seeded_client.get(
        f"/households/{seed_data['zooiboel'].id}/balances",
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 200
    assert {row["name"] for row in resp.json()} == {"Henk", "Piet"}


@pytest.mark.asyncio
async def test_offer_flow_via_api(seeded_client, seed_data):
    created = await seeded_client.post(
        f"/tasks/{seed_data['group_task'].id}/offer",
        json={"reward_note": "pizza"},
        headers=_headers(seed_data["henk"]),
    )
    assert created.status_code == 201
    offer = created.json()
    assert offer["status"] == "open"
    assert offer["point_value"] == 2

    accepted = await seeded_client.post(
        f"/offers/{offer['id']}/accept",
        headers=_headers(seed_data["piet"]),
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "requested"

    decided = await seeded_client.post(
        f"/offers/{offer['id']}/decision",
        json={"approved": True, "reopen": True},
        headers=_headers(seed_data["henk"]),
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_transfer_and_list_transactions(seeded_client, seed_data):
    resp = await seeded_client.post(
        f"/households/{seed_data['zooiboel'].id}/transfer",
        json={"to_user_id": seed_data["piet"].id, "amount": 4, "note": "pizza"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 204

    txs = await seeded_client.get(
        f"/households/{seed_data['zooiboel'].id}/transactions",
        headers=_headers(seed_data["henk"]),
    )
    assert txs.status_code == 200
    data = txs.json()
    assert len(data) == 2
    assert {row["amount"] for row in data} == {4, -4}


@pytest.mark.asyncio
async def test_notifications_show_owner_action(seeded_client, seed_data):
    created = await seeded_client.post(
        f"/tasks/{seed_data['group_task'].id}/offer",
        json={"reward_note": "pizza"},
        headers=_headers(seed_data["henk"]),
    )
    offer = created.json()
    await seeded_client.post(
        f"/offers/{offer['id']}/accept",
        headers=_headers(seed_data["piet"]),
    )

    notifications = await seeded_client.get(
        f"/households/{seed_data['zooiboel'].id}/notifications",
        headers=_headers(seed_data["henk"]),
    )
    assert notifications.status_code == 200
    data = notifications.json()
    assert any(item["actionable"] for item in data)


@pytest.mark.asyncio
async def test_create_offer_blocked_when_offers_disabled(seeded_client, seed_data):
    await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": False},
        headers=_headers(seed_data["henk"]),
    )
    resp = await seeded_client.post(
        f"/tasks/{seed_data['group_task'].id}/offer",
        json={"reward_note": "pizza"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_offer_allowed_after_reenabling(seeded_client, seed_data):
    await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": False},
        headers=_headers(seed_data["henk"]),
    )
    await seeded_client.put(
        f"/projects/{seed_data['gezamenlijke_ellende'].id}",
        json={"offers_enabled": True},
        headers=_headers(seed_data["henk"]),
    )
    resp = await seeded_client.post(
        f"/tasks/{seed_data['group_task'].id}/offer",
        json={"reward_note": "pizza"},
        headers=_headers(seed_data["henk"]),
    )
    assert resp.status_code == 201
