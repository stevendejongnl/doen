from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import new_uuid
from app.models.project import Project


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, project_id: str) -> Project | None:
        result = await self._session.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: str, group_ids: list[str]) -> list[Project]:
        result = await self._session.execute(
            select(Project).where(
                or_(
                    Project.owner_id == user_id,
                    Project.group_id.in_(group_ids) if group_ids else False,
                )
            )
        )
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        description: str | None,
        color: str,
        group_id: str | None,
        owner_id: str,
    ) -> Project:
        project = Project(
            id=new_uuid(),
            name=name,
            description=description,
            color=color,
            group_id=group_id,
            owner_id=owner_id,
        )
        self._session.add(project)
        await self._session.commit()
        await self._session.refresh(project)
        return project

    async def update(
        self,
        project: Project,
        name: str | None,
        description: str | None,
        color: str | None,
    ) -> Project:
        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        if color is not None:
            project.color = color
        await self._session.commit()
        await self._session.refresh(project)
        return project

    async def archive(self, project: Project) -> Project:
        project.archived_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(project)
        return project

    async def delete(self, project: Project) -> None:
        await self._session.delete(project)
        await self._session.commit()
