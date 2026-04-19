import pytest

from app.repositories.group_repo import GroupRepository
from app.repositories.project_repo import ProjectRepository


@pytest.mark.asyncio
async def test_create_personal_project(db_session, seed_data):
    # Given alice (no group)
    repo = ProjectRepository(db_session)

    # When a personal project is created
    project = await repo.create(
        name="My Doen App",
        description="Building the app",
        color="#6366f1",
        group_id=None,
        owner_id=seed_data["henk"].id,
    )

    # Then it is retrievable with correct fields
    fetched = await repo.get_by_id(project.id)
    assert fetched is not None
    assert fetched.name == "My Doen App"
    assert fetched.group_id is None
    assert fetched.owner_id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_list_for_user_includes_personal_and_group_projects(db_session, seed_data):
    # Given alice has a personal project and a group project in seed data
    repo = ProjectRepository(db_session)
    group_repo = GroupRepository(db_session)
    group_ids = await group_repo.list_group_ids_for_user(seed_data["henk"].id)

    # When listing projects for alice
    projects = await repo.list_for_user(seed_data["henk"].id, group_ids)
    project_ids = {p.id for p in projects}

    # Then both personal and group projects are included
    assert seed_data["henk_personal"].id in project_ids
    assert seed_data["gezamenlijke_ellende"].id in project_ids


@pytest.mark.asyncio
async def test_list_for_user_excludes_other_personal_projects(db_session, seed_data):
    # Given alice and bob each have personal projects
    repo = ProjectRepository(db_session)
    group_repo = GroupRepository(db_session)
    alice_group_ids = await group_repo.list_group_ids_for_user(seed_data["henk"].id)

    # When listing projects for alice
    projects = await repo.list_for_user(seed_data["henk"].id, alice_group_ids)
    project_ids = {p.id for p in projects}

    # Then bob's personal project is NOT in the list
    assert seed_data["piet_personal"].id not in project_ids


@pytest.mark.asyncio
async def test_update_project_name_and_color(db_session, seed_data):
    # Given alice's personal project
    repo = ProjectRepository(db_session)
    project = await repo.get_by_id(seed_data["henk_personal"].id)
    assert project is not None

    # When name and color are updated
    updated = await repo.update(project, name="Renamed Project", description=None, color="#ff0000")

    # Then the changes persist
    assert updated.name == "Renamed Project"
    assert updated.color == "#ff0000"


@pytest.mark.asyncio
async def test_archive_project_sets_archived_at(db_session, seed_data):
    # Given alice's personal project
    repo = ProjectRepository(db_session)
    project = await repo.get_by_id(seed_data["henk_personal"].id)
    assert project is not None
    assert project.archived_at is None

    # When archived
    archived = await repo.archive(project)

    # Then archived_at is set
    assert archived.archived_at is not None


@pytest.mark.asyncio
async def test_delete_project(db_session, seed_data):
    # Given a project
    repo = ProjectRepository(db_session)
    project = await repo.get_by_id(seed_data["henk_personal"].id)
    assert project is not None

    # When deleted
    await repo.delete(project)

    # Then it no longer exists
    assert await repo.get_by_id(seed_data["henk_personal"].id) is None
