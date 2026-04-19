import pytest

from app.repositories.user_repo import UserRepository


@pytest.mark.asyncio
async def test_create_user_persists(db_session):
    # Given a fresh repository
    repo = UserRepository(db_session)

    # When a user is created
    user = await repo.create(email="new@example.com", name="New User")
    await repo.commit()

    # Then it is retrievable by id and email
    by_id = await repo.get_by_id(user.id)
    by_email = await repo.get_by_email("new@example.com")
    assert by_id is not None
    assert by_email is not None
    assert by_id.id == by_email.id


@pytest.mark.asyncio
async def test_get_by_id_returns_none_for_missing(db_session):
    repo = UserRepository(db_session)
    result = await repo.get_by_id("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_get_by_email_returns_none_for_missing(db_session):
    repo = UserRepository(db_session)
    result = await repo.get_by_email("nobody@example.com")
    assert result is None


@pytest.mark.asyncio
async def test_create_credential_links_to_user(db_session, seed_data):
    # Given alice already exists in the seed data
    repo = UserRepository(db_session)

    # Then her credential is retrievable
    cred = await repo.get_credential(seed_data["henk"].id)
    assert cred is not None
    assert cred.user_id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_get_credential_returns_none_for_no_credential(db_session):
    # Given a user with no credential
    repo = UserRepository(db_session)
    user = await repo.create(email="nocred@example.com", name="No Cred")
    await repo.commit()

    # Then get_credential returns None
    cred = await repo.get_credential(user.id)
    assert cred is None


@pytest.mark.asyncio
async def test_seed_data_users_exist(db_session, seed_data):
    # Given the shared seed data
    repo = UserRepository(db_session)

    # Then alice and bob are retrievable
    alice = await repo.get_by_email("henk@example.com")
    bob = await repo.get_by_email("piet@example.com")
    assert alice is not None
    assert bob is not None
    assert alice.id == seed_data["henk"].id
    assert bob.id == seed_data["piet"].id
