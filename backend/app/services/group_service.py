from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from app.config import settings
from app.exceptions import AccessDeniedError, ConflictError, NotFoundError
from app.models.base import utcnow
from app.models.group import Group
from app.repositories.group_invitation_repo import GroupInvitationRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository
from app.services.mail_service import MailService


@dataclass(frozen=True)
class InviteResult:
    status: str  # "added" | "invited"
    user_id: str | None
    email: str


class GroupService:
    def __init__(
        self,
        group_repo: GroupRepository,
        user_repo: UserRepository,
        invitation_repo: GroupInvitationRepository,
        mail: MailService,
    ) -> None:
        self._groups = group_repo
        self._users = user_repo
        self._invitations = invitation_repo
        self._mail = mail

    async def list_groups(self, user_id: str) -> list[Group]:
        return await self._groups.list_for_user(user_id)

    async def create_group(self, name: str, type: str, owner_id: str) -> Group:
        return await self._groups.create(name=name, type=type, owner_id=owner_id)

    async def get_group(self, group_id: str) -> Group:
        group = await self._groups.get_by_id(group_id)
        if not group:
            raise NotFoundError("Group", group_id)
        return group

    async def _require_admin(self, group: Group, user_id: str) -> None:
        if group.owner_id == user_id:
            return
        membership = await self._groups.get_membership(group.id, user_id)
        if not membership or membership.role != "admin":
            raise AccessDeniedError("Admin access required")

    async def update_group(
        self,
        group_id: str,
        requesting_user_id: str,
        name: str | None,
        type: str | None,
    ) -> Group:
        group = await self.get_group(group_id)
        await self._require_admin(group, requesting_user_id)
        return await self._groups.update(group, name=name, type=type)

    async def delete_group(self, group_id: str, requesting_user_id: str) -> None:
        group = await self.get_group(group_id)
        if group.owner_id != requesting_user_id:
            raise AccessDeniedError("Only the owner can delete a group")
        await self._groups.delete(group)

    async def invite_member(
        self,
        group_id: str,
        requesting_user_id: str,
        invitee_email: str,
        role: str,
    ) -> InviteResult:
        group = await self.get_group(group_id)
        await self._require_admin(group, requesting_user_id)

        inviter = await self._users.get_by_id(requesting_user_id)
        inviter_name = inviter.name if inviter else "Iemand"

        invitee = await self._users.get_by_email(invitee_email)

        if invitee is not None:
            existing = await self._groups.get_membership(group_id, invitee.id)
            if existing:
                raise ConflictError("User is already a member")

            await self._groups.add_member(group_id, invitee.id, role)
            self._mail.send_background(
                to=invitee.email,
                subject=f"Je bent toegevoegd aan {group.name}",
                template_name="group_invite.html",
                context={
                    "group_name": group.name,
                    "inviter_name": inviter_name,
                    "accept_url": f"{settings.app_base_url}/",
                    "existing_user": True,
                    "expires_days": settings.mail_invite_expires_days,
                },
            )
            return InviteResult(status="added", user_id=invitee.id, email=invitee_email)

        pending = await self._invitations.get_pending_by_email_and_group(
            invitee_email, group_id
        )
        expires_at = utcnow() + timedelta(days=settings.mail_invite_expires_days)

        if pending is not None:
            invite = await self._invitations.refresh_expiry(pending, expires_at)
        else:
            invite = await self._invitations.create(
                group_id=group_id,
                email=invitee_email,
                role=role,
                token=secrets.token_urlsafe(32),
                invited_by_user_id=requesting_user_id,
                expires_at=expires_at,
            )

        self._mail.send_background(
            to=invite.email,
            subject=f"Uitnodiging voor {group.name} op Doen",
            template_name="group_invite.html",
            context={
                "group_name": group.name,
                "inviter_name": inviter_name,
                "accept_url": f"{settings.app_base_url}/invite/{invite.token}",
                "existing_user": False,
                "expires_days": settings.mail_invite_expires_days,
            },
        )
        return InviteResult(status="invited", user_id=None, email=invite.email)

    async def remove_member(
        self,
        group_id: str,
        requesting_user_id: str,
        target_user_id: str,
    ) -> None:
        group = await self.get_group(group_id)
        await self._require_admin(group, requesting_user_id)

        membership = await self._groups.get_membership(group_id, target_user_id)
        if not membership:
            raise NotFoundError("GroupMember", target_user_id)

        await self._groups.remove_member(membership)
