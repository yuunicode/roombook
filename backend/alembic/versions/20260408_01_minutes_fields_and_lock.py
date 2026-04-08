"""add minutes fields and lock table

Revision ID: 20260408_01
Revises: 20260309_01
Create Date: 2026-04-08 21:10:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260408_01"
down_revision: str | Sequence[str] | None = "20260309_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reservations", sa.Column("label", sa.String(length=100), nullable=False, server_default=""))
    op.add_column("reservations", sa.Column("external_attendees", sa.String(length=1000), nullable=True))
    op.add_column("reservations", sa.Column("agenda", sa.String(length=4000), nullable=True))
    op.add_column("reservations", sa.Column("meeting_content", sa.String(length=8000), nullable=True))
    op.add_column("reservations", sa.Column("meeting_result", sa.String(length=8000), nullable=True))
    op.add_column("reservations", sa.Column("minutes_attachment", sa.String(length=1000), nullable=True))

    op.create_table(
        "minutes_locks",
        sa.Column("reservation_id", sa.String(length=50), nullable=False),
        sa.Column("holder_user_id", sa.String(length=50), nullable=False),
        sa.Column("holder_name", sa.String(length=100), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["holder_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("reservation_id"),
    )

    op.alter_column("reservations", "label", server_default=None)


def downgrade() -> None:
    op.drop_table("minutes_locks")
    op.drop_column("reservations", "minutes_attachment")
    op.drop_column("reservations", "meeting_result")
    op.drop_column("reservations", "meeting_content")
    op.drop_column("reservations", "agenda")
    op.drop_column("reservations", "external_attendees")
    op.drop_column("reservations", "label")
