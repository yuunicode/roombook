"""add rooms table

Revision ID: 20260409_01
Revises: 20260408_01
Create Date: 2026-04-09 15:00:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260409_01"
down_revision: str | Sequence[str] | None = "20260408_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO rooms (id, name, capacity, updated_at)
            VALUES
              ('A', '회의실', 30, now()),
              ('B', '회의테이블', 6, now())
            ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name,
                  capacity = EXCLUDED.capacity,
                  updated_at = now()
            """
        )
    )


def downgrade() -> None:
    op.drop_table("rooms")
