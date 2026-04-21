import pytest

from app.exceptions import ConflictError
from app.repositories.group_repo import GroupRepository
from app.repositories.household_points_repo import HouseholdPointsRepository
from app.repositories.project_repo import ProjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.user_repo import UserRepository
from app.services.household_points_service import HouseholdPointsService
from app.services.project_service import ProjectService


def _service(db_session) -> HouseholdPointsService:
    return HouseholdPointsService(
        HouseholdPointsRepository(db_session),
        TaskRepository(db_session),
        ProjectService(ProjectRepository(db_session), GroupRepository(db_session)),
        GroupRepository(db_session),
        UserRepository(db_session),
    )


@pytest.mark.asyncio
async def test_create_offer_accept_and_approve_updates_balances(db_session, seed_data):
    svc = _service(db_session)

    offer = await svc.create_offer(
        seed_data["group_task"].id,
        seed_data["henk"].id,
        "pizza",
    )
    assert offer.status == "open"
    assert offer.point_value == 2
    assert offer.reward_note == "pizza"

    requested = await svc.accept_offer(offer.id, seed_data["piet"].id)
    assert requested.status == "requested"
    assert requested.accepted_by_id == seed_data["piet"].id

    approved = await svc.decide_offer(offer.id, seed_data["henk"].id, approved=True)
    assert approved.status == "approved"
    assert approved.approved_by_id == seed_data["henk"].id

    balances = await svc.list_balances(seed_data["zooiboel"].id, seed_data["henk"].id)
    balance_map = {row["user_id"]: row["balance"] for row in balances}
    assert balance_map[seed_data["henk"].id] == -2
    assert balance_map[seed_data["piet"].id] == 2


@pytest.mark.asyncio
async def test_create_offer_raises_conflict_when_active_offer_exists(db_session, seed_data):
    svc = _service(db_session)
    await svc.create_offer(seed_data["group_task"].id, seed_data["henk"].id, None)

    with pytest.raises(ConflictError):
        await svc.create_offer(seed_data["group_task"].id, seed_data["henk"].id, None)


@pytest.mark.asyncio
async def test_group_task_completion_earns_points(db_session, seed_data):
    svc = _service(db_session)

    await svc.record_task_completion(seed_data["group_task"].id, seed_data["piet"].id)

    balances = await svc.list_balances(seed_data["zooiboel"].id, seed_data["henk"].id)
    balance_map = {row["user_id"]: row["balance"] for row in balances}
    assert balance_map[seed_data["piet"].id] == 2


@pytest.mark.asyncio
async def test_transfer_points_updates_both_balances(db_session, seed_data):
    svc = _service(db_session)

    await svc.transfer_points(
        seed_data["zooiboel"].id,
        seed_data["henk"].id,
        seed_data["piet"].id,
        3,
        "debt payment",
    )

    balances = await svc.list_balances(seed_data["zooiboel"].id, seed_data["henk"].id)
    balance_map = {row["user_id"]: row["balance"] for row in balances}
    assert balance_map[seed_data["henk"].id] == -3
    assert balance_map[seed_data["piet"].id] == 3
