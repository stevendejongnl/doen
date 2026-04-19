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
)
from app.models.user import User
from app.repositories.user_repo import UserRepository

_ph = PasswordHasher()


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
    def __init__(self, user_repo: UserRepository) -> None:
        self._users = user_repo

    async def register(self, email: str, name: str, password: str) -> tuple[str, str]:
        """Register a new user. Raises AlreadyExistsError if email taken."""
        if await self._users.get_by_email(email):
            raise AlreadyExistsError(f"Email '{email}' is already registered")
        user = await self._users.create(email=email, name=name)
        await self._users.create_credential(user.id, hash_password(password))
        await self._users.commit()
        return create_access_token(user.id), create_refresh_token(user.id)

    async def login(self, email: str, password: str) -> tuple[str, str]:
        """Authenticate. Raises InvalidCredentialsError on bad email/password."""
        user = await self._users.get_by_email(email)
        cred = await self._users.get_credential(user.id) if user else None
        if not user or not cred or not verify_password(password, cred.password_hash):
            raise InvalidCredentialsError()
        return create_access_token(user.id), create_refresh_token(user.id)

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Rotate tokens. Raises InvalidTokenError or NotFoundError."""
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise InvalidTokenError("Not a refresh token")
        user = await self._users.get_by_id(payload["sub"])
        if not user:
            raise NotFoundError("User", payload["sub"])
        return create_access_token(user.id), create_refresh_token(user.id)

    async def get_user_by_token(self, access_token: str) -> User:
        """Decode access token and return the user. Raises InvalidTokenError or NotFoundError."""
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise InvalidTokenError("Not an access token")
        user = await self._users.get_by_id(payload["sub"])
        if not user:
            raise NotFoundError("User", payload["sub"])
        return user
