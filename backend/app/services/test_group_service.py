import pytest
from app.exceptions import AccessDeniedError, ConflictError, NotFoundError
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository
from app.services.group_service import GroupService


def _service(db_session) -> GroupService:
    return GroupService(GroupRepository(db_session), UserRepository(db_session))


@pytest.mark.asyncio
async def test_list_groups_returns_only_members_groups(db_session, seed_data):
    # Given alice is in the household group
    svc = _service(db_session)

    # When listing alice's groups
    groups = await svc.list_groups(seed_data["henk"].id)

    # Then the household group is included
    assert any(g.id == seed_data["zooiboel"].id for g in groups)


@pytest.mark.asyncio
async def test_create_group_returns_group_with_owner(db_session, seed_data):
    # Given alice as owner
    svc = _service(db_session)

    # When creating a group
    group = await svc.create_group("New Group", "custom", seed_data["henk"].id)

    # Then the group is returned with alice as owner
    assert group.name == "New Group"
    assert group.owner_id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_get_group_raises_not_found(db_session, seed_data):
    svc = _service(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_group("nonexistent-id")


@pytest.mark.asyncio
async def test_update_group_name_by_admin(db_session, seed_data):
    # Given alice is admin of the household group
    svc = _service(db_session)

    # When alice updates the name
    updated = await svc.update_group(
        seed_data["zooiboel"].id, seed_data["henk"].id, name="Home", type=None
    )

    # Then the name changes
    assert updated.name == "Home"


@pytest.mark.asyncio
async def test_update_group_raises_for_non_admin(db_session, seed_data):
    # Given bob is a member (not admin) of the household group
    svc = _service(db_session)

    # When bob tries to update the group
    # Then AccessDeniedError is raised
    with pytest.raises(AccessDeniedError):
        await svc.update_group(
            seed_data["zooiboel"].id, seed_data["piet"].id, name="Bob's Home", type=None
        )


@pytest.mark.asyncio
async def test_delete_group_by_owner(db_session, seed_data):
    # Given a group owned by alice
    svc = _service(db_session)
    group = await svc.create_group("Temp", "custom", seed_data["henk"].id)

    # When alice deletes it
    await svc.delete_group(group.id, seed_data["henk"].id)

    # Then it no longer exists
    with pytest.raises(NotFoundError):
        await svc.get_group(group.id)


@pytest.mark.asyncio
async def test_delete_group_raises_for_non_owner(db_session, seed_data):
    # Given bob is not the owner
    svc = _service(db_session)

    with pytest.raises(AccessDeniedError):
        await svc.delete_group(seed_data["zooiboel"].id, seed_data["piet"].id)


@pytest.mark.asyncio
async def test_invite_member_adds_new_member(db_session, seed_data):
    # Given a new group owned by alice and bob is not in it
    svc = _service(db_session)
    group = await svc.create_group("Fresh", "custom", seed_data["henk"].id)

    # When alice invites bob
    await svc.invite_member(group.id, seed_data["henk"].id, "piet@example.com", "member")

    # Then bob is a member
    repo = GroupRepository(db_session)
    membership = await repo.get_membership(group.id, seed_data["piet"].id)
    assert membership is not None


@pytest.mark.asyncio
async def test_invite_member_raises_conflict_if_already_member(db_session, seed_data):
    # Given bob is already in the household group
    svc = _service(db_session)

    with pytest.raises(ConflictError):
        await svc.invite_member(
            seed_data["zooiboel"].id, seed_data["henk"].id, "piet@example.com", "member"
        )


@pytest.mark.asyncio
async def test_invite_member_raises_not_found_for_unknown_email(db_session, seed_data):
    svc = _service(db_session)

    with pytest.raises(NotFoundError):
        await svc.invite_member(
            seed_data["zooiboel"].id, seed_data["henk"].id, "nobody@example.com", "member"
        )


@pytest.mark.asyncio
async def test_remove_member(db_session, seed_data):
    # Given bob is in the household group
    svc = _service(db_session)

    # When alice removes bob
    await svc.remove_member(seed_data["zooiboel"].id, seed_data["henk"].id, seed_data["piet"].id)

    # Then bob's membership is gone
    repo = GroupRepository(db_session)
    assert await repo.get_membership(seed_data["zooiboel"].id, seed_data["piet"].id) is None
