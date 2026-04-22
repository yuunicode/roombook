"""remove legacy default reservation labels

Revision ID: 20260422_01
Revises: 20260420_01
Create Date: 2026-04-22 15:05:00.000000

"""

from collections.abc import Sequence

import alembic.op as op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260422_01"
down_revision: str | Sequence[str] | None = "20260420_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_LABELS = ("AIDA", "부동산", "KETI")


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE reservations
            SET label = '없음'
            WHERE label IN ('AIDA', '부동산', 'KETI')
            """
        )
    )
    connection.execute(
        sa.text(
            """
            DELETE FROM reservation_labels
            WHERE name IN ('AIDA', '부동산', 'KETI')
            """
        )
    )


def downgrade() -> None:
    connection = op.get_bind()
    for label in LEGACY_LABELS:
        connection.execute(
            sa.text(
                """
                INSERT INTO reservation_labels (name, updated_at)
                VALUES (:label, now())
                ON CONFLICT (name) DO NOTHING
                """
            ),
            {"label": label},
        )
