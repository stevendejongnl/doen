from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

from app.exceptions import AccessDeniedError, InvalidTokenError, NotFoundError
from app.models.api_key import ApiKey
from app.models.base import utcnow
from app.models.user import User
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.user_repo import UserRepository

TOKEN_PREFIX = "doen_"
DISPLAY_PREFIX_LEN = 8


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass(frozen=True)
class CreatedApiKey:
    key: ApiKey
    plaintext_token: str  # shown once to the caller; never stored


class ApiKeyService:
    def __init__(self, keys: ApiKeyRepository, users: UserRepository) -> None:
        self._keys = keys
        self._users = users

    async def create(
        self, user_id: str, name: str, expires_at: datetime | None = None
    ) -> CreatedApiKey:
        random = secrets.token_urlsafe(32)
        token = f"{TOKEN_PREFIX}{random}"
        token_prefix = random[:DISPLAY_PREFIX_LEN]
        key = await self._keys.create(
            user_id=user_id,
            name=name,
            token_hash=_hash(token),
            token_prefix=token_prefix,
            expires_at=expires_at,
        )
        return CreatedApiKey(key=key, plaintext_token=token)

    async def list_for_user(self, user_id: str) -> list[ApiKey]:
        return await self._keys.list_for_user(user_id)

    async def revoke(self, key_id: str, user_id: str) -> None:
        key = await self._keys.get_by_id(key_id)
        if not key or key.revoked_at is not None:
            raise NotFoundError("ApiKey", key_id)
        if key.user_id != user_id:
            raise AccessDeniedError("Cannot revoke another user's API key")
        await self._keys.revoke(key)

    async def authenticate(self, token: str) -> User:
        """Resolve a `doen_*` token to its owning User. Raises InvalidTokenError on any failure."""
        if not token.startswith(TOKEN_PREFIX):
            raise InvalidTokenError("Not an API key")

        key = await self._keys.get_by_hash(_hash(token))
        if not key:
            raise InvalidTokenError("API key not recognised")
        if key.revoked_at is not None:
            raise InvalidTokenError("API key revoked")
        if key.expires_at is not None:
            expires = key.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < utcnow():
                raise InvalidTokenError("API key expired")

        user = await self._users.get_by_id(key.user_id)
        if not user:
            raise InvalidTokenError("API key owner no longer exists")

        await self._keys.touch_last_used(key)
        return user
