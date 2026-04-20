# Doen

Personal and household task planning app. Dutch for "to do / do it".

**Live**: [doen.madebysteven.nl](https://doen.madebysteven.nl)

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.13, FastAPI, SQLAlchemy (async), APScheduler |
| Frontend | Lit web components, Vite, TypeScript |
| Database | PostgreSQL (production) / SQLite (dev / HA addon) |
| Real-time | Server-Sent Events (`/events`) |
| Auth | JWT (standalone) · HA OAuth2 (planned) |
| HA card | Lit custom element, served at `/ha-card/doen-card.js` |
| Deploy | K8s + Helm, auto-updated by Keel on every push to `main` |

## Local development

```bash
# Full stack (postgres + backend + frontend)
docker-compose up -d

# Backend only (SQLite, no Docker)
cd backend && uv sync
uv run uvicorn app.main:app --reload

# Frontend only (points to local backend)
cd frontend && npm ci
VITE_API_URL=http://localhost:8000 npm run dev
```

API docs at `http://localhost:8000/docs`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./doen.db` | Async DB URL |
| `SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `DB_MODE` | `sqlite` | `sqlite` or `postgres` |
| `HA_BASE_URL` | `` | Home Assistant instance URL for OAuth |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed CORS origins |

Copy `backend/.env.example` (or create `backend/.env`) to set these locally.

## Project structure

```
backend/        FastAPI app, services, repositories, scheduler
frontend/       Lit PWA (Vite build → backend/static/ in Docker image)
ha-card/        Lovelace card (Lit, bundled to doen-card.js)
ha-integration/ Custom HA integration (sensors, config_flow)
addon/          HA addon packaging (config.yaml, Dockerfile)
kubernetes/     K8s manifests — namespace, deployment, service, ingress, configmap
```

## Deployment

Every push to `main`:
1. CI runs tests + lint
2. `semantic-release` cuts a semver tag from Conventional Commits
3. Docker image pushed to `ghcr.io/stevendejongnl/doen` (`:latest` + `:vX.Y.Z`)
4. Keel detects the new `:latest` and redeploys within 5 minutes

Manual deploy:
```bash
# First-time: create the secret from values in 1Password
kubectl create secret generic doen-secret -n doen \
  --from-literal=SECRET_KEY='<jwt-secret>' \
  --from-literal=DATABASE_URL='<pg-url>' \
  --from-literal=SMTP_USER='noreply@madebysteven.nl' \
  --from-literal=SMTP_PASSWORD='<mailcow-password>'

kubectl apply -f kubernetes/
```

## Commit conventions

Uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

- `fix: ...` → patch release
- `feat: ...` → minor release
- `feat!:` or `BREAKING CHANGE:` footer → major release
