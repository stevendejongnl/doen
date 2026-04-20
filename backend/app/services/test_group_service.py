import pytest

from app.exceptions import AccessDeniedError, ConflictError, NotFoundError
from app.repositories.group_invitation_repo import GroupInvitationRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository
from app.services.group_service import GroupService


def _service(db_session, spy_mail) -> GroupService:
    return GroupService(
        GroupRepository(db_session),
        UserRepository(db_session),
        GroupInvitationRepository(db_session),
        spy_mail,
    )


@pytest.mark.asyncio
async def test_list_groups_returns_only_members_groups(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    groups = await svc.list_groups(seed_data["henk"].id)
    assert any(g.id == seed_data["zooiboel"].id for g in groups)


@pytest.mark.asyncio
async def test_create_group_returns_group_with_owner(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    group = await svc.create_group("New Group", "custom", seed_data["henk"].id)
    assert group.name == "New Group"
    assert group.owner_id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_get_group_raises_not_found(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    with pytest.raises(NotFoundError):
        await svc.get_group("nonexistent-id")


@pytest.mark.asyncio
async def test_update_group_name_by_admin(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    updated = await svc.update_group(
        seed_data["zooiboel"].id, seed_data["henk"].id, name="Home", type=None
    )
    assert updated.name == "Home"


@pytest.mark.asyncio
async def test_update_group_raises_for_non_admin(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    with pytest.raises(AccessDeniedError):
        await svc.update_group(
            seed_data["zooiboel"].id, seed_data["piet"].id, name="Bob's Home", type=None
        )


@pytest.mark.asyncio
async def test_delete_group_by_owner(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    group = await svc.create_group("Temp", "custom", seed_data["henk"].id)
    await svc.delete_group(group.id, seed_data["henk"].id)
    with pytest.raises(NotFoundError):
        await svc.get_group(group.id)


@pytest.mark.asyncio
async def test_delete_group_raises_for_non_owner(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    with pytest.raises(AccessDeniedError):
        await svc.delete_group(seed_data["zooiboel"].id, seed_data["piet"].id)


@pytest.mark.asyncio
async def test_invite_member_adds_existing_user_and_mails(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    group = await svc.create_group("Fresh", "custom", seed_data["henk"].id)

    result = await svc.invite_member(
        group.id, seed_data["henk"].id, "piet@example.com", "member"
    )

    assert result.status == "added"
    assert result.user_id == seed_data["piet"].id
    repo = GroupRepository(db_session)
    assert await repo.get_membership(group.id, seed_data["piet"].id) is not None
    assert len(spy_mail.sent) == 1
    assert spy_mail.sent[0]["to"] == "piet@example.com"
    assert spy_mail.sent[0]["context"]["existing_user"] is True


@pytest.mark.asyncio
async def test_invite_member_raises_conflict_if_already_member(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    with pytest.raises(ConflictError):
        await svc.invite_member(
            seed_data["zooiboel"].id, seed_data["henk"].id, "piet@example.com", "member"
        )


@pytest.mark.asyncio
async def test_invite_member_creates_invitation_for_unknown_email(
    db_session, seed_data, spy_mail
):
    svc = _service(db_session, spy_mail)

    result = await svc.invite_member(
        seed_data["zooiboel"].id, seed_data["henk"].id, "nobody@example.com", "member"
    )

    assert result.status == "invited"
    assert result.user_id is None
    invitation_repo = GroupInvitationRepository(db_session)
    pending = await invitation_repo.get_pending_by_email_and_group(
        "nobody@example.com", seed_data["zooiboel"].id
    )
    assert pending is not None
    assert pending.accepted_at is None
    assert len(spy_mail.sent) == 1
    assert spy_mail.sent[0]["to"] == "nobody@example.com"
    assert spy_mail.sent[0]["context"]["existing_user"] is False
    assert f"/invite/{pending.token}" in spy_mail.sent[0]["context"]["accept_url"]


@pytest.mark.asyncio
async def test_reinviting_unknown_email_reuses_pending_invite(
    db_session, seed_data, spy_mail
):
    svc = _service(db_session, spy_mail)

    first = await svc.invite_member(
        seed_data["zooiboel"].id, seed_data["henk"].id, "nobody@example.com", "member"
    )
    second = await svc.invite_member(
        seed_data["zooiboel"].id, seed_data["henk"].id, "nobody@example.com", "member"
    )

    assert first.status == "invited"
    assert second.status == "invited"
    invitation_repo = GroupInvitationRepository(db_session)
    pending = await invitation_repo.get_pending_by_email_and_group(
        "nobody@example.com", seed_data["zooiboel"].id
    )
    assert pending is not None
    assert len(spy_mail.sent) == 2


@pytest.mark.asyncio
async def test_remove_member(db_session, seed_data, spy_mail):
    svc = _service(db_session, spy_mail)
    await svc.remove_member(
        seed_data["zooiboel"].id, seed_data["henk"].id, seed_data["piet"].id
    )
    repo = GroupRepository(db_session)
    assert await repo.get_membership(seed_data["zooiboel"].id, seed_data["piet"].id) is None
