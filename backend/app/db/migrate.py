"""Runtime schema migrations — invoked from main.py after create_all.

Not a full Alembic setup; just enough to evolve existing deployments without
requiring operators to run migration commands. Each function is idempotent.
"""
from datetime import UTC, datetime

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine


async def migrate_recurring_rules_to_structured(engine: AsyncEngine) -> None:
    """Evolve recurring_rules from schedule_cron (single column) to structured fields.

    Runs once on startup. Idempotent: detects completion by checking for the
    presence of the `unit` column.
    """
    async with engine.begin() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_columns("recurring_rules")
        )
        names = {c["name"] for c in columns}

        has_structured = "unit" in names
        has_legacy = "schedule_cron" in names

        if has_structured and not has_legacy:
            return  # fully migrated

        dialect = conn.dialect.name

        if not has_structured:
            # Add structured columns as nullable (then backfill + tighten where needed)
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN unit VARCHAR"))
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN interval INTEGER"))
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN weekdays VARCHAR"))
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN month_day INTEGER"))
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN time_of_day VARCHAR"))
            await conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN parity VARCHAR"))
            if "created_at" not in names:
                created_at_ddl = (
                    "ALTER TABLE recurring_rules ADD COLUMN created_at TIMESTAMP WITH TIME ZONE"
                    if dialect == "postgresql"
                    else "ALTER TABLE recurring_rules ADD COLUMN created_at DATETIME"
                )
                await conn.execute(text(created_at_ddl))

        if has_legacy:
            rows = (
                await conn.execute(text("SELECT id, schedule_cron FROM recurring_rules"))
            ).all()
            for row_id, cron in rows:
                fields = _cron_to_structured(cron)
                await conn.execute(
                    text(
                        "UPDATE recurring_rules "
                        "SET unit=:unit, interval=:interval, weekdays=:weekdays, "
                        "    month_day=:month_day, time_of_day=:time_of_day, parity=:parity "
                        "WHERE id=:id"
                    ),
                    {"id": row_id, **fields},
                )

        now = datetime.now(UTC).isoformat()
        await conn.execute(
            text(
                "UPDATE recurring_rules SET "
                "unit = COALESCE(unit, 'week'), "
                "interval = COALESCE(interval, 1), "
                "time_of_day = COALESCE(time_of_day, '08:00'), "
                "parity = COALESCE(parity, 'any'), "
                "created_at = COALESCE(created_at, :now)"
            ),
            {"now": now},
        )

        if has_legacy:
            try:
                await conn.execute(text("ALTER TABLE recurring_rules DROP COLUMN schedule_cron"))
            except Exception:
                # SQLite < 3.35 can't drop columns; leave the legacy column orphaned.
                pass


def _cron_to_structured(cron: str | None) -> dict:
    """Parse a 5-field cron expression into structured fields. Falls back to weekly-Mon-08:00."""
    default = {
        "unit": "week",
        "interval": 1,
        "weekdays": "0",
        "month_day": None,
        "time_of_day": "08:00",
        "parity": "any",
    }
    if not cron:
        return default
    parts = cron.split()
    if len(parts) != 5:
        return default
    minute, hour, dom, _month, dow = parts

    if minute.isdigit() and hour.isdigit():
        time_of_day = f"{int(hour):02d}:{int(minute):02d}"
    else:
        time_of_day = "08:00"

    if dow != "*" and dow.isdigit():
        # Legacy cron uses 0=Sun..6=Sat; map to 0=Mon..6=Sun.
        cron_dow = int(dow) % 7
        iso_dow = (cron_dow - 1) % 7  # Sun(0)→6, Mon(1)→0, …, Sat(6)→5
        return {
            "unit": "week",
            "interval": 1,
            "weekdays": str(iso_dow),
            "month_day": None,
            "time_of_day": time_of_day,
            "parity": "any",
        }
    if dom != "*" and dom.isdigit():
        return {
            "unit": "month",
            "interval": 1,
            "weekdays": None,
            "month_day": int(dom),
            "time_of_day": time_of_day,
            "parity": "any",
        }
    return {
        "unit": "day",
        "interval": 1,
        "weekdays": None,
        "month_day": None,
        "time_of_day": time_of_day,
        "parity": "any",
    }
