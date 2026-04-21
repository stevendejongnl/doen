from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import new_uuid
from app.models.category import Category


class CategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, category_id: str) -> Category | None:
        result = await self._session.execute(
            select(Category).where(Category.id == category_id)
        )
        return result.scalar_one_or_none()

    async def list_accessible(
        self,
        user_id: str,
        group_ids: list[str],
        project_ids: list[str],
    ) -> list[Category]:
        clauses = [Category.owner_id == user_id]
        if group_ids:
            clauses.append(Category.group_id.in_(group_ids))
        if project_ids:
            clauses.append(Category.project_id.in_(project_ids))
        result = await self._session.execute(
            select(Category).where(or_(*clauses)).order_by(Category.name)
        )
        return list(result.scalars().all())

    async def list_for_project(self, project_id: str) -> list[Category]:
        result = await self._session.execute(
            select(Category)
            .where(Category.project_id == project_id)
            .order_by(Category.name)
        )
        return list(result.scalars().all())

    async def list_for_group(self, group_id: str) -> list[Category]:
        result = await self._session.execute(
            select(Category)
            .where(Category.group_id == group_id)
            .order_by(Category.name)
        )
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        description: str | None,
        color: str,
        group_id: str | None,
        project_id: str | None,
        owner_id: str,
    ) -> Category:
        category = Category(
            id=new_uuid(),
            name=name,
            description=description,
            color=color,
            group_id=group_id,
            project_id=project_id,
            owner_id=owner_id,
        )
        self._session.add(category)
        await self._session.commit()
        await self._session.refresh(category)
        return category

    async def update(
        self,
        category: Category,
        name: str | None,
        description: str | None,
        color: str | None,
    ) -> Category:
        if name is not None:
            category.name = name
        if description is not None:
            category.description = description
        if color is not None:
            category.color = color
        await self._session.commit()
        await self._session.refresh(category)
        return category

    async def delete(self, category: Category) -> None:
        await self._session.delete(category)
        await self._session.commit()
