"""add reservation card fields

Revision ID: 20260218_04
Revises: 20260218_03
Create Date: 2026-02-18 23:40:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260218_04"
down_revision: str | Sequence[str] | None = "20260218_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("reservations", sa.Column("purpose", sa.String(length=500), nullable=True))
    op.add_column("reservations", sa.Column("agenda_url", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("reservations", "agenda_url")
    op.drop_column("reservations", "purpose")
