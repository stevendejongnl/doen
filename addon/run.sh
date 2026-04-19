#!/usr/bin/env bashio

DB_MODE=$(bashio::config 'db_mode')
PG_URL=$(bashio::config 'pg_url')
SECRET_KEY=$(bashio::config 'secret_key')
HA_BASE_URL=$(bashio::config 'ha_base_url')

export DB_MODE="${DB_MODE}"
export SECRET_KEY="${SECRET_KEY}"
export HA_BASE_URL="${HA_BASE_URL}"
export HA_CLIENT_ID="$(bashio::addon.ingress_url)"

if [ "${DB_MODE}" = "postgres" ] && [ -n "${PG_URL}" ]; then
    export DATABASE_URL="${PG_URL}"
else
    export DB_MODE="sqlite"
    export DATABASE_URL="sqlite+aiosqlite:///share/doen/doen.db"
    mkdir -p /share/doen
fi

bashio::log.info "Starting Doen (db_mode=${DB_MODE})"

exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
