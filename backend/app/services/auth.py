import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.config import settings
from app.exceptions import (
    AlreadyExistsError,
    InvalidCredentialsError,
    InvalidTokenError,
    NotFoundError,
    UserDisabledError,
)
from app.models.user import User
from app.repositories.password_reset_repo import PasswordResetRepository
from app.repositories.user_repo import UserRepository

_ph = PasswordHasher()

PASSWORD_RESET_TTL_MINUTES = 60


# ── Pure crypto helpers (no DB, importable anywhere) ─────────────────────────

def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + expires_delta
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as e:
        raise InvalidTokenError() from e


# ── AuthService — DB-coupled auth flows ───────────────────────────────────────

class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        reset_repo: PasswordResetRepository | None = None,
    ) -> None:
        self._users = user_repo
        self._resets = reset_repo

    async def register(
        self, email: str, name: str, password: str, *, is_admin: bool | None = None
    ) -> tuple[str, str]:
        """Register a new user. Raises AlreadyExistsError if email taken.

        ``is_admin=None`` (default): auto-promote to admin iff this is the
        very first user in the system. Callers that want to force a role
        (e.g. admin creating a regular user) should pass an explicit bool.
        """
        if await self._users.get_by_email(email):
            raise AlreadyExistsError(f"Email '{email}' is already registered")
        if is_admin is None:
            is_admin = await self._users.count() == 0
        user = await self._users.create(email=email, name=name, is_admin=is_admin)
        await self._users.create_credential(user.id, hash_password(password))
        await self._users.commit()
        return create_access_token(user.id), create_refresh_token(user.id)

    async def login(self, email: str, password: str) -> tuple[str, str]:
        """Authenticate. Raises InvalidCredentialsError or UserDisabledError."""
        user = await self._users.get_by_email(email)
        cred = await self._users.get_credential(user.id) if user else None
        if not user or not cred or not verify_password(password, cred.password_hash):
            raise InvalidCredentialsError()
        if user.disabled_at is not None:
            raise UserDisabledError()
        await self._users.update_last_login(user.id)
        return create_access_token(user.id), create_refresh_token(user.id)

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Rotate tokens. Raises InvalidTokenError, NotFoundError, or UserDisabledError."""
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise InvalidTokenError("Not a refresh token")
        user = await self._users.get_by_id(payload["sub"])
        if not user:
            raise NotFoundError("User", payload["sub"])
        if user.disabled_at is not None:
            raise UserDisabledError()
        return create_access_token(user.id), create_refresh_token(user.id)

    async def get_user_by_token(self, access_token: str) -> User:
        """Decode access token and return the user. Rejects disabled users.

        Raises InvalidTokenError, NotFoundError, or UserDisabledError."""
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise InvalidTokenError("Not an access token")
        user = await self._users.get_by_id(payload["sub"])
        if not user:
            raise NotFoundError("User", payload["sub"])
        if user.disabled_at is not None:
            raise UserDisabledError()
        return user

    async def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> None:
        """Verify current password then swap the stored hash."""
        user = await self._users.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        cred = await self._users.get_credential(user_id)
        if not cred or not verify_password(current_password, cred.password_hash):
            raise InvalidCredentialsError()
        cred.password_hash = hash_password(new_password)
        await self._users.commit()

    # ── Password reset ───────────────────────────────────────────────────────

    async def request_password_reset(self, email: str) -> tuple[User, str] | None:
        """Create a reset token for the given email.

        Returns ``(user, token)`` if an account exists, else ``None`` — callers
        should behave identically either way to avoid email enumeration.
        """
        assert self._resets is not None
        user = await self._users.get_by_email(email)
        if not user or user.disabled_at is not None:
            return None
        token = secrets.token_urlsafe(32)
        expires = datetime.now(UTC) + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
        await self._resets.create(token, user.id, expires)
        return user, token

    async def confirm_password_reset(self, token: str, new_password: str) -> None:
        """Validate a reset token and swap the stored password hash."""
        assert self._resets is not None
        row = await self._resets.get(token)
        if row is None or row.used_at is not None:
            raise InvalidTokenError("Invalid or used reset token")
        expires = row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            raise InvalidTokenError("Reset token expired")
        await self._users.set_password_hash(row.user_id, hash_password(new_password))
        await self._resets.mark_used(row)
