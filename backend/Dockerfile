FROM python:3.11-slim

# System dependencies needed by Typst (the RenderCV renderer) and fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend source into /app/backend/ so that filesystem.py's parents[3]
# resolves to /app (the project root), matching the repo layout exactly.
COPY backend/ /app/backend/

# Install Python dependencies from pyproject.toml.
RUN pip install --no-cache-dir -e /app/backend/

# Data directories are volume-mounted at runtime; create them here so the
# container starts cleanly even if volumes are not yet mounted.
RUN mkdir -p /app/data/tailored_resumes /app/my_info

WORKDIR /app/backend

# Expose the backend port.
EXPOSE 8921

# Run Alembic migrations then start Uvicorn.
# Migrations must run before the app boots to avoid schema mismatches.
# `exec` replaces the shell with uvicorn so Docker SIGTERM goes directly
# to uvicorn (clean shutdown). No --workers flag = single-process mode,
# which means the lifespan runs exactly once and avoids the startup-log
# spam caused by the master+worker split in multiprocess mode.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8921"]
