from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_project_service, raise_http
from app.api.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.exceptions import DoenError
from app.models.user import User
from app.services.project_service import ProjectService
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_payload(project: object) -> dict:
    return ProjectOut.model_validate(project).model_dump(mode="json")


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
) -> list:
    return await svc.list_projects(current_user.id)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
):
    project = await svc.create_project(
        body.name, body.description, body.color, body.group_id, current_user.id,
        offers_enabled=body.offers_enabled,
    )
    member_ids = await svc.member_ids_for_project(project)
    await sse_bus.publish_to_group(member_ids, "project_created", _project_payload(project))
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
):
    try:
        return await svc.get_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
):
    try:
        updated = await svc.update_project(
            project_id, current_user.id, body.name, body.description, body.color,
            offers_enabled=body.offers_enabled,
        )
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc.member_ids_for_project(updated)
    await sse_bus.publish_to_group(member_ids, "project_updated", _project_payload(updated))
    return updated


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
) -> None:
    try:
        project = await svc.get_project(project_id, current_user.id)
        member_ids = await svc.member_ids_for_project(project)
        await svc.delete_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "project_deleted", {"id": project_id})


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
):
    try:
        archived = await svc.archive_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc.member_ids_for_project(archived)
    await sse_bus.publish_to_group(member_ids, "project_updated", _project_payload(archived))
    return archived
