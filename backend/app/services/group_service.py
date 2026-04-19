from app.exceptions import AccessDeniedError, AlreadyExistsError, ConflictError, NotFoundError
from app.models.group import Group
from app.repositories.group_repo import GroupRepository
from app.repositories.user_repo import UserRepository


class GroupService:
    def __init__(self, group_repo: GroupRepository, user_repo: UserRepository) -> None:
        self._groups = group_repo
        self._users = user_repo

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
    ) -> None:
        group = await self.get_group(group_id)
        await self._require_admin(group, requesting_user_id)

        invitee = await self._users.get_by_email(invitee_email)
        if not invitee:
            raise NotFoundError("User", invitee_email)

        existing = await self._groups.get_membership(group_id, invitee.id)
        if existing:
            raise ConflictError("User is already a member")

        await self._groups.add_member(group_id, invitee.id, role)

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
