from datetime import timedelta

import pytest

from app.exceptions import AccessDeniedError, InvalidTokenError, NotFoundError
from app.models.base import utcnow
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.user_repo import UserRepository
from app.services.api_key_service import TOKEN_PREFIX, ApiKeyService


def _svc(db_session) -> ApiKeyService:
    return ApiKeyService(ApiKeyRepository(db_session), UserRepository(db_session))


@pytest.mark.asyncio
async def test_create_returns_plaintext_and_stores_hash(db_session, seed_data):
    svc = _svc(db_session)
    result = await svc.create(seed_data["henk"].id, name="ha-integration")

    assert result.plaintext_token.startswith(TOKEN_PREFIX)
    assert result.key.name == "ha-integration"
    assert result.key.token_prefix == result.plaintext_token[len(TOKEN_PREFIX):][:8]
    # The stored hash is not the plaintext.
    assert result.key.token_hash != result.plaintext_token


@pytest.mark.asyncio
async def test_authenticate_valid_token_returns_user_and_updates_last_used(
    db_session, seed_data
):
    svc = _svc(db_session)
    created = await svc.create(seed_data["henk"].id, name="k1")
    assert created.key.last_used_at is None

    user = await svc.authenticate(created.plaintext_token)

    assert user.id == seed_data["henk"].id
    refreshed = await ApiKeyRepository(db_session).get_by_id(created.key.id)
    assert refreshed.last_used_at is not None


@pytest.mark.asyncio
async def test_authenticate_rejects_unknown_token(db_session, seed_data):
    svc = _svc(db_session)
    with pytest.raises(InvalidTokenError):
        await svc.authenticate(f"{TOKEN_PREFIX}does_not_exist")


@pytest.mark.asyncio
async def test_authenticate_rejects_non_doen_token(db_session, seed_data):
    svc = _svc(db_session)
    with pytest.raises(InvalidTokenError):
        await svc.authenticate("eyJmalformed.jwt.token")


@pytest.mark.asyncio
async def test_authenticate_rejects_revoked_token(db_session, seed_data):
    svc = _svc(db_session)
    created = await svc.create(seed_data["henk"].id, name="k1")
    await svc.revoke(created.key.id, seed_data["henk"].id)

    with pytest.raises(InvalidTokenError):
        await svc.authenticate(created.plaintext_token)


@pytest.mark.asyncio
async def test_authenticate_rejects_expired_token(db_session, seed_data):
    svc = _svc(db_session)
    created = await svc.create(
        seed_data["henk"].id, name="k1", expires_at=utcnow() - timedelta(hours=1)
    )
    with pytest.raises(InvalidTokenError):
        await svc.authenticate(created.plaintext_token)


@pytest.mark.asyncio
async def test_list_only_returns_unrevoked(db_session, seed_data):
    svc = _svc(db_session)
    active = await svc.create(seed_data["henk"].id, name="active")
    revoked = await svc.create(seed_data["henk"].id, name="to-revoke")
    await svc.revoke(revoked.key.id, seed_data["henk"].id)

    keys = await svc.list_for_user(seed_data["henk"].id)
    assert [k.id for k in keys] == [active.key.id]


@pytest.mark.asyncio
async def test_revoke_other_users_key_is_rejected(db_session, seed_data):
    svc = _svc(db_session)
    created = await svc.create(seed_data["henk"].id, name="k1")

    with pytest.raises(AccessDeniedError):
        await svc.revoke(created.key.id, seed_data["piet"].id)


@pytest.mark.asyncio
async def test_revoke_already_revoked_raises_not_found(db_session, seed_data):
    svc = _svc(db_session)
    created = await svc.create(seed_data["henk"].id, name="k1")
    await svc.revoke(created.key.id, seed_data["henk"].id)

    with pytest.raises(NotFoundError):
        await svc.revoke(created.key.id, seed_data["henk"].id)
