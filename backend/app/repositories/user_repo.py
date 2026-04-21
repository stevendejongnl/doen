from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import new_uuid, utcnow
from app.models.category import Category
from app.models.group import Group, GroupMember
from app.models.group_invitation import GroupInvitation
from app.models.project import Project
from app.models.task import Task
from app.models.user import LocalCredential, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[User]:
        result = await self._session.execute(select(User).order_by(User.name))
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self._session.execute(select(func.count(User.id)))
        return int(result.scalar_one())

    async def count_admins(self, *, active_only: bool = True) -> int:
        stmt = select(func.count(User.id)).where(User.is_admin.is_(True))
        if active_only:
            stmt = stmt.where(User.disabled_at.is_(None))
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self._session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_ha_user_id(self, ha_user_id: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.ha_user_id == ha_user_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        name: str,
        ha_user_id: str | None = None,
        *,
        is_admin: bool = False,
    ) -> User:
        user = User(
            id=new_uuid(), email=email, name=name, ha_user_id=ha_user_id, is_admin=is_admin
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_credential(self, user_id: str) -> LocalCredential | None:
        result = await self._session.execute(
            select(LocalCredential).where(LocalCredential.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_credential(self, user_id: str, password_hash: str) -> LocalCredential:
        cred = LocalCredential(user_id=user_id, password_hash=password_hash)
        self._session.add(cred)
        await self._session.flush()
        return cred

    async def update_preferences(self, user: User, patch: dict) -> User:
        """Shallow-merge patch into user.preferences and persist."""
        merged = {**(user.preferences or {}), **patch}
        user.preferences = merged
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def set_disabled(self, user: User, when: datetime | None) -> User:
        user.disabled_at = when
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def set_admin(self, user: User, value: bool) -> User:
        user.is_admin = value
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def update_last_login(self, user_id: str) -> None:
        await self._session.execute(
            update(User).where(User.id == user_id).values(last_login_at=utcnow())
        )
        await self._session.commit()

    async def set_password_hash(self, user_id: str, password_hash: str) -> None:
        cred = await self.get_credential(user_id)
        if cred is None:
            await self.create_credential(user_id, password_hash)
        else:
            cred.password_hash = password_hash
        await self._session.commit()

    async def owned_counts(self, user_id: str) -> dict[str, int]:
        """Count rows a hard-delete would leave orphaned (FKs that aren't cascading)."""
        out: dict[str, int] = {}
        for label, stmt in (
            (
                "projects",
                select(func.count(Project.id)).where(
                    Project.owner_id == user_id, Project.archived_at.is_(None)
                ),
            ),
            (
                "categories",
                select(func.count(Category.id)).where(Category.owner_id == user_id),
            ),
            (
                "owned_groups",
                select(func.count(Group.id)).where(Group.owner_id == user_id),
            ),
            (
                "assigned_tasks",
                select(func.count(Task.id)).where(Task.assignee_id == user_id),
            ),
            (
                "group_memberships",
                select(func.count(GroupMember.user_id)).where(
                    GroupMember.user_id == user_id
                ),
            ),
            (
                "sent_invitations",
                select(func.count(GroupInvitation.id)).where(
                    GroupInvitation.invited_by_user_id == user_id
                ),
            ),
        ):
            result = await self._session.execute(stmt)
            out[label] = int(result.scalar_one())
        return out

    async def delete(self, user: User) -> None:
        """Hard-delete. Caller must ensure owned_counts are all zero for FKs
        without ON DELETE CASCADE, otherwise the commit will fail."""
        await self._session.execute(
            delete(LocalCredential).where(LocalCredential.user_id == user.id)
        )
        # Null out nullable FKs so the delete doesn't blow up on stale tasks.
        await self._session.execute(
            update(Task).where(Task.assignee_id == user.id).values(assignee_id=None)
        )
        await self._session.delete(user)
        await self._session.commit()

    async def commit(self) -> None:
        await self._session.commit()
