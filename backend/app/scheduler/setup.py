import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.scheduler.recurring import spawn_due_tasks

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def create_scheduler(Session: async_sessionmaker[AsyncSession]) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_spawn,
        trigger=IntervalTrigger(minutes=1),
        args=[Session],
        id="spawn_recurring_tasks",
        replace_existing=True,
        max_instances=1,
    )
    return scheduler


async def _run_spawn(Session: async_sessionmaker[AsyncSession]) -> None:
    try:
        count = await spawn_due_tasks(Session)
        if count:
            logger.info("Spawned %d recurring task(s)", count)
    except Exception:
        logger.exception("Error in recurring task spawner")


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler


def set_scheduler(s: AsyncIOScheduler) -> None:
    global _scheduler
    _scheduler = s
