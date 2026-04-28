from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import (
    get_current_user_optional,
    get_group_invitation_service,
    get_group_repo,
    raise_http,
)
from app.api.schemas import (
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    InvitationDetailsOut,
    TokenResponse,
)
from app.exceptions import DoenError
from app.models.user import User
from app.repositories.group_repo import GroupRepository
from app.services.group_invitation_service import GroupInvitationService
from app.services.sse_bus import sse_bus

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/{token}", response_model=InvitationDetailsOut)
async def describe_invitation(
    token: str,
    svc: GroupInvitationService = Depends(get_group_invitation_service),
) -> InvitationDetailsOut:
    try:
        details = await svc.describe(token)
    except DoenError as exc:
        raise_http(exc)
    return InvitationDetailsOut(
        group_id=details.group_id,
        group_name=details.group_name,
        inviter_name=details.inviter_name,
        email=details.email,
        existing_user=details.existing_user,
    )


@router.post(
    "/{token}/accept",
    response_model=InvitationAcceptResponse,
    status_code=status.HTTP_200_OK,
)
async def accept_invitation(
    token: str,
    body: InvitationAcceptRequest,
    current_user: User | None = Depends(get_current_user_optional),
    svc: GroupInvitationService = Depends(get_group_invitation_service),
    group_repo: GroupRepository = Depends(get_group_repo),
) -> InvitationAcceptResponse:
    has_signup_payload = body.name is not None and body.password is not None
    try:
        if current_user is not None:
            result = await svc.accept_as_user(token, current_user.id)
        elif has_signup_payload:
            assert body.name is not None and body.password is not None
            result = await svc.accept_with_signup(
                token, name=body.name, password=body.password
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication or signup payload required",
            )
    except DoenError as exc:
        raise_http(exc)

    member_ids = await group_repo.list_member_ids(result.group_id)
    await sse_bus.publish_to_group(
        member_ids, "group_member_added", {"group_id": result.group_id, "user_id": result.user_id}
    )

    tokens = None
    if result.tokens is not None:
        access, refresh = result.tokens
        tokens = TokenResponse(access_token=access, refresh_token=refresh)
    return InvitationAcceptResponse(
        group_id=result.group_id,
        user_id=result.user_id,
        tokens=tokens,
    )
