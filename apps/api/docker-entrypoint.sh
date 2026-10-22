#!/bin/sh
set -e

# Apply migrations, then seed the demo school once (an empty users table means a fresh database).
alembic upgrade head
if [ "${ITHRAA_SEED_ON_START:-true}" = "true" ]; then
  python -c "from sqlalchemy import text; from app.core.db import engine; \
import sys; c = engine.connect(); sys.exit(0 if c.execute(text('select count(*) from users')).scalar() else 1)" \
    || python -m app.seed.run
fi

exec "$@"
