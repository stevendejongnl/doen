from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, get_task_service, raise_http
from app.api.schemas import RecurringRuleCreate, RecurringRuleOut, TaskCreate, TaskOut, TaskUpdate
from app.exceptions import DoenError
from app.models.user import User
from app.services.sse_bus import sse_bus
from app.services.task_service import TaskService

router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
async def list_tasks(
    project_id: str,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
) -> list:
    try:
        return await svc.list_tasks_for_project(project_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    project_id: str,
    body: TaskCreate,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
):
    try:
        task, member_ids = await svc.create_task(
            project_id=project_id,
            requesting_user_id=current_user.id,
            title=body.title,
            notes=body.notes,
            assignee_id=body.assignee_id,
            priority=body.priority,
            due_date=body.due_date,
        )
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(
        member_ids, "task_created", {"id": task.id, "project_id": project_id}
    )
    return task


@router.get("/tasks", response_model=list[TaskOut])
async def list_all_tasks(
    due_today: bool = Query(False),
    overdue: bool = Query(False),
    assignee_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
) -> list:
    return await svc.list_all_tasks(
        requesting_user_id=current_user.id,
        due_today=due_today,
        overdue=overdue,
        assignee_id=assignee_id,
    )


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
):
    try:
        return await svc.get_task(task_id)
    except DoenError as exc:
        raise_http(exc)


@router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
):
    try:
        task, member_ids = await svc.update_task(task_id, body.model_dump(exclude_none=True))
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "task_updated", {"id": task.id})
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
) -> None:
    try:
        task_id_out, member_ids = await svc.delete_task(task_id)
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(member_ids, "task_deleted", {"id": task_id_out})


@router.post("/tasks/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
):
    try:
        task, member_ids = await svc.complete_task(task_id)
    except DoenError as exc:
        raise_http(exc)
    await sse_bus.publish_to_group(
        member_ids,
        "task_completed",
        {"id": task.id, "title": task.title, "completed_at": task.completed_at.isoformat()},
    )
    return task


@router.post("/tasks/{task_id}/recurring", response_model=RecurringRuleOut, status_code=201)
async def create_recurring_rule(
    task_id: str,
    body: RecurringRuleCreate,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
):
    try:
        return await svc.create_recurring_rule(task_id, body.schedule_cron, body.notify_on_spawn)
    except DoenError as exc:
        raise_http(exc)


@router.delete("/recurring/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    svc: TaskService = Depends(get_task_service),
) -> None:
    try:
        await svc.delete_recurring_rule(rule_id)
    except DoenError as exc:
        raise_http(exc)
