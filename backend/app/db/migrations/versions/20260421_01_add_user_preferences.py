"""add user.preferences json column

Revision ID: 20260421_01
Revises:
Create Date: 2026-04-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260421_01"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("preferences", sa.JSON(), nullable=False, server_default="{}")
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("preferences")
