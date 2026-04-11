"""cleanup legacy admin display name

Revision ID: 20260411_03
Revises: 20260411_02
Create Date: 2026-04-11 15:00:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260411_03"
down_revision: str | Sequence[str] | None = "20260411_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE users
            SET name = 'admin'
            WHERE name = '관리자'
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE users
            SET name = '관리자'
            WHERE name = 'admin' AND is_admin = true
            """
        )
    )
