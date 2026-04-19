from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import new_uuid
from app.models.user import LocalCredential, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

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

    async def create(self, email: str, name: str, ha_user_id: str | None = None) -> User:
        user = User(id=new_uuid(), email=email, name=name, ha_user_id=ha_user_id)
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

    async def commit(self) -> None:
        await self._session.commit()
