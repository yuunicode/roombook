"""create timetables and reservations

Revision ID: 20260218_02
Revises: 20260218_01
Create Date: 2026-02-18 00:10:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260218_02"
down_revision: str | Sequence[str] | None = "20260218_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "timetables",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("room_id", sa.String(length=50), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("end_at > start_at", name="ck_timetables_end_after_start"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_id", "start_at", "end_at", name="uq_timetables_room_time"),
    )

    op.create_table(
        "reservations",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("timetable_id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["timetable_id"], ["timetables.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("timetable_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("reservations")
    op.drop_table("timetables")
