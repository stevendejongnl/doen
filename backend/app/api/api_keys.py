from fastapi import APIRouter, Depends, status

from app.api.deps import get_api_key_service, get_current_user, raise_http
from app.api.schemas import ApiKeyCreateRequest, ApiKeyCreateResponse, ApiKeyOut
from app.exceptions import DoenError
from app.models.user import User
from app.services.api_key_service import ApiKeyService

router = APIRouter(prefix="/auth/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyOut])
async def list_keys(
    current_user: User = Depends(get_current_user),
    svc: ApiKeyService = Depends(get_api_key_service),
) -> list:
    return await svc.list_for_user(current_user.id)


@router.post("", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_key(
    body: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    svc: ApiKeyService = Depends(get_api_key_service),
) -> ApiKeyCreateResponse:
    created = await svc.create(current_user.id, body.name, body.expires_at)
    return ApiKeyCreateResponse(
        key=ApiKeyOut.model_validate(created.key),
        token=created.plaintext_token,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    svc: ApiKeyService = Depends(get_api_key_service),
) -> None:
    try:
        await svc.revoke(key_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
