"""add reservation label visibility

Revision ID: 20260426_03
Revises: 20260426_02
Create Date: 2026-04-26 17:30:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260426_03"
down_revision: str | Sequence[str] | None = "20260426_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reservation_labels",
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.alter_column("reservation_labels", "is_hidden", server_default=None)


def downgrade() -> None:
    op.drop_column("reservation_labels", "is_hidden")
