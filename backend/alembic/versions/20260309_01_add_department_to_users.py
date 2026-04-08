"""add department to users

Revision ID: 20260309_01
Revises: 20260219_01
Create Date: 2026-03-09 00:00:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260309_01"
down_revision: str | Sequence[str] | None = "20260219_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column("department", sa.String(length=50), nullable=True),
    )
    # Set default department for ALL existing users to avoid NOT NULL violation
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE users SET department = '미지정' WHERE department IS NULL"))
    # Make department non-nullable
    op.alter_column(
        "users",
        "department",
        existing_type=sa.String(length=50),
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "department")
