# Stage 1: build frontend
FROM node:lts-alpine AS frontend-builder
ARG APP_VERSION=0.0.0
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_APP_VERSION=$APP_VERSION npm run build

# Stage 2: build ha-card
FROM node:lts-alpine AS card-builder
WORKDIR /app/ha-card
COPY ha-card/package*.json ./
RUN npm ci
COPY ha-card/ ./
RUN npm run build

# Stage 3: runtime
FROM python:3.13-slim
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy backend deps first for cache
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-dev --frozen || uv sync --no-dev

# Copy backend source
COPY backend/ .

# Copy built frontend into static dir
COPY --from=frontend-builder /app/frontend/dist /app/static

# Copy ha-card dist so it can be served too
COPY --from=card-builder /app/ha-card/dist /app/static/ha-card

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
