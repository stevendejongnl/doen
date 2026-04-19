from fastapi import APIRouter, Depends, status

from app.api.deps import get_auth_service, get_current_user, raise_http
from app.api.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut
from app.exceptions import DoenError
from app.models.user import User
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
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


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/ha/login")
async def ha_login() -> dict:
    return {"detail": "HA OAuth not configured yet"}


@router.get("/ha/callback")
async def ha_callback() -> dict:
    return {"detail": "HA OAuth not configured yet"}
