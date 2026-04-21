"""increase ai usage precision to 6 decimals

Revision ID: 20260420_01
Revises: 20260419_02
Create Date: 2026-04-20 00:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

revision = "20260420_01"
down_revision = "20260419_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "global_ai_quotas",
        "used_usd",
        existing_type=sa.Numeric(10, 4),
        type_=sa.Numeric(12, 6),
        existing_nullable=False,
        existing_server_default=sa.text("0.0000"),
        server_default=sa.text("0.000000"),
    )
    op.alter_column(
        "user_ai_quotas",
        "used_usd",
        existing_type=sa.Numeric(10, 4),
        type_=sa.Numeric(12, 6),
        existing_nullable=False,
        existing_server_default=sa.text("0.0000"),
        server_default=sa.text("0.000000"),
    )


def downgrade() -> None:
    op.alter_column(
        "user_ai_quotas",
        "used_usd",
        existing_type=sa.Numeric(12, 6),
        type_=sa.Numeric(10, 4),
        existing_nullable=False,
        existing_server_default=sa.text("0.000000"),
        server_default=sa.text("0.0000"),
    )
    op.alter_column(
        "global_ai_quotas",
        "used_usd",
        existing_type=sa.Numeric(12, 6),
        type_=sa.Numeric(10, 4),
        existing_nullable=False,
        existing_server_default=sa.text("0.000000"),
        server_default=sa.text("0.0000"),
    )
