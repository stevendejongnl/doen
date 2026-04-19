from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_project_service, raise_http
from app.api.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.exceptions import DoenError
from app.models.user import User
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


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
    return await svc.create_project(
        body.name, body.description, body.color, body.group_id, current_user.id
    )


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
        return await svc.update_project(
            project_id, current_user.id, body.name, body.description, body.color
        )
    except DoenError as exc:
        raise_http(exc)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
) -> None:
    try:
        await svc.delete_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: ProjectService = Depends(get_project_service),
):
    try:
        return await svc.archive_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
