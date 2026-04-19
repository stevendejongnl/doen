from datetime import UTC, datetime

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.base import new_uuid
from app.models.group import GroupMember
from app.models.project import Project
from app.models.task import RecurringRule, Task
from app.services.sse_bus import sse_bus


async def spawn_due_tasks(Session: async_sessionmaker[AsyncSession]) -> int:
    """Query all active recurring rules and spawn tasks that are due. Returns spawn count."""
    now = datetime.now(UTC)
    spawned = 0

    async with Session() as session:
        result = await session.execute(
            select(RecurringRule).where(RecurringRule.active == True)  # noqa: E712
        )
        rules = list(result.scalars().all())

        for rule in rules:
            if not _is_due(rule, now):
                continue

            template_result = await session.execute(
                select(Task).where(Task.id == rule.template_task_id)
            )
            template = template_result.scalar_one_or_none()
            if not template:
                continue

            task = Task(
                id=new_uuid(),
                title=template.title,
                notes=template.notes,
                project_id=template.project_id,
                assignee_id=template.assignee_id,
                priority=template.priority,
                status="todo",
            )
            session.add(task)
            rule.last_spawned_at = now
            spawned += 1

            await session.flush()
            user_ids = await _user_ids_for_project(session, template.project_id)
            await sse_bus.publish_to_group(
                user_ids=user_ids,
                event="task_created",
                data={
                    "id": task.id,
                    "title": task.title,
                    "project_id": task.project_id,
                    "status": task.status,
                    "priority": task.priority,
                    "from_recurring_rule": rule.id,
                },
            )

        if spawned:
            await session.commit()

    return spawned


async def _user_ids_for_project(session: AsyncSession, project_id: str) -> list[str]:
    """Return all user IDs who have access to the project (owner + group members)."""
    proj_result = await session.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        return []

    user_ids = {project.owner_id}

    if project.group_id:
        members_result = await session.execute(
            select(GroupMember.user_id).where(GroupMember.group_id == project.group_id)
        )
        for uid in members_result.scalars().all():
            user_ids.add(uid)

    return list(user_ids)


def _is_due(rule: RecurringRule, now: datetime) -> bool:
    """True if the cron expression has fired since last_spawned_at (or ever, if never spawned)."""
    try:
        cron = croniter(rule.schedule_cron, now)
        last_expected = cron.get_prev(datetime)
        if rule.last_spawned_at is None:
            return True
        last_aware = rule.last_spawned_at
        if last_aware.tzinfo is None:
            last_aware = last_aware.replace(tzinfo=UTC)
        return last_expected > last_aware
    except Exception:
        return False
