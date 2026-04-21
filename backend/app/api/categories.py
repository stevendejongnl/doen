from fastapi import APIRouter, Depends, status

from app.api.deps import get_category_service, get_current_user, raise_http
from app.api.schemas import CategoryCreate, CategoryOut, CategoryUpdate, TaskOut
from app.exceptions import DoenError
from app.models.category import Category
from app.models.user import User
from app.services.category_service import CategoryService
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/categories", tags=["categories"])


def _category_payload(category: Category) -> dict:
    return CategoryOut.model_validate(category).model_dump(mode="json")


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
        member_ids, "category_created", _category_payload(category)
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
        member_ids, "category_updated", _category_payload(category)
    )
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    svc: CategoryService = Depends(get_category_service),
) -> None:
    try:
        cid, member_ids, orphaned_tasks = await svc.delete_category(
            category_id, current_user.id
        )
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "category_deleted", {"id": cid})
    for task in orphaned_tasks:
        payload = TaskOut.model_validate(task).model_dump(mode="json")
        await sse_bus.publish_to_group(member_ids, "task_updated", payload)
