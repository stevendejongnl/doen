"""backfill category group_id from project scope

Categories created inline from the task form were stored with project_id only,
leaving group_id null. The group-admin category panel filters by group_id, so
those categories never appeared there. This migration promotes project-scoped
categories to group scope when the project belongs to a group.

Revision ID: 20260422_01
Revises: 20260421_01
Create Date: 2026-04-22

"""
from collections.abc import Sequence

from alembic import op

revision: str = "20260422_01"
down_revision: str | Sequence[str] | None = "20260421_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        UPDATE categories
        SET group_id = projects.group_id,
            project_id = NULL
        FROM projects
        WHERE categories.project_id = projects.id
          AND categories.group_id IS NULL
          AND projects.group_id IS NOT NULL
    """)


def downgrade() -> None:
    pass
