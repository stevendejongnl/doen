from sqlalchemy import update

from app.exceptions import AccessDeniedError, NotFoundError
from app.models.category import Category
from app.models.task import Task
from app.repositories.category_repo import CategoryRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.task_repo import TaskRepository
from app.services.project_service import ProjectService


class CategoryService:
    def __init__(
        self,
        category_repo: CategoryRepository,
        project_service: ProjectService,
        group_repo: GroupRepository,
        task_repo: TaskRepository,
    ) -> None:
        self._categories = category_repo
        self._projects = project_service
        self._groups = group_repo
        self._tasks = task_repo

    # ── Access helpers ────────────────────────────────────────────────────────

    async def _assert_scope_access(
        self,
        user_id: str,
        group_id: str | None,
        project_id: str | None,
    ) -> None:
        """User must have access to each non-null scope specified."""
        if group_id is None and project_id is None:
            return  # purely personal category — always allowed for owner
        if group_id is not None:
            membership = await self._groups.get_membership(group_id, user_id)
            if membership is None:
                raise AccessDeniedError()
        if project_id is not None:
            project = await self._projects.get_project_raw(project_id)
            await self._projects.assert_access(project, user_id)

    async def assert_access(self, category: Category, user_id: str) -> None:
        if category.owner_id == user_id:
            return
        if category.group_id:
            if await self._groups.get_membership(category.group_id, user_id):
                return
        if category.project_id:
            try:
                project = await self._projects.get_project_raw(category.project_id)
                await self._projects.assert_access(project, user_id)
                return
            except AccessDeniedError:
                pass
        raise AccessDeniedError()

    async def _member_ids(self, category: Category) -> list[str]:
        """Users who should receive SSE events for this category."""
        if category.group_id:
            return await self._groups.list_member_ids(category.group_id)
        if category.project_id:
            project = await self._projects.get_project_raw(category.project_id)
            if project.group_id:
                return await self._groups.list_member_ids(project.group_id)
            return [project.owner_id]
        return [category.owner_id]

    # ── Queries ───────────────────────────────────────────────────────────────

    async def list_categories(self, user_id: str) -> list[Category]:
        group_ids = await self._groups.list_group_ids_for_user(user_id)
        projects = await self._projects.list_projects(user_id)
        project_ids = [p.id for p in projects]
        return await self._categories.list_accessible(user_id, group_ids, project_ids)

    async def get_category(self, category_id: str, user_id: str) -> Category:
        category = await self._categories.get_by_id(category_id)
        if not category:
            raise NotFoundError("Category", category_id)
        await self.assert_access(category, user_id)
        return category

    # ── Mutations ─────────────────────────────────────────────────────────────

    async def create_category(
        self,
        user_id: str,
        name: str,
        description: str | None,
        color: str,
        group_id: str | None,
        project_id: str | None,
    ) -> tuple[Category, list[str]]:
        await self._assert_scope_access(user_id, group_id, project_id)
        category = await self._categories.create(
            name=name,
            description=description,
            color=color,
            group_id=group_id,
            project_id=project_id,
            owner_id=user_id,
        )
        member_ids = await self._member_ids(category)
        return category, member_ids

    async def update_category(
        self,
        category_id: str,
        user_id: str,
        name: str | None,
        description: str | None,
        color: str | None,
    ) -> tuple[Category, list[str]]:
        category = await self.get_category(category_id, user_id)
        updated = await self._categories.update(
            category, name=name, description=description, color=color
        )
        member_ids = await self._member_ids(updated)
        return updated, member_ids

    async def delete_category(
        self, category_id: str, user_id: str
    ) -> tuple[str, list[str], list[Task]]:
        """
        On delete, null-out tasks that reference this category so they remain
        intact but uncategorized. Returns the orphaned tasks (refetched with
        relationships loaded) so the router can emit task_updated SSE events.
        """
        category = await self.get_category(category_id, user_id)
        member_ids = await self._member_ids(category)
        session = self._categories._session  # same AsyncSession
        result = await session.execute(
            update(Task)
            .where(Task.category_id == category.id)
            .values(category_id=None)
            .returning(Task.id)
        )
        orphaned_ids = [row[0] for row in result.all()]
        await self._categories.delete(category)
        orphaned_tasks: list[Task] = []
        for tid in orphaned_ids:
            fresh = await self._tasks.get_by_id(tid)
            if fresh is not None:
                orphaned_tasks.append(fresh)
        return category_id, member_ids, orphaned_tasks
