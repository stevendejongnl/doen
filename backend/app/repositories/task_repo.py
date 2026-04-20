from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.base import new_uuid
from app.models.task import RecurringRule, Task


class TaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, task_id: str) -> Task | None:
        result = await self._session.execute(
            select(Task).options(selectinload(Task.recurring_rule)).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()

    async def list_for_project(self, project_id: str) -> list[Task]:
        result = await self._session.execute(
            select(Task)
            .options(selectinload(Task.recurring_rule))
            .where(Task.project_id == project_id)
        )
        return list(result.scalars().all())

    async def list_accessible(
        self,
        project_ids: list[str],
        due_today: bool = False,
        overdue: bool = False,
        assignee_id: str | None = None,
    ) -> list[Task]:
        if not project_ids:
            return []
        stmt = (
            select(Task)
            .options(selectinload(Task.recurring_rule))
            .where(Task.project_id.in_(project_ids))
        )
        now = datetime.now(UTC)
        if due_today:
            stmt = stmt.where(func.date(Task.due_date) == func.date(now))
        if overdue:
            stmt = stmt.where(Task.due_date < now, Task.status != "done")
        if assignee_id:
            stmt = stmt.where(Task.assignee_id == assignee_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        title: str,
        notes: str | None,
        project_id: str,
        assignee_id: str | None,
        priority: str,
        due_date: datetime | None,
    ) -> Task:
        task = Task(
            id=new_uuid(),
            title=title,
            notes=notes,
            project_id=project_id,
            assignee_id=assignee_id,
            priority=priority,
            due_date=due_date,
        )
        self._session.add(task)
        await self._session.commit()
        await self._session.refresh(task)
        await self._session.execute(
            select(Task).options(selectinload(Task.recurring_rule)).where(Task.id == task.id)
        )
        return task

    async def update(self, task: Task, fields: dict[str, object]) -> Task:
        for key, value in fields.items():
            setattr(task, key, value)
        await self._session.commit()
        result = await self._session.execute(
            select(Task).options(selectinload(Task.recurring_rule)).where(Task.id == task.id)
        )
        return result.scalar_one()

    async def complete(self, task: Task) -> Task:
        task.status = "done"
        task.completed_at = datetime.now(UTC)
        await self._session.commit()
        result = await self._session.execute(
            select(Task).options(selectinload(Task.recurring_rule)).where(Task.id == task.id)
        )
        return result.scalar_one()

    async def delete(self, task: Task) -> None:
        await self._session.delete(task)
        await self._session.commit()

    async def get_recurring_rule(self, task_id: str) -> RecurringRule | None:
        result = await self._session.execute(
            select(RecurringRule).where(RecurringRule.template_task_id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_recurring_rule_by_id(self, rule_id: str) -> RecurringRule | None:
        result = await self._session.execute(
            select(RecurringRule).where(RecurringRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def create_recurring_rule(
        self,
        task_id: str,
        schedule_cron: str,
        notify_on_spawn: bool,
    ) -> RecurringRule:
        rule = RecurringRule(
            id=new_uuid(),
            template_task_id=task_id,
            schedule_cron=schedule_cron,
            notify_on_spawn=notify_on_spawn,
        )
        self._session.add(rule)
        await self._session.commit()
        await self._session.refresh(rule)
        return rule

    async def delete_recurring_rule(self, rule: RecurringRule) -> None:
        await self._session.delete(rule)
        await self._session.commit()
