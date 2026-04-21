"""set global ai quota default limit to 5 usd

Revision ID: 20260419_02
Revises: 20260419_01
Create Date: 2026-04-19 16:20:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260419_02"
down_revision: str | Sequence[str] | None = "20260419_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "global_ai_quotas",
        "monthly_limit_usd",
        existing_type=sa.Numeric(10, 4),
        server_default=sa.text("5.0000"),
        existing_nullable=False,
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE global_ai_quotas
            SET monthly_limit_usd = 5.0000
            WHERE quota_key = 'global'
            """
        )
    )


def downgrade() -> None:
    op.alter_column(
        "global_ai_quotas",
        "monthly_limit_usd",
        existing_type=sa.Numeric(10, 4),
        server_default=sa.text("10.0000"),
        existing_nullable=False,
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE global_ai_quotas
            SET monthly_limit_usd = 10.0000
            WHERE quota_key = 'global'
            """
        )
    )
