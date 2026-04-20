import secrets
from datetime import timedelta

import pytest

from app.exceptions import (
    ConflictError,
    InvitationAlreadyAcceptedError,
    InvitationEmailMismatchError,
    InvitationExpiredError,
    NotFoundError,
)
from app.models.base import utcnow
from app.repositories.group_invitation_repo import GroupInvitationRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository
from app.services.auth import AuthService
from app.services.group_invitation_service import GroupInvitationService


def _invite_service(db_session) -> GroupInvitationService:
    users = UserRepository(db_session)
    return GroupInvitationService(
        GroupInvitationRepository(db_session),
        GroupRepository(db_session),
        users,
        AuthService(users),
    )


async def _create_pending(db_session, seed_data, email: str = "nobody@example.com"):
    """Directly insert a pending invite, bypassing the group service's add-existing-user branch."""
    return await GroupInvitationRepository(db_session).create(
        group_id=seed_data["zooiboel"].id,
        email=email,
        role="member",
        token=secrets.token_urlsafe(24),
        invited_by_user_id=seed_data["henk"].id,
        expires_at=utcnow() + timedelta(days=7),
    )


@pytest.mark.asyncio
async def test_describe_returns_group_and_inviter(db_session, seed_data):
    invite = await _create_pending(db_session, seed_data)
    svc = _invite_service(db_session)

    details = await svc.describe(invite.token)

    assert details.group_id == seed_data["zooiboel"].id
    assert details.group_name == seed_data["zooiboel"].name
    assert details.inviter_name == seed_data["henk"].name
    assert details.existing_user is False


@pytest.mark.asyncio
async def test_describe_raises_for_unknown_token(db_session, seed_data):
    svc = _invite_service(db_session)
    with pytest.raises(NotFoundError):
        await svc.describe("no-such-token")


@pytest.mark.asyncio
async def test_describe_raises_for_expired_invite(db_session, seed_data):
    invite = await _create_pending(db_session, seed_data)
    invite.expires_at = utcnow() - timedelta(hours=1)
    await db_session.commit()

    svc = _invite_service(db_session)
    with pytest.raises(InvitationExpiredError):
        await svc.describe(invite.token)


@pytest.mark.asyncio
async def test_accept_with_signup_creates_user_and_adds_member(
    db_session, seed_data
):
    invite = await _create_pending(db_session, seed_data,"new@example.com")
    svc = _invite_service(db_session)

    result = await svc.accept_with_signup(invite.token, name="New User", password="pw123456")

    assert result.group_id == seed_data["zooiboel"].id
    assert result.tokens is not None
    access, refresh = result.tokens
    assert access and refresh
    new_user = await UserRepository(db_session).get_by_email("new@example.com")
    assert new_user is not None
    assert (
        await GroupRepository(db_session).get_membership(result.group_id, new_user.id)
        is not None
    )
    fresh = await GroupInvitationRepository(db_session).get_by_token(invite.token)
    assert fresh.accepted_at is not None


@pytest.mark.asyncio
async def test_accept_with_signup_raises_if_user_already_exists(
    db_session, seed_data
):
    # Simulate race: invite created for a not-yet-user email, user then self-registers
    # through /auth/register before clicking the invite link.
    invite = await _create_pending(db_session, seed_data,"new@example.com")
    users = UserRepository(db_session)
    await users.create(email="new@example.com", name="Self Signup")
    await users.commit()

    svc = _invite_service(db_session)
    with pytest.raises(ConflictError):
        await svc.accept_with_signup(invite.token, name="Another", password="pw123456")


@pytest.mark.asyncio
async def test_accept_as_user_matches_email(db_session, seed_data):
    invite = await _create_pending(db_session, seed_data,"piet@example.com")
    svc = _invite_service(db_session)

    result = await svc.accept_as_user(invite.token, seed_data["piet"].id)

    assert result.user_id == seed_data["piet"].id
    assert result.tokens is None


@pytest.mark.asyncio
async def test_accept_as_user_rejects_mismatched_email(db_session, seed_data):
    invite = await _create_pending(db_session, seed_data,"nobody@example.com")
    svc = _invite_service(db_session)
    with pytest.raises(InvitationEmailMismatchError):
        await svc.accept_as_user(invite.token, seed_data["piet"].id)


@pytest.mark.asyncio
async def test_cannot_accept_already_accepted_invite(db_session, seed_data):
    invite = await _create_pending(db_session, seed_data,"new@example.com")
    svc = _invite_service(db_session)
    await svc.accept_with_signup(invite.token, name="New User", password="pw123456")

    with pytest.raises(InvitationAlreadyAcceptedError):
        await svc.accept_with_signup(invite.token, name="Again", password="pw123456")
