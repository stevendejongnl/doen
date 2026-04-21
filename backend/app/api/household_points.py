from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_household_points_service, raise_http
from app.api.schemas import (
    HouseholdBalanceOut,
    HouseholdNotificationOut,
    PointTransactionOut,
    PointTransferCreate,
    TaskOfferCreate,
    TaskOfferDecision,
    TaskOfferOut,
)
from app.exceptions import DoenError
from app.models.user import User
from app.services.household_points_service import HouseholdPointsService
from app.services.sse_bus import sse_bus

router = APIRouter(tags=["household-points"])


def _offer_payload(offer) -> dict:
    payload = {
        "id": offer.id,
        "task_id": offer.task_id,
        "task_title": offer.task.title if offer.task else "",
        "group_id": offer.group_id,
        "owner_id": offer.owner_id,
        "owner_name": offer.owner.name if offer.owner else "",
        "accepted_by_id": offer.accepted_by_id,
        "accepted_by_name": offer.accepted_by.name if offer.accepted_by else None,
        "approved_by_id": offer.approved_by_id,
        "approved_by_name": offer.approved_by.name if offer.approved_by else None,
        "status": offer.status,
        "reward_note": offer.reward_note,
        "point_value": offer.point_value,
        "accepted_at": offer.accepted_at,
        "decided_at": offer.decided_at,
        "created_at": offer.created_at,
        "updated_at": offer.updated_at,
    }
    return TaskOfferOut.model_validate(payload).model_dump(mode="json")


def _transaction_payload(tx: dict) -> dict:
    return PointTransactionOut.model_validate(tx).model_dump(mode="json")


@router.get("/households/{group_id}/balances", response_model=list[HouseholdBalanceOut])
async def list_balances(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> list[dict]:
    try:
        return await svc.list_balances(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.get("/households/{group_id}/offers", response_model=list[TaskOfferOut])
async def list_offers(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> list[dict]:
    try:
        offers = await svc.list_offers(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    return [_offer_payload(offer) for offer in offers]


@router.get("/households/{group_id}/transactions", response_model=list[PointTransactionOut])
async def list_transactions(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> list[dict]:
    try:
        txs = await svc.list_transactions(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    return [_transaction_payload(tx) for tx in txs]


@router.get("/households/{group_id}/notifications", response_model=list[HouseholdNotificationOut])
async def list_notifications(
    group_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> list[dict]:
    try:
        return await svc.list_notifications(group_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)


@router.post(
    "/tasks/{task_id}/offer",
    response_model=TaskOfferOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_offer(
    task_id: str,
    body: TaskOfferCreate,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
):
    try:
        offer = await svc.create_offer(task_id, current_user.id, body.reward_note)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc._groups.list_member_ids(offer.group_id)
    await sse_bus.publish_to_group(member_ids, "offer_created", _offer_payload(offer))
    return _offer_payload(offer)


@router.post("/offers/{offer_id}/accept", response_model=TaskOfferOut)
async def accept_offer(
    offer_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
):
    try:
        offer = await svc.accept_offer(offer_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc._groups.list_member_ids(offer.group_id)
    await sse_bus.publish_to_group(member_ids, "offer_updated", _offer_payload(offer))
    return _offer_payload(offer)


@router.post("/offers/{offer_id}/decision", response_model=TaskOfferOut)
async def decide_offer(
    offer_id: str,
    body: TaskOfferDecision,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
):
    try:
        offer = await svc.decide_offer(offer_id, current_user.id, body.approved, body.reopen)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc._groups.list_member_ids(offer.group_id)
    await sse_bus.publish_to_group(member_ids, "offer_updated", _offer_payload(offer))
    return _offer_payload(offer)


@router.post("/households/{group_id}/transfer", status_code=status.HTTP_204_NO_CONTENT)
async def transfer_points(
    group_id: str,
    body: PointTransferCreate,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> None:
    try:
        await svc.transfer_points(
            group_id=group_id,
            requesting_user_id=current_user.id,
            to_user_id=body.to_user_id,
            amount=body.amount,
            note=body.note,
        )
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc._groups.list_member_ids(group_id)
    await sse_bus.publish_to_group(member_ids, "points_updated", {"group_id": group_id})


@router.delete("/offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_offer(
    offer_id: str,
    current_user: User = Depends(get_current_user),
    svc: HouseholdPointsService = Depends(get_household_points_service),
) -> None:
    try:
        offer = await svc.withdraw_offer(offer_id, current_user.id)
    except DoenError as exc:
        raise_http(exc)
    member_ids = await svc._groups.list_member_ids(offer.group_id)
    await sse_bus.publish_to_group(member_ids, "offer_updated", _offer_payload(offer))
