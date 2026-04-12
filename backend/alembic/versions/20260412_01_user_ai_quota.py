"""add user ai quota table

Revision ID: 20260412_01
Revises: 20260411_03
Create Date: 2026-04-12 15:30:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260412_01"
down_revision: str | Sequence[str] | None = "20260411_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_ai_quotas",
        sa.Column("user_id", sa.String(length=50), nullable=False),
        sa.Column("monthly_limit_usd", sa.Numeric(10, 4), nullable=False, server_default=sa.text("1.0000")),
        sa.Column("used_usd", sa.Numeric(10, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO user_ai_quotas (user_id, monthly_limit_usd, used_usd, period_month, updated_at)
            SELECT u.id, 1.0000, 0.0000, to_char(now(), 'YYYY-MM'), now()
            FROM users u
            WHERE u.is_active IS true
            ON CONFLICT (user_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("user_ai_quotas")
