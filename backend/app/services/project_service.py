from app.exceptions import AccessDeniedError, NotFoundError
from app.models.project import Project
from app.repositories.group_repo import GroupRepository
from app.repositories.household_points_repo import HouseholdPointsRepository
from app.repositories.project_repo import ProjectRepository


class ProjectService:
    def __init__(
        self,
        project_repo: ProjectRepository,
        group_repo: GroupRepository,
        points_repo: HouseholdPointsRepository | None = None,
    ) -> None:
        self._projects = project_repo
        self._groups = group_repo
        self._points = points_repo

    async def list_projects(self, user_id: str) -> list[Project]:
        group_ids = await self._groups.list_group_ids_for_user(user_id)
        return await self._projects.list_for_user(user_id, group_ids)

    async def create_project(
        self,
        name: str,
        description: str | None,
        color: str,
        group_id: str | None,
        owner_id: str,
        offers_enabled: bool = True,
    ) -> Project:
        return await self._projects.create(
            name=name,
            description=description,
            color=color,
            group_id=group_id,
            owner_id=owner_id,
            offers_enabled=offers_enabled,
        )

    async def get_project(self, project_id: str, requesting_user_id: str) -> Project:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError("Project", project_id)
        await self.assert_access(project, requesting_user_id)
        return project

    async def get_project_raw(self, project_id: str) -> Project:
        """Fetch without access check — used internally by TaskService."""
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError("Project", project_id)
        return project

    async def assert_access(self, project: Project, user_id: str) -> None:
        """Raises AccessDeniedError if user has no access to this project."""
        if project.owner_id == user_id:
            return
        if project.group_id:
            membership = await self._groups.get_membership(project.group_id, user_id)
            if membership:
                return
        raise AccessDeniedError()

    async def update_project(
        self,
        project_id: str,
        requesting_user_id: str,
        name: str | None,
        description: str | None,
        color: str | None,
        offers_enabled: bool | None = None,
    ) -> Project:
        project = await self.get_project(project_id, requesting_user_id)
        disabling_offers = (
            offers_enabled is False and project.offers_enabled is True
        )
        updated = await self._projects.update(
            project, name=name, description=description, color=color, offers_enabled=offers_enabled
        )
        if disabling_offers and self._points is not None:
            await self._points.delete_offers_for_project(project_id)
            await self._points.delete_transactions_for_project(project_id)
        return updated

    async def archive_project(self, project_id: str, requesting_user_id: str) -> Project:
        project = await self.get_project(project_id, requesting_user_id)
        return await self._projects.archive(project)

    async def member_ids_for_project(self, project: Project) -> list[str]:
        if project.group_id:
            return await self._groups.list_member_ids(project.group_id)
        return [project.owner_id]

    async def delete_project(self, project_id: str, requesting_user_id: str) -> None:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError("Project", project_id)
        if project.owner_id != requesting_user_id:
            raise AccessDeniedError("Only the owner can delete a project")
        await self._projects.delete(project)
