from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import utcnow
from app.models.user import PasswordResetToken


class PasswordResetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self, token: str, user_id: str, expires_at: datetime
    ) -> PasswordResetToken:
        row = PasswordResetToken(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            created_at=utcnow(),
        )
        self._session.add(row)
        await self._session.commit()
        return row

    async def get(self, token: str) -> PasswordResetToken | None:
        result = await self._session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token == token)
        )
        return result.scalar_one_or_none()

    async def mark_used(self, row: PasswordResetToken) -> None:
        row.used_at = utcnow()
        await self._session.commit()

    async def purge_for_user(self, user_id: str) -> None:
        await self._session.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
        )
        await self._session.commit()
