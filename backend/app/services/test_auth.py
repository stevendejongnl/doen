import pytest

from app.exceptions import (
    AlreadyExistsError,
    InvalidCredentialsError,
    InvalidTokenError,
)
from app.repositories.user_repo import UserRepository
from app.services.auth import (
    AuthService,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

# ── Pure crypto helpers ───────────────────────────────────────────────────────

def test_hash_password_produces_non_plaintext():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    assert len(hashed) > 20


def test_verify_password_correct():
    hashed = hash_password("correct")
    assert verify_password("correct", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_create_and_decode_access_token():
    token = create_access_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    token = create_refresh_token("user-456")
    payload = decode_token(token)
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_token_raises_on_garbage():
    from app.exceptions import InvalidTokenError
    with pytest.raises(InvalidTokenError):
        decode_token("not.a.token")


# ── AuthService ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_creates_user_and_returns_tokens(db_session):
    # Given an empty DB
    service = AuthService(UserRepository(db_session))

    # When registering a new user
    access, refresh = await service.register("new@example.com", "New User", "pass123")

    # Then tokens are valid and reference the correct user
    access_payload = decode_token(access)
    refresh_payload = decode_token(refresh)
    assert access_payload["type"] == "access"
    assert refresh_payload["type"] == "refresh"
    assert access_payload["sub"] == refresh_payload["sub"]


@pytest.mark.asyncio
async def test_register_raises_on_duplicate_email(db_session, seed_data):
    # Given alice already exists
    service = AuthService(UserRepository(db_session))

    # When registering with alice's email
    # Then AlreadyExistsError is raised
    with pytest.raises(AlreadyExistsError):
        await service.register("henk@example.com", "Alice Clone", "pass123")


@pytest.mark.asyncio
async def test_login_returns_tokens_for_correct_credentials(db_session, seed_data):
    # Given alice exists with password 'alice123'
    service = AuthService(UserRepository(db_session))

    # When logging in
    access, refresh = await service.login("henk@example.com", "henk123")

    # Then tokens reference alice
    payload = decode_token(access)
    assert payload["sub"] == seed_data["henk"].id


@pytest.mark.asyncio
async def test_login_raises_for_wrong_password(db_session, seed_data):
    service = AuthService(UserRepository(db_session))
    with pytest.raises(InvalidCredentialsError):
        await service.login("henk@example.com", "wrongpass")


@pytest.mark.asyncio
async def test_login_raises_for_unknown_email(db_session):
    service = AuthService(UserRepository(db_session))
    with pytest.raises(InvalidCredentialsError):
        await service.login("ghost@example.com", "pass")


@pytest.mark.asyncio
async def test_refresh_rotates_tokens(db_session, seed_data):
    service = AuthService(UserRepository(db_session))
    _, refresh = await service.login("henk@example.com", "henk123")

    new_access, new_refresh = await service.refresh(refresh)

    payload = decode_token(new_access)
    assert payload["sub"] == seed_data["henk"].id


@pytest.mark.asyncio
async def test_refresh_raises_on_access_token(db_session, seed_data):
    service = AuthService(UserRepository(db_session))
    access, _ = await service.login("henk@example.com", "henk123")

    with pytest.raises(InvalidTokenError):
        await service.refresh(access)


@pytest.mark.asyncio
async def test_get_user_by_token_returns_user(db_session, seed_data):
    service = AuthService(UserRepository(db_session))
    token = create_access_token(seed_data["henk"].id)
    user = await service.get_user_by_token(token)
    assert user.id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_get_user_by_token_raises_on_refresh_token(db_session, seed_data):
    service = AuthService(UserRepository(db_session))
    token = create_refresh_token(seed_data["henk"].id)
    with pytest.raises(InvalidTokenError):
        await service.get_user_by_token(token)
