from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC

from app.exceptions import (
    ConflictError,
    InvitationAlreadyAcceptedError,
    InvitationEmailMismatchError,
    InvitationExpiredError,
    NotFoundError,
)
from app.models.base import utcnow
from app.models.group_invitation import GroupInvitation
from app.repositories.group_invitation_repo import GroupInvitationRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository
from app.services.auth import AuthService


@dataclass(frozen=True)
class InvitationDetails:
    group_id: str
    group_name: str
    inviter_name: str
    email: str
    existing_user: bool


@dataclass(frozen=True)
class AcceptResult:
    group_id: str
    user_id: str
    tokens: tuple[str, str] | None  # (access, refresh) when a new account was created


class GroupInvitationService:
    def __init__(
        self,
        invitation_repo: GroupInvitationRepository,
        group_repo: GroupRepository,
        user_repo: UserRepository,
        auth_service: AuthService,
    ) -> None:
        self._invitations = invitation_repo
        self._groups = group_repo
        self._users = user_repo
        self._auth = auth_service

    async def _load_active(self, token: str) -> GroupInvitation:
        invite = await self._invitations.get_by_token(token)
        if not invite:
            raise NotFoundError("Invitation", token)
        if invite.accepted_at is not None:
            raise InvitationAlreadyAcceptedError()
        expires = invite.expires_at
        if expires.tzinfo is None:  # SQLite round-trips as naive
            expires = expires.replace(tzinfo=UTC)
        if expires < utcnow():
            raise InvitationExpiredError()
        return invite

    async def describe(self, token: str) -> InvitationDetails:
        invite = await self._load_active(token)

        group = await self._groups.get_by_id(invite.group_id)
        if not group:
            raise NotFoundError("Group", invite.group_id)

        inviter = await self._users.get_by_id(invite.invited_by_user_id)
        inviter_name = inviter.name if inviter else "Iemand"

        existing = await self._users.get_by_email(invite.email)
        return InvitationDetails(
            group_id=group.id,
            group_name=group.name,
            inviter_name=inviter_name,
            email=invite.email,
            existing_user=existing is not None,
        )

    async def accept_as_user(self, token: str, current_user_id: str) -> AcceptResult:
        invite = await self._load_active(token)

        user = await self._users.get_by_id(current_user_id)
        if not user or user.email.lower() != invite.email.lower():
            raise InvitationEmailMismatchError()

        await self._add_member_if_missing(invite.group_id, user.id, invite.role)
        await self._invitations.mark_accepted(invite)
        return AcceptResult(group_id=invite.group_id, user_id=user.id, tokens=None)

    async def accept_with_signup(
        self, token: str, *, name: str, password: str
    ) -> AcceptResult:
        invite = await self._load_active(token)

        if await self._users.get_by_email(invite.email):
            raise ConflictError(
                "Account already exists for this email — please log in to accept."
            )

        tokens = await self._auth.register(invite.email, name, password)
        user = await self._users.get_by_email(invite.email)
        assert user is not None  # just created

        await self._add_member_if_missing(invite.group_id, user.id, invite.role)
        await self._invitations.mark_accepted(invite)
        return AcceptResult(group_id=invite.group_id, user_id=user.id, tokens=tokens)

    async def _add_member_if_missing(self, group_id: str, user_id: str, role: str) -> None:
        existing = await self._groups.get_membership(group_id, user_id)
        if existing:
            return
        await self._groups.add_member(group_id, user_id, role)
