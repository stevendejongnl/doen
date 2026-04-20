import pytest


@pytest.mark.asyncio
async def test_create_list_and_use_api_key_against_me(seeded_client, seed_data):
    # Log in as henk to get a JWT we can use to create an API key
    tokens = (await seeded_client.post(
        "/auth/login", json={"email": "henk@example.com", "password": "henk123"}
    )).json()
    jwt_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Create an API key
    resp = await seeded_client.post(
        "/auth/api-keys", json={"name": "ha-integration"}, headers=jwt_headers
    )
    assert resp.status_code == 201
    body = resp.json()
    token = body["token"]
    assert token.startswith("doen_")
    key_id = body["key"]["id"]

    # The same /auth/me endpoint works with the new API key
    me = await seeded_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "henk@example.com"

    # List keys (using the key itself as auth)
    listed = await seeded_client.get(
        "/auth/api-keys", headers={"Authorization": f"Bearer {token}"}
    )
    assert listed.status_code == 200
    assert [k["id"] for k in listed.json()] == [key_id]

    # Revoke; subsequent auth attempts fail
    revoked = await seeded_client.delete(
        f"/auth/api-keys/{key_id}", headers=jwt_headers
    )
    assert revoked.status_code == 204
    after = await seeded_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_change_password_via_http(seeded_client, seed_data):
    tokens = (await seeded_client.post(
        "/auth/login", json={"email": "henk@example.com", "password": "henk123"}
    )).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Wrong current password → 401
    r = await seeded_client.post(
        "/auth/change-password",
        json={"current_password": "WRONG", "new_password": "new-password-1"},
        headers=headers,
    )
    assert r.status_code == 401

    # Correct current → 204; new password now works for login
    r = await seeded_client.post(
        "/auth/change-password",
        json={"current_password": "henk123", "new_password": "new-password-1"},
        headers=headers,
    )
    assert r.status_code == 204
    relogin = await seeded_client.post(
        "/auth/login", json={"email": "henk@example.com", "password": "new-password-1"}
    )
    assert relogin.status_code == 200


@pytest.mark.asyncio
async def test_change_password_min_length_enforced(seeded_client, seed_data):
    tokens = (await seeded_client.post(
        "/auth/login", json={"email": "henk@example.com", "password": "henk123"}
    )).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await seeded_client.post(
        "/auth/change-password",
        json={"current_password": "henk123", "new_password": "x"},
        headers=headers,
    )
    assert r.status_code == 401
