# Stage 1: build frontend
FROM node:lts-alpine AS frontend-builder
ARG APP_VERSION=0.0.0
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_APP_VERSION=$APP_VERSION npm run build

# Stage 2: runtime
FROM python:3.13-slim
ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app

# tzdata so TZ=Europe/Amsterdam (set via ConfigMap) actually affects local time
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy backend deps first for cache
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-dev --frozen || uv sync --no-dev

# Copy backend source
COPY backend/ .

# Copy built frontend into static dir
COPY --from=frontend-builder /app/frontend/dist /app/static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
