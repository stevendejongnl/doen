from datetime import datetime

from app.exceptions import ConflictError, NotFoundError
from app.models.task import RecurringRule, Task
from app.repositories.group_repo import GroupRepository
from app.repositories.task_repo import TaskRepository
from app.services.project_service import ProjectService


class TaskService:
    def __init__(
        self,
        task_repo: TaskRepository,
        project_service: ProjectService,
        group_repo: GroupRepository,
    ) -> None:
        self._tasks = task_repo
        self._projects = project_service
        self._groups = group_repo

    async def _member_ids_for_project(self, project_id: str) -> list[str]:
        project = await self._projects.get_project_raw(project_id)
        if project.group_id:
            return await self._groups.list_member_ids(project.group_id)
        return [project.owner_id]

    async def list_tasks_for_project(
        self, project_id: str, requesting_user_id: str
    ) -> list[Task]:
        project = await self._projects.get_project_raw(project_id)
        await self._projects.assert_access(project, requesting_user_id)
        return await self._tasks.list_for_project(project_id)

    async def list_all_tasks(
        self,
        requesting_user_id: str,
        due_today: bool = False,
        overdue: bool = False,
        assignee_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        include_unscheduled: bool = False,
    ) -> list[Task]:
        projects = await self._projects.list_projects(requesting_user_id)
        project_ids = [p.id for p in projects]
        return await self._tasks.list_accessible(
            project_ids,
            due_today=due_today,
            overdue=overdue,
            assignee_id=assignee_id,
            date_from=date_from,
            date_to=date_to,
            include_unscheduled=include_unscheduled,
        )

    async def get_task(self, task_id: str) -> Task:
        task = await self._tasks.get_by_id(task_id)
        if not task:
            raise NotFoundError("Task", task_id)
        return task

    async def create_task(
        self,
        project_id: str,
        requesting_user_id: str,
        title: str,
        notes: str | None,
        assignee_id: str | None,
        priority: str,
        due_date: datetime | None,
    ) -> tuple[Task, list[str]]:
        project = await self._projects.get_project_raw(project_id)
        await self._projects.assert_access(project, requesting_user_id)
        task = await self._tasks.create(
            title=title,
            notes=notes,
            project_id=project_id,
            assignee_id=assignee_id,
            priority=priority,
            due_date=due_date,
        )
        member_ids = await self._member_ids_for_project(project_id)
        return task, member_ids

    async def update_task(
        self, task_id: str, fields: dict[str, object]
    ) -> tuple[Task, list[str]]:
        task = await self.get_task(task_id)
        updated = await self._tasks.update(task, fields)
        member_ids = await self._member_ids_for_project(task.project_id)
        return updated, member_ids

    async def complete_task(self, task_id: str) -> tuple[Task, list[str]]:
        task = await self.get_task(task_id)
        completed = await self._tasks.complete(task)
        member_ids = await self._member_ids_for_project(task.project_id)
        return completed, member_ids

    async def delete_task(self, task_id: str) -> tuple[str, list[str]]:
        task = await self.get_task(task_id)
        member_ids = await self._member_ids_for_project(task.project_id)
        await self._tasks.delete(task)
        return task_id, member_ids

    async def create_recurring_rule(
        self,
        task_id: str,
        unit: str,
        interval: int,
        weekdays: str | None,
        month_day: int | None,
        time_of_day: str,
        parity: str,
        notify_on_spawn: bool,
    ) -> RecurringRule:
        task = await self.get_task(task_id)
        existing = await self._tasks.get_recurring_rule(task.id)
        if existing:
            raise ConflictError("Recurring rule already exists for this task")
        return await self._tasks.create_recurring_rule(
            task_id=task_id,
            unit=unit,
            interval=interval,
            weekdays=weekdays,
            month_day=month_day,
            time_of_day=time_of_day,
            parity=parity,
            notify_on_spawn=notify_on_spawn,
        )

    async def update_recurring_rule(
        self, rule_id: str, fields: dict[str, object]
    ) -> RecurringRule:
        rule = await self._tasks.get_recurring_rule_by_id(rule_id)
        if not rule:
            raise NotFoundError("RecurringRule", rule_id)
        return await self._tasks.update_recurring_rule(rule, fields)

    async def delete_recurring_rule(self, rule_id: str) -> None:
        rule = await self._tasks.get_recurring_rule_by_id(rule_id)
        if not rule:
            raise NotFoundError("RecurringRule", rule_id)
        await self._tasks.delete_recurring_rule(rule)
