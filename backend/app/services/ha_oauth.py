import secrets
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.exceptions import InvalidCredentialsError
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.services.auth import create_access_token, create_refresh_token


_HA_AUTH_PATH = "/auth/authorize"
_HA_TOKEN_PATH = "/auth/token"

# In-memory state store (good enough for single-instance; replace with Redis for multi-pod)
_pending_states: dict[str, str] = {}


def build_authorize_url(redirect_uri: str) -> tuple[str, str]:
    """Return (auth_url, state). Caller must store state for CSRF validation."""
    state = secrets.token_urlsafe(32)
    _pending_states[state] = redirect_uri
    params = {
        "response_type": "code",
        "client_id": settings.ha_client_id,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"{settings.ha_base_url}{_HA_AUTH_PATH}?{urlencode(params)}", state


def pop_state(state: str) -> str | None:
    """Return and consume the redirect_uri stored for this state, or None if invalid."""
    return _pending_states.pop(state, None)


async def exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for HA tokens. Returns raw HA token response."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.ha_base_url}{_HA_TOKEN_PATH}",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.ha_client_id,
                "redirect_uri": redirect_uri,
            },
        )
    if resp.status_code != 200:
        raise InvalidCredentialsError("HA token exchange failed")
    return resp.json()


async def get_ha_user_info(access_token: str) -> dict:
    """Fetch the HA user profile from /api/config."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.ha_base_url}/api/config",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise InvalidCredentialsError("Could not fetch HA user info")
    return resp.json()


async def login_or_create_ha_user(
    ha_token_data: dict,
    user_repo: UserRepository,
) -> tuple[str, str]:
    """Given HA token response, find-or-create a Doen user and issue our JWT pair."""
    ha_access = ha_token_data.get("access_token", "")
    info = await get_ha_user_info(ha_access)

    ha_user_id = info.get("external_url") or info.get("location_name") or ha_access[:16]
    name = info.get("location_name", "HA User")

    user: User | None = await user_repo.get_by_ha_user_id(ha_user_id)
    if not user:
        # Auto-register — no password since auth is delegated to HA
        email = f"ha-{ha_user_id[:8]}@ha.local"
        existing = await user_repo.get_by_email(email)
        if existing:
            user = existing
        else:
            user = await user_repo.create(email=email, name=name, ha_user_id=ha_user_id)
            await user_repo.commit()

    return create_access_token(user.id), create_refresh_token(user.id)
