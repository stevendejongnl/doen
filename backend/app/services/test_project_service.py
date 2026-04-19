import pytest
from app.exceptions import AccessDeniedError, NotFoundError
from app.repositories.group_repo import GroupRepository
from app.repositories.project_repo import ProjectRepository
from app.services.project_service import ProjectService


def _service(db_session) -> ProjectService:
    return ProjectService(ProjectRepository(db_session), GroupRepository(db_session))


@pytest.mark.asyncio
async def test_list_projects_includes_personal_and_group_projects(db_session, seed_data):
    # Given alice has a personal project and is in the household group with a group project
    svc = _service(db_session)

    # When listing projects for alice
    projects = await svc.list_projects(seed_data["henk"].id)
    ids = {p.id for p in projects}

    # Then both are included
    assert seed_data["henk_personal"].id in ids
    assert seed_data["gezamenlijke_ellende"].id in ids


@pytest.mark.asyncio
async def test_list_projects_excludes_other_personal_projects(db_session, seed_data):
    # Given bob has his own personal project
    svc = _service(db_session)

    # When alice lists her projects
    projects = await svc.list_projects(seed_data["henk"].id)
    ids = {p.id for p in projects}

    # Then bob's personal project is NOT included
    assert seed_data["piet_personal"].id not in ids


@pytest.mark.asyncio
async def test_create_personal_project(db_session, seed_data):
    # Given alice as owner with no group
    svc = _service(db_session)

    # When creating a project
    project = await svc.create_project(
        name="New Project", description=None, color="#abc123",
        group_id=None, owner_id=seed_data["henk"].id,
    )

    # Then the project is created with correct fields
    assert project.name == "New Project"
    assert project.group_id is None
    assert project.owner_id == seed_data["henk"].id


@pytest.mark.asyncio
async def test_get_project_raises_not_found(db_session, seed_data):
    svc = _service(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_project("nonexistent", seed_data["henk"].id)


@pytest.mark.asyncio
async def test_get_project_raises_access_denied_for_wrong_user(db_session, seed_data):
    # Given bob tries to access alice's personal project
    svc = _service(db_session)
    with pytest.raises(AccessDeniedError):
        await svc.get_project(seed_data["henk_personal"].id, seed_data["piet"].id)


@pytest.mark.asyncio
async def test_get_project_allows_group_member(db_session, seed_data):
    # Given bob is a member of the household group
    svc = _service(db_session)

    # When bob accesses the group project
    project = await svc.get_project(seed_data["gezamenlijke_ellende"].id, seed_data["piet"].id)

    # Then it is returned
    assert project.id == seed_data["gezamenlijke_ellende"].id


@pytest.mark.asyncio
async def test_update_project(db_session, seed_data):
    svc = _service(db_session)
    updated = await svc.update_project(
        seed_data["henk_personal"].id,
        seed_data["henk"].id,
        name="Renamed",
        description=None,
        color=None,
    )
    assert updated.name == "Renamed"


@pytest.mark.asyncio
async def test_archive_project(db_session, seed_data):
    svc = _service(db_session)
    archived = await svc.archive_project(seed_data["henk_personal"].id, seed_data["henk"].id)
    assert archived.archived_at is not None


@pytest.mark.asyncio
async def test_delete_project_by_owner(db_session, seed_data):
    svc = _service(db_session)
    await svc.delete_project(seed_data["henk_personal"].id, seed_data["henk"].id)

    with pytest.raises(NotFoundError):
        await svc.get_project(seed_data["henk_personal"].id, seed_data["henk"].id)


@pytest.mark.asyncio
async def test_delete_project_raises_for_non_owner(db_session, seed_data):
    # Given bob is a member (not owner) of the group project
    svc = _service(db_session)
    with pytest.raises(AccessDeniedError):
        await svc.delete_project(seed_data["gezamenlijke_ellende"].id, seed_data["piet"].id)
