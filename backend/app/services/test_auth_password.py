import pytest

from app.exceptions import InvalidCredentialsError, NotFoundError
from app.repositories.user_repo import UserRepository
from app.services.auth import AuthService, verify_password


@pytest.mark.asyncio
async def test_change_password_succeeds_with_correct_current(db_session, seed_data):
    svc = AuthService(UserRepository(db_session))
    await svc.change_password(seed_data["henk"].id, "henk123", "new-password-1")

    cred = await UserRepository(db_session).get_credential(seed_data["henk"].id)
    assert verify_password("new-password-1", cred.password_hash)


@pytest.mark.asyncio
async def test_change_password_rejects_wrong_current(db_session, seed_data):
    svc = AuthService(UserRepository(db_session))
    with pytest.raises(InvalidCredentialsError):
        await svc.change_password(seed_data["henk"].id, "WRONG", "new-password-1")


@pytest.mark.asyncio
async def test_change_password_unknown_user_raises(db_session, seed_data):
    svc = AuthService(UserRepository(db_session))
    with pytest.raises(NotFoundError):
        await svc.change_password("no-such-id", "x", "y")
