"""initial schema

Revision ID: 20260219_01
Revises:
Create Date: 2026-02-19 01:20:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import bcrypt
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260219_01"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

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
        sa.Column("purpose", sa.String(length=500), nullable=True),
        sa.Column("agenda_url", sa.String(length=1000), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["timetable_id"], ["timetables.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("timetable_id"),
    )

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

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO users (id, name, email, password_hash, updated_at)
            VALUES (:id, :name, :email, :password_hash, now())
            """
        ),
        {
            "id": "1",
            "name": "관리자",
            "email": "admin@ecminer.com",
            "password_hash": bcrypt.hashpw(b"ecminer", bcrypt.gensalt()).decode("utf-8"),
        },
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_reservation_attendees_user_id", table_name="reservation_attendees")
    op.drop_table("reservation_attendees")
    op.drop_table("reservations")
    op.drop_table("timetables")
    op.drop_table("users")
