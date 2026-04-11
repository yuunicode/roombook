"""add admin flag and reservation labels table

Revision ID: 20260411_01
Revises: 20260409_01
Create Date: 2026-04-11 11:00:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260411_01"
down_revision: str | Sequence[str] | None = "20260409_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.alter_column("users", "is_admin", server_default=None)

    op.create_table(
        "reservation_labels",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO reservation_labels (name, updated_at)
            VALUES ('없음', now()), ('AIDA', now()), ('부동산', now()), ('KETI', now())
            ON CONFLICT (name) DO NOTHING
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE reservations
            SET label = '없음'
            WHERE label IS NULL OR btrim(label) = ''
            """
        )
    )
    connection.execute(sa.text("UPDATE users SET is_admin = true WHERE name = '구지윤'"))


def downgrade() -> None:
    op.drop_table("reservation_labels")
    op.drop_column("users", "is_admin")
