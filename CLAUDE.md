# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Python / FastAPI)
```bash
cd backend
uv sync                          # install deps
uv run uvicorn app.main:app --reload --port 8000  # dev server
uv run pytest                    # all tests
uv run pytest app/api/test_tasks.py  # single test file
uv run pytest -k "test_create"   # single test by name
uv run ruff check app/           # lint
uv run ruff check app/ --fix     # lint + autofix
uv run mypy app/                 # type check (informational, not a hard gate)
```

### Frontend (Lit / Vite)
```bash
cd frontend
npm ci && npm run dev            # dev server at :5173
npm run build                    # type-check + Vite bundle → dist/
VITE_API_URL=http://localhost:8000 npm run dev  # point to separate backend
```

### HA Card
```bash
cd ha-card
npm ci && npm run build          # bundle → dist/doen-card.js
```

### Local full stack
```bash
docker-compose up -d             # postgres + backend + frontend on :8000/:5173
```

### K8s deploy (handled by Keel automatically after CI push, but manual):
```bash
# First time: create the secret out-of-band (values in 1Password)
kubectl create secret generic doen-secret -n doen \
  --from-literal=SECRET_KEY='...' \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=SMTP_USER='noreply@madebysteven.nl' \
  --from-literal=SMTP_PASSWORD='...'

# Apply everything else
kubectl apply -f kubernetes/
```
Namespace, ConfigMap, Deployment, Service, and Ingress are plain YAML under `kubernetes/`. Follows the same pattern as the other personal K8s projects (dude-wheres-my-package, homelab-dashboard, stash). No Helm, no Kustomize.

## Architecture

### Request flow
Browser → nginx-ingress → FastAPI (`app/main.py`) → router → service → repository → SQLAlchemy async session → PostgreSQL (prod) / SQLite (dev/addon)

### Backend layers
- **`app/api/`** — FastAPI routers (`auth`, `groups`, `projects`, `tasks`, `sse`, `ha`). All domain exceptions are caught in routers and converted to HTTP via `raise_http()` in `deps.py`.
- **`app/services/`** — Business logic. Services compose repositories and enforce access control. `TaskService` and `ProjectService` return `(entity, member_ids)` tuples so the router can push SSE events to the right users.
- **`app/repositories/`** — Pure SQLAlchemy queries, no business logic.
- **`app/models/`** — SQLAlchemy ORM models. `models/__init__.py` imports all models so `Base.metadata` is populated at startup (required for `create_all`).
- **`app/exceptions.py`** — Typed domain exceptions (`NotFoundError`, `AccessDeniedError`, etc.). `deps.py` maps each to an HTTP status code.
- **`app/config.py`** — `pydantic-settings` reads from env / `.env`. Key vars: `DATABASE_URL`, `SECRET_KEY`, `DB_MODE`, `HA_BASE_URL`.

### Real-time (SSE)
`app/services/sse_bus.py` holds a global `SSEBus` singleton — an in-memory dict of `user_id → list[asyncio.Queue]`. After every mutating task operation the router calls `sse_bus.publish_to_group(member_ids, event, data)` so all group members see live updates. The frontend opens `GET /events?token=<jwt>` and listens for named events.

### Recurring tasks
APScheduler (`AsyncIOScheduler`) runs inside the FastAPI process, polling every 60 seconds. `app/scheduler/recurring.py` queries due `RecurringRule` rows, spawns new tasks, then publishes SSE events.

### Authentication
JWT (HS256) with 15-minute access tokens and 30-day refresh tokens. `deps.get_current_user` is the FastAPI dependency used on all protected routes. HA OAuth2 flow is stubbed in `app/api/auth.py` and `app/services/ha_oauth.py` — not yet functional.

### Frontend
Single-file Lit web components. The entry shell `doen-app.ts` manages routing (`today | inbox | project | groups | admin`), SSE connection, and auth state. The sidebar dispatches `navigate` custom events upward; `doen-app` handles them.

**Shadow DOM CSS rule**: Global CSS does not reach Lit component shadow DOM. Every component that has form inputs must include its own dark input/select styles in `static styles`. This is intentional and not a bug.

**API client** (`src/services/api.ts`): `BASE = import.meta.env.VITE_API_URL ?? ''` — empty string means same-origin in production. The client auto-retries on 401 using the refresh token, then dispatches `doen:logout` if refresh fails.

### Production deployment
Multi-stage Dockerfile: node → frontend build, node → ha-card build, python:3.13-slim runtime. Frontend `dist/` is copied to `backend/static/`, then FastAPI serves it via `StaticFiles` mounted **after** all API routers (SPA fallback). The `static/` dir only exists inside the Docker image, not in the repo.

CI pushes `:latest` + `:vX.Y.Z` semver tags to `ghcr.io/stevendejongnl/doen`. Keel polls `:latest` every 5 minutes and rolls the K8s deployment automatically. Semver tags are cut by `semantic-release` on every merge to `main` using Conventional Commits (`feat:` → minor, `fix:` → patch, `feat!:` → major).

### Database
Dev default: SQLite (`doen.db` in `backend/`). Prod: PostgreSQL via `DATABASE_URL` env var. The session module swaps `postgresql://` → `postgresql+asyncpg://` automatically. Alembic migrations live in `app/db/migrations/`; `create_all` at startup is a dev convenience only.
