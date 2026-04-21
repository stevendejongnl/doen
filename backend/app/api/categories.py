from fastapi import APIRouter, Depends, status

from app.api.deps import get_category_service, get_current_user, raise_http
from app.api.schemas import CategoryCreate, CategoryOut, CategoryUpdate
from app.exceptions import DoenError
from app.models.user import User
from app.services.category_service import CategoryService
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
) -> list:
    return await svc.list_categories(current_user.id)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
):
    try:
        category, member_ids = await svc.create_category(
            user_id=current_user.id,
            name=body.name,
            description=body.description,
            color=body.color,
            group_id=body.group_id,
            project_id=body.project_id,
        )
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(
        member_ids, "category_created", {"id": category.id}
    )
    return category


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
):
    try:
        return await svc.get_category(category_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
):
    try:
        category, member_ids = await svc.update_category(
            category_id=category_id,
            user_id=current_user.id,
            name=body.name,
            description=body.description,
            color=body.color,
        )
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(
        member_ids, "category_updated", {"id": category.id}
    )
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
) -> None:
    try:
        cid, member_ids, orphaned_task_ids = await svc.delete_category(
            category_id, current_user.id
        )
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "category_deleted", {"id": cid})
    for task_id in orphaned_task_ids:
        await sse_bus.publish_to_group(
            member_ids, "task_updated", {"id": task_id, "category_id": None}
        )
