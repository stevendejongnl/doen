from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_group_service, raise_http
from app.api.schemas import GroupCreate, GroupOut, GroupUpdate, MemberInvite
from app.exceptions import DoenError
from app.models.user import User
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["groups"])


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
    return await svc.create_group(body.name, body.type, current_user.id)


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
        return await svc.update_group(group_id, current_user.id, body.name, body.type)
    except DoenError as exc:
        raise_http(exc)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> None:
    try:
        await svc.delete_group(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    group_id: str,
    body: MemberInvite,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> dict:
    try:
        await svc.invite_member(group_id, current_user.id, body.email, body.role)
    except DoenError as exc:
        raise_http(exc)
    return {"detail": "Member added"}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    svc: GroupService = Depends(get_group_service),
) -> None:
    try:
        await svc.remove_member(group_id, current_user.id, user_id)
    except DoenError as exc:
        raise_http(exc)
