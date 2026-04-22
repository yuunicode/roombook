#!/bin/sh
set -eu

uv run alembic upgrade head

case "${AUTO_SEED_USERS:-true}" in
  1|true|TRUE|yes|YES)
    echo "Auto-seeding users..."
    uv run python scripts/seed_users.py
    ;;
  *)
    echo "Skipping user auto-seed."
    ;;
esac

exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
