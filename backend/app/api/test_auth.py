import pytest

from app.services.auth import create_access_token


@pytest.mark.asyncio
async def test_register_returns_201_with_tokens(client):
    # Given a fresh DB and a new user
    # When registering
    resp = await client.post(
        "/auth/register",
        json={"email": "new@example.com", "name": "New User", "password": "pass1234"},
    )

    # Then 201 is returned with tokens
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_400(client):
    # Given a user already registered
    body = {"email": "dup@example.com", "name": "Dup", "password": "pass1234"}
    await client.post("/auth/register", json=body)

    # When registering again with same email
    resp = await client.post("/auth/register", json=body)

    # Then 400 is returned
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_returns_tokens_for_valid_credentials(client):
    # Given a registered user
    await client.post(
        "/auth/register",
        json={"email": "login@example.com", "name": "Login User", "password": "pass1234"},
    )

    # When logging in
    resp = await client.post(
        "/auth/login", json={"email": "login@example.com", "password": "pass1234"}
    )

    # Then 200 with tokens
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    await client.post(
        "/auth/register",
        json={"email": "x@example.com", "name": "X", "password": "correct"},
    )
    resp = await client.post("/auth/login", json={"email": "x@example.com", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(seeded_client, seed_data):
    # Given alice is authenticated
    headers = {"Authorization": f"Bearer {create_access_token(seed_data['henk'].id)}"}

    # When requesting /auth/me
    resp = await seeded_client.get("/auth/me", headers=headers)

    # Then alice's profile is returned
    assert resp.status_code == 200
    assert resp.json()["email"] == "henk@example.com"


@pytest.mark.asyncio
async def test_me_without_token_returns_4xx(client):
    # HTTPBearer returns 403 when no token provided (before our handler runs)
    resp = await client.get("/auth/me")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_refresh_rotates_tokens(client):
    # Given a registered user with a refresh token
    reg = await client.post(
        "/auth/register",
        json={"email": "r@example.com", "name": "R", "password": "pass"},
    )
    refresh_token = reg.json()["refresh_token"]

    # When refreshing
    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})

    # Then new tokens are returned
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
