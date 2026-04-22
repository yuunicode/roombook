"""add other notes to reservations

Revision ID: 20260422_02
Revises: 20260422_01
Create Date: 2026-04-22 17:05:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260422_02"
down_revision: str | Sequence[str] | None = "20260422_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reservations", sa.Column("other_notes", sa.String(length=8000), nullable=True))


def downgrade() -> None:
    op.drop_column("reservations", "other_notes")
