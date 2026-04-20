from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import new_uuid, utcnow
from app.models.group_invitation import GroupInvitation


class GroupInvitationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        group_id: str,
        email: str,
        role: str,
        token: str,
        invited_by_user_id: str,
        expires_at: datetime,
    ) -> GroupInvitation:
        invite = GroupInvitation(
            id=new_uuid(),
            group_id=group_id,
            email=email,
            role=role,
            token=token,
            invited_by_user_id=invited_by_user_id,
            expires_at=expires_at,
        )
        self._session.add(invite)
        await self._session.commit()
        await self._session.refresh(invite)
        return invite

    async def get_by_token(self, token: str) -> GroupInvitation | None:
        result = await self._session.execute(
            select(GroupInvitation).where(GroupInvitation.token == token)
        )
        return result.scalar_one_or_none()

    async def get_pending_by_email_and_group(
        self, email: str, group_id: str
    ) -> GroupInvitation | None:
        result = await self._session.execute(
            select(GroupInvitation).where(
                GroupInvitation.email == email,
                GroupInvitation.group_id == group_id,
                GroupInvitation.accepted_at.is_(None),
            )
        )
        return result.scalars().first()

    async def refresh_expiry(
        self, invite: GroupInvitation, expires_at: datetime
    ) -> GroupInvitation:
        invite.expires_at = expires_at
        await self._session.commit()
        await self._session.refresh(invite)
        return invite

    async def mark_accepted(self, invite: GroupInvitation) -> GroupInvitation:
        invite.accepted_at = utcnow()
        await self._session.commit()
        await self._session.refresh(invite)
        return invite

    async def delete_expired(self) -> int:
        """Delete accepted invites and unaccepted invites whose expiry has passed. Returns count."""
        # Use naive UTC for comparison since SQLite stores DateTime columns without tz.
        now = utcnow().replace(tzinfo=None)
        result = await self._session.execute(
            delete(GroupInvitation).where(
                (GroupInvitation.accepted_at.is_not(None))
                | (GroupInvitation.expires_at < now)
            )
        )
        await self._session.commit()
        return result.rowcount or 0
