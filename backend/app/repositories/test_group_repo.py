import pytest
from app.repositories.group_repo import GroupRepository


@pytest.mark.asyncio
async def test_create_group_adds_owner_as_admin(db_session, seed_data):
    # Given a user (alice)
    repo = GroupRepository(db_session)

    # When a group is created
    group = await repo.create(name="Test Group", type="custom", owner_id=seed_data["henk"].id)

    # Then the group exists and alice is an admin member
    membership = await repo.get_membership(group.id, seed_data["henk"].id)
    assert membership is not None
    assert membership.role == "admin"


@pytest.mark.asyncio
async def test_list_for_user_returns_only_members_groups(db_session, seed_data):
    # Given alice and bob are both in the household group from seed data
    repo = GroupRepository(db_session)

    # When listing groups for alice
    alice_groups = await repo.list_for_user(seed_data["henk"].id)

    # Then the household group is in the list
    group_ids = [g.id for g in alice_groups]
    assert seed_data["zooiboel"].id in group_ids


@pytest.mark.asyncio
async def test_list_group_ids_for_user(db_session, seed_data):
    repo = GroupRepository(db_session)
    ids = await repo.list_group_ids_for_user(seed_data["piet"].id)
    assert seed_data["zooiboel"].id in ids


@pytest.mark.asyncio
async def test_update_group_name(db_session, seed_data):
    # Given the household group
    repo = GroupRepository(db_session)
    group = await repo.get_by_id(seed_data["zooiboel"].id)
    assert group is not None

    # When the name is updated
    updated = await repo.update(group, name="Our Home", type=None)

    # Then the name changes
    assert updated.name == "Our Home"


@pytest.mark.asyncio
async def test_add_and_remove_member(db_session, seed_data):
    # Given a new group owned by alice
    repo = GroupRepository(db_session)
    group = await repo.create(name="Fresh Group", type="custom", owner_id=seed_data["henk"].id)

    # When bob is added as a member
    await repo.add_member(group.id, seed_data["piet"].id, role="member")

    # Then bob's membership exists
    membership = await repo.get_membership(group.id, seed_data["piet"].id)
    assert membership is not None

    # When the membership is removed
    await repo.remove_member(membership)

    # Then it no longer exists
    membership_after = await repo.get_membership(group.id, seed_data["piet"].id)
    assert membership_after is None


@pytest.mark.asyncio
async def test_delete_group_removes_members(db_session, seed_data):
    # Given a group with two members (from seed data)
    repo = GroupRepository(db_session)
    group = await repo.get_by_id(seed_data["zooiboel"].id)
    assert group is not None

    # When the group is deleted
    await repo.delete(group)

    # Then it no longer exists
    assert await repo.get_by_id(seed_data["zooiboel"].id) is None


@pytest.mark.asyncio
async def test_list_member_ids(db_session, seed_data):
    repo = GroupRepository(db_session)
    member_ids = await repo.list_member_ids(seed_data["zooiboel"].id)
    assert seed_data["henk"].id in member_ids
    assert seed_data["piet"].id in member_ids
