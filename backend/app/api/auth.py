import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_auth_service,
    get_current_admin,
    get_current_user,
    get_db,
    get_password_reset_repo,
    get_user_repo,
    raise_http,
)
from app.api.schemas import (
    AdminSetAdminRequest,
    AuthStatusOut,
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PreferencesUpdate,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    UserOwnedCounts,
)
from app.config import settings
from app.exceptions import (
    ConflictError,
    DoenError,
    InvalidCredentialsError,
    NotFoundError,
)
from app.models.user import User
from app.repositories.password_reset_repo import PasswordResetRepository
from app.repositories.user_repo import UserRepository
from app.services import user_admin_policy
from app.services.auth import PASSWORD_RESET_TTL_MINUTES, AuthService
from app.services.mail_service import MailService, get_mail_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Public bootstrap / login / register ───────────────────────────────────────

@router.get("/status", response_model=AuthStatusOut)
async def status_endpoint(
    user_repo: UserRepository = Depends(get_user_repo),
) -> AuthStatusOut:
    """Public — lets the login page show 'create first admin' form when empty."""
    return AuthStatusOut(has_users=(await user_repo.count()) > 0)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
    user_repo: UserRepository = Depends(get_user_repo),
) -> TokenResponse:
    """First-user bootstrap only — public, no auth required.

    Creates the first account and auto-promotes it to admin.
    Returns 400 once any user exists; after that use POST /auth/users (admin-only).
    """
    if await user_repo.count() > 0:
        raise_http(
            ConflictError(
                "Instance already has users — ask an admin to create your account."
            )
        )
    try:
        access, refresh = await auth_service.register(body.email, body.name, body.password)
    except DoenError as exc:
        raise_http(exc)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        access, refresh = await auth_service.login(body.email, body.password)
    except DoenError as exc:
        raise_http(exc)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    try:
        access, ref = await auth_service.refresh(body.refresh_token)
    except DoenError as exc:
        raise_http(exc)
    return TokenResponse(access_token=access, refresh_token=ref)


# ── Self endpoints ────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/me/preferences", response_model=UserOut)
async def update_preferences(
    body: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await UserRepository(db).update_preferences(current_user, body.preferences)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    if len(body.new_password) < 6:
        raise_http(InvalidCredentialsError())
    try:
        await auth_service.change_password(
            current_user.id, body.current_password, body.new_password
        )
    except DoenError as exc:
        raise_http(exc)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
) -> None:
    """Self-service account deletion.

    Falls back to soft-disable if the user owns data that would orphan FKs,
    since a hard delete would fail. Admins cannot delete themselves if they
    are the last active admin (same invariant as admin-initiated delete).
    """
    if current_user.is_admin:
        active_admins = await user_repo.count_admins(active_only=True)
        if active_admins <= 1:
            raise_http(
                ConflictError(
                    "You are the last active admin — promote someone else first."
                )
            )

    counts = await user_repo.owned_counts(current_user.id)
    if any(v > 0 for v in counts.values()):
        await user_repo.set_disabled(current_user, _now())
        return
    await user_repo.delete(current_user)


# ── Password reset (public) ───────────────────────────────────────────────────

@router.post("/password-reset/request", status_code=status.HTTP_204_NO_CONTENT)
async def password_reset_request(
    body: PasswordResetRequest,
    auth_service: AuthService = Depends(get_auth_service),
    mail: MailService = Depends(get_mail_service),
) -> None:
    """Public. Always returns 204 to avoid account enumeration."""
    result = await auth_service.request_password_reset(body.email)
    if result is None:
        return
    user, token = result
    reset_url = f"{settings.app_base_url.rstrip('/')}/reset/{token}"
    mail.send_background(
        to=user.email,
        subject="Wachtwoord opnieuw instellen — Doen",
        template_name="password_reset.html",
        context={
            "name": user.name,
            "reset_url": reset_url,
            "ttl_minutes": PASSWORD_RESET_TTL_MINUTES,
        },
    )


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def password_reset_confirm(
    body: PasswordResetConfirm,
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    if len(body.new_password) < 6:
        raise_http(InvalidCredentialsError())
    try:
        await auth_service.confirm_password_reset(body.token, body.new_password)
    except DoenError as exc:
        raise_http(exc)


# ── User listing (any authenticated user can see who they can collaborate with) ──

@router.get("/users", response_model=list[UserOut])
async def list_users(
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    return await UserRepository(db).list_all()


# ── Admin management endpoints ────────────────────────────────────────────────

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    body: RegisterRequest,
    _admin: User = Depends(get_current_admin),
    auth_service: AuthService = Depends(get_auth_service),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    """Admin creates a regular (non-admin) user account."""
    try:
        await auth_service.register(body.email, body.name, body.password, is_admin=False)
    except DoenError as exc:
        raise_http(exc)
    user = await user_repo.get_by_email(body.email)
    assert user is not None
    return user


@router.get("/users/{user_id}/owned", response_model=UserOwnedCounts)
async def admin_user_owned_counts(
    user_id: str,
    _admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
) -> UserOwnedCounts:
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise_http(NotFoundError("User", user_id))
    return UserOwnedCounts(**await user_repo.owned_counts(user_id))


@router.post("/users/{user_id}/disable", response_model=UserOut)
async def admin_disable_user(
    user_id: str,
    admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise_http(NotFoundError("User", user_id))
    assert target is not None
    active_admins = await user_repo.count_admins(active_only=True)
    try:
        user_admin_policy.ensure_can_disable(admin, target, active_admins)
    except DoenError as exc:
        raise_http(exc)
    return await user_repo.set_disabled(target, _now())


@router.post("/users/{user_id}/enable", response_model=UserOut)
async def admin_enable_user(
    user_id: str,
    _admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise_http(NotFoundError("User", user_id))
    assert target is not None
    return await user_repo.set_disabled(target, None)


@router.post("/users/{user_id}/admin", response_model=UserOut)
async def admin_set_admin(
    user_id: str,
    body: AdminSetAdminRequest,
    admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise_http(NotFoundError("User", user_id))
    assert target is not None
    if target.is_admin and not body.is_admin:
        active_admins = await user_repo.count_admins(active_only=True)
        try:
            user_admin_policy.ensure_can_demote(admin, target, active_admins)
        except DoenError as exc:
            raise_http(exc)
    return await user_repo.set_admin(target, body.is_admin)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: str,
    admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
    reset_repo: PasswordResetRepository = Depends(get_password_reset_repo),
) -> None:
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise_http(NotFoundError("User", user_id))
    assert target is not None
    counts = await user_repo.owned_counts(user_id)
    active_admins = await user_repo.count_admins(active_only=True)
    try:
        user_admin_policy.ensure_can_delete(admin, target, active_admins, counts)
    except DoenError as exc:
        raise_http(exc)
    await reset_repo.purge_for_user(user_id)
    await user_repo.delete(target)


@router.post("/users/{user_id}/send-reset", status_code=status.HTTP_204_NO_CONTENT)
async def admin_send_reset(
    user_id: str,
    _admin: User = Depends(get_current_admin),
    user_repo: UserRepository = Depends(get_user_repo),
    auth_service: AuthService = Depends(get_auth_service),
    mail: MailService = Depends(get_mail_service),
) -> None:
    """Admin triggers a password-reset email for another user."""
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise_http(NotFoundError("User", user_id))
    assert target is not None
    result = await auth_service.request_password_reset(target.email)
    if result is None:
        return
    _user, token = result
    reset_url = f"{settings.app_base_url.rstrip('/')}/reset/{token}"
    mail.send_background(
        to=target.email,
        subject="Wachtwoord opnieuw instellen — Doen",
        template_name="password_reset.html",
        context={
            "name": target.name,
            "reset_url": reset_url,
            "ttl_minutes": PASSWORD_RESET_TTL_MINUTES,
        },
    )


# ── HA OAuth stubs (unchanged) ────────────────────────────────────────────────

@router.get("/ha/login")
async def ha_login() -> dict:
    return {"detail": "HA OAuth not configured yet"}


@router.get("/ha/callback")
async def ha_callback() -> dict:
    return {"detail": "HA OAuth not configured yet"}


def _now():
    from app.models.base import utcnow
    return utcnow()
