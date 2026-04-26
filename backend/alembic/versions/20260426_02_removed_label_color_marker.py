"""removed label color marker

Revision ID: 20260426_02
Revises: 20260422_02
Create Date: 2026-04-26 17:25:00.000000

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "20260426_02"
down_revision: str | Sequence[str] | None = "20260422_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
