"""add global ai quota table

Revision ID: 20260419_01
Revises: 20260412_02
Create Date: 2026-04-19 15:00:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260419_01"
down_revision: str | Sequence[str] | None = "20260412_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "global_ai_quotas",
        sa.Column("quota_key", sa.String(length=20), nullable=False),
        sa.Column("monthly_limit_usd", sa.Numeric(10, 4), nullable=False, server_default=sa.text("10.0000")),
        sa.Column("used_usd", sa.Numeric(10, 4), nullable=False, server_default=sa.text("0.0000")),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("quota_key"),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO global_ai_quotas (quota_key, monthly_limit_usd, used_usd, period_month, updated_at)
            VALUES ('global', 10.0000, 0.0000, to_char(now(), 'YYYY-MM'), now())
            ON CONFLICT (quota_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("global_ai_quotas")
