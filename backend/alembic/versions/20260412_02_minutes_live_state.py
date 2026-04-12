"""add minutes live state table

Revision ID: 20260412_02
Revises: 20260412_01
Create Date: 2026-04-12 22:40:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260412_02"
down_revision: str | Sequence[str] | None = "20260412_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "minutes_live_states",
        sa.Column("reservation_id", sa.String(length=50), nullable=False),
        sa.Column("transcript_text", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("is_recording", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by_user_id", sa.String(length=50), nullable=True),
        sa.Column("updated_by_name", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("reservation_id"),
    )


def downgrade() -> None:
    op.drop_table("minutes_live_states")
