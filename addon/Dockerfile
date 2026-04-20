ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.13
FROM $BUILD_FROM

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Backend deps
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-dev --frozen || uv sync --no-dev

# Backend source
COPY backend/ .

# Pre-built frontend (built in CI or locally)
COPY frontend/dist /app/static

COPY addon/run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
