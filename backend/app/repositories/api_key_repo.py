from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey
from app.models.base import new_uuid, utcnow


class ApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: str,
        name: str,
        token_hash: str,
        token_prefix: str,
        expires_at: datetime | None,
    ) -> ApiKey:
        key = ApiKey(
            id=new_uuid(),
            user_id=user_id,
            name=name,
            token_hash=token_hash,
            token_prefix=token_prefix,
            expires_at=expires_at,
        )
        self._session.add(key)
        await self._session.commit()
        await self._session.refresh(key)
        return key

    async def list_for_user(self, user_id: str) -> list[ApiKey]:
        result = await self._session.execute(
            select(ApiKey)
            .where(ApiKey.user_id == user_id, ApiKey.revoked_at.is_(None))
            .order_by(ApiKey.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_hash(self, token_hash: str) -> ApiKey | None:
        result = await self._session.execute(
            select(ApiKey).where(ApiKey.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, key_id: str) -> ApiKey | None:
        result = await self._session.execute(select(ApiKey).where(ApiKey.id == key_id))
        return result.scalar_one_or_none()

    async def revoke(self, key: ApiKey) -> ApiKey:
        key.revoked_at = utcnow()
        await self._session.commit()
        await self._session.refresh(key)
        return key

    async def touch_last_used(self, key: ApiKey) -> None:
        key.last_used_at = utcnow()
        await self._session.commit()
