from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_group_service, raise_http
from app.api.schemas import (
    GroupCreate,
    GroupMemberOut,
    GroupOut,
    GroupUpdate,
    MemberInvite,
)
from app.exceptions import DoenError
from app.models.user import User
from app.services.group_service import GroupService
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/groups", tags=["groups"])


def _group_payload(group: object) -> dict:
    return GroupOut.model_validate(group).model_dump(mode="json")


@router.get("", response_model=list[GroupOut])
async def list_groups(
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> list:
    return await svc.list_groups(current_user.id)


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
):
    group = await svc.create_group(body.name, body.type, current_user.id)
    await sse_bus.publish(current_user.id, "group_created", _group_payload(group))
    return group


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
):
    try:
        return await svc.get_group(group_id)
    except DoenError as exc:
        raise_http(exc)


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: str,
    body: GroupUpdate,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
):
    try:
        updated = await svc.update_group(group_id, current_user.id, body.name, body.type)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc.list_member_ids(group_id)
    await sse_bus.publish_to_group(member_ids, "group_updated", _group_payload(updated))
    return updated


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> None:
    try:
        member_ids = await svc.list_member_ids(group_id)
        await svc.delete_group(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "group_deleted", {"id": group_id})


@router.get("/{group_id}/members", response_model=list[GroupMemberOut])
async def list_members(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> list[GroupMemberOut]:
    try:
        members = await svc.list_members(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    return [
        GroupMemberOut(user_id=user.id, name=user.name, email=user.email, role=role)
        for user, role in members
    ]


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    group_id: str,
    body: MemberInvite,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> dict:
    try:
        result = await svc.invite_member(group_id, current_user.id, body.email, body.role)
    except DoenError as exc:
        raise_http(exc)
    if result.status == "added" and result.user_id:
        member_ids = await svc.list_member_ids(group_id)
        await sse_bus.publish_to_group(
            member_ids, "group_member_added", {"group_id": group_id, "user_id": result.user_id}
        )
    return {"status": result.status, "email": result.email, "user_id": result.user_id}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> None:
    try:
        member_ids_before = await svc.list_member_ids(group_id)
        await svc.remove_member(group_id, current_user.id, user_id)
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(
        member_ids_before, "group_member_removed", {"group_id": group_id, "user_id": user_id}
    )
