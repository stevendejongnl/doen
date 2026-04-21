from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.exceptions import (
    AccessDeniedError,
    AlreadyExistsError,
    ConflictError,
    DoenError,
    InvalidCredentialsError,
    InvalidTokenError,
    InvitationAlreadyAcceptedError,
    InvitationEmailMismatchError,
    InvitationExpiredError,
    NotFoundError,
)
from app.models.user import User
from app.repositories.api_key_repo import ApiKeyRepository
from app.repositories.category_repo import CategoryRepository
from app.repositories.group_invitation_repo import GroupInvitationRepository
from app.repositories.group_repo import GroupRepository
from app.repositories.project_repo import ProjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.user_repo import UserRepository
from app.services.api_key_service import TOKEN_PREFIX as API_KEY_PREFIX
from app.services.api_key_service import ApiKeyService
from app.services.auth import AuthService
from app.services.category_service import CategoryService
from app.services.group_invitation_service import GroupInvitationService
from app.services.group_service import GroupService
from app.services.mail_service import MailService, get_mail_service
from app.services.project_service import ProjectService
from app.services.task_service import TaskService

bearer = HTTPBearer()
bearer_optional = HTTPBearer(auto_error=False)

_STATUS_MAP: dict[type, int] = {
    NotFoundError: 404,
    AccessDeniedError: 403,
    AlreadyExistsError: 400,
    ConflictError: 409,
    InvalidCredentialsError: 401,
    InvalidTokenError: 401,
    InvitationExpiredError: 410,
    InvitationAlreadyAcceptedError: 410,
    InvitationEmailMismatchError: 403,
}


def raise_http(exc: DoenError) -> None:
    status = _STATUS_MAP.get(type(exc), 500)
    raise HTTPException(status_code=status, detail=str(exc))


# ── Repository providers ──────────────────────────────────────────────────────

def get_user_repo(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_group_repo(db: AsyncSession = Depends(get_db)) -> GroupRepository:
    return GroupRepository(db)


def get_project_repo(db: AsyncSession = Depends(get_db)) -> ProjectRepository:
    return ProjectRepository(db)


def get_task_repo(db: AsyncSession = Depends(get_db)) -> TaskRepository:
    return TaskRepository(db)


def get_group_invitation_repo(
    db: AsyncSession = Depends(get_db),
) -> GroupInvitationRepository:
    return GroupInvitationRepository(db)


def get_api_key_repo(db: AsyncSession = Depends(get_db)) -> ApiKeyRepository:
    return ApiKeyRepository(db)


def get_category_repo(db: AsyncSession = Depends(get_db)) -> CategoryRepository:
    return CategoryRepository(db)


# ── Service providers ─────────────────────────────────────────────────────────

def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repo),
) -> AuthService:
    return AuthService(user_repo)


def get_api_key_service(
    api_key_repo: ApiKeyRepository = Depends(get_api_key_repo),
    user_repo: UserRepository = Depends(get_user_repo),
) -> ApiKeyService:
    return ApiKeyService(api_key_repo, user_repo)


def get_group_service(
    group_repo: GroupRepository = Depends(get_group_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    invitation_repo: GroupInvitationRepository = Depends(get_group_invitation_repo),
    mail: MailService = Depends(get_mail_service),
) -> GroupService:
    return GroupService(group_repo, user_repo, invitation_repo, mail)


def get_group_invitation_service(
    invitation_repo: GroupInvitationRepository = Depends(get_group_invitation_repo),
    group_repo: GroupRepository = Depends(get_group_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    auth_service: AuthService = Depends(get_auth_service),
) -> GroupInvitationService:
    return GroupInvitationService(invitation_repo, group_repo, user_repo, auth_service)


def get_project_service(
    project_repo: ProjectRepository = Depends(get_project_repo),
    group_repo: GroupRepository = Depends(get_group_repo),
) -> ProjectService:
    return ProjectService(project_repo, group_repo)


def get_task_service(
    task_repo: TaskRepository = Depends(get_task_repo),
    project_service: ProjectService = Depends(get_project_service),
    group_repo: GroupRepository = Depends(get_group_repo),
    category_repo: CategoryRepository = Depends(get_category_repo),
) -> TaskService:
    return TaskService(task_repo, project_service, group_repo, category_repo)


def get_category_service(
    category_repo: CategoryRepository = Depends(get_category_repo),
    project_service: ProjectService = Depends(get_project_service),
    group_repo: GroupRepository = Depends(get_group_repo),
    task_repo: TaskRepository = Depends(get_task_repo),
) -> CategoryService:
    return CategoryService(category_repo, project_service, group_repo, task_repo)


# ── Current user ──────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    auth_service: AuthService = Depends(get_auth_service),
    api_key_service: ApiKeyService = Depends(get_api_key_service),
) -> User:
    token = credentials.credentials
    try:
        if token.startswith(API_KEY_PREFIX):
            return await api_key_service.authenticate(token)
        return await auth_service.get_user_by_token(token)
    except DoenError as exc:
        raise_http(exc)
        raise  # unreachable, satisfies type checker


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_optional),
    auth_service: AuthService = Depends(get_auth_service),
    api_key_service: ApiKeyService = Depends(get_api_key_service),
) -> User | None:
    """Return the authenticated user if a valid token (JWT or API key) is present, else None."""
    if credentials is None:
        return None
    token = credentials.credentials
    try:
        if token.startswith(API_KEY_PREFIX):
            return await api_key_service.authenticate(token)
        return await auth_service.get_user_by_token(token)
    except DoenError:
        return None
