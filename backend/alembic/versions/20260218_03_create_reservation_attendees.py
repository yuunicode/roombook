"""create reservation attendees

Revision ID: 20260218_03
Revises: 20260218_02
Create Date: 2026-02-18 23:20:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260218_03"
down_revision: str | Sequence[str] | None = "20260218_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "reservation_attendees",
        sa.Column("reservation_id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("reservation_id", "user_id"),
    )
    op.create_index(
        "ix_reservation_attendees_user_id",
        "reservation_attendees",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_reservation_attendees_user_id", table_name="reservation_attendees")
    op.drop_table("reservation_attendees")
