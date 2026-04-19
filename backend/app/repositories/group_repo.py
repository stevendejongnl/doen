from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, GroupMember
from app.models.base import new_uuid


class GroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, group_id: str) -> Group | None:
        result = await self._session.execute(select(Group).where(Group.id == group_id))
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: str) -> list[Group]:
        result = await self._session.execute(
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.user_id == user_id)
        )
        return list(result.scalars().all())

    async def list_group_ids_for_user(self, user_id: str) -> list[str]:
        result = await self._session.execute(
            select(GroupMember.group_id).where(GroupMember.user_id == user_id)
        )
        return list(result.scalars().all())

    async def create(self, name: str, type: str, owner_id: str) -> Group:
        group = Group(id=new_uuid(), name=name, type=type, owner_id=owner_id)
        self._session.add(group)
        await self._session.flush()
        member = GroupMember(group_id=group.id, user_id=owner_id, role="admin")
        self._session.add(member)
        await self._session.commit()
        await self._session.refresh(group)
        return group

    async def update(self, group: Group, name: str | None, type: str | None) -> Group:
        if name is not None:
            group.name = name
        if type is not None:
            group.type = type
        await self._session.commit()
        await self._session.refresh(group)
        return group

    async def delete(self, group: Group) -> None:
        await self._session.delete(group)
        await self._session.commit()

    async def get_membership(self, group_id: str, user_id: str) -> GroupMember | None:
        result = await self._session.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_member(self, group_id: str, user_id: str, role: str) -> GroupMember:
        member = GroupMember(group_id=group_id, user_id=user_id, role=role)
        self._session.add(member)
        await self._session.commit()
        return member

    async def remove_member(self, membership: GroupMember) -> None:
        await self._session.delete(membership)
        await self._session.commit()

    async def list_member_ids(self, group_id: str) -> list[str]:
        result = await self._session.execute(
            select(GroupMember.user_id).where(GroupMember.group_id == group_id)
        )
        return list(result.scalars().all())
