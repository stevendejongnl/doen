from app.exceptions import AccessDeniedError, ConflictError, NotFoundError
from app.models.base import utcnow
from app.models.household_points import TaskOffer
from app.models.task import Task
from app.repositories.group_repo import GroupRepository
from app.repositories.household_points_repo import HouseholdPointsRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.user_repo import UserRepository
from app.services.project_service import ProjectService

TASK_POINT_VALUES = {
    "none": 1,
    "low": 2,
    "medium": 3,
    "high": 5,
}


class HouseholdPointsService:
    def __init__(
        self,
        points_repo: HouseholdPointsRepository,
        task_repo: TaskRepository,
        project_service: ProjectService,
        group_repo: GroupRepository,
        user_repo: UserRepository,
    ) -> None:
        self._points = points_repo
        self._tasks = task_repo
        self._projects = project_service
        self._groups = group_repo
        self._users = user_repo

    def point_value_for_priority(self, priority: str) -> int:
        return TASK_POINT_VALUES[priority]

    async def _get_task_with_project(self, task_id: str) -> tuple[Task, object]:
        task = await self._tasks.get_by_id(task_id)
        if task is None:
            raise NotFoundError("Task", task_id)
        project = await self._projects.get_project_raw(task.project_id)
        return task, project

    async def _household_group_id(self, project: object) -> str | None:
        return getattr(project, "group_id", None)

    async def _assert_group_access(self, group_id: str, user_id: str) -> None:
        group = await self._groups.get_by_id(group_id)
        if group is None:
            raise NotFoundError("Group", group_id)
        if group.owner_id == user_id:
            return
        membership = await self._groups.get_membership(group_id, user_id)
        if membership is None:
            raise AccessDeniedError()

    async def list_balances(self, group_id: str, requesting_user_id: str) -> list[dict]:
        await self._assert_group_access(group_id, requesting_user_id)
        group = await self._groups.get_by_id(group_id)
        if group is None:
            raise NotFoundError("Group", group_id)
        totals = await self._points.list_balances(group_id)
        members = await self._groups.list_members(group_id)
        return [
            {
                "user_id": user.id,
                "name": user.name,
                "balance": totals.get(user.id, 0),
            }
            for user, _role in members
        ]

    async def list_offers(self, group_id: str, requesting_user_id: str) -> list[TaskOffer]:
        await self._assert_group_access(group_id, requesting_user_id)
        return await self._points.list_offers_for_group(group_id)

    async def list_transactions(self, group_id: str, requesting_user_id: str) -> list[dict]:
        await self._assert_group_access(group_id, requesting_user_id)
        transactions = await self._points.list_transactions(group_id)
        return [
            {
                "id": tx.id,
                "group_id": tx.group_id,
                "user_id": tx.user_id,
                "user_name": name,
                "amount": tx.amount,
                "kind": tx.kind,
                "task_id": tx.task_id,
                "offer_id": tx.offer_id,
                "note": tx.note,
                "created_at": tx.created_at,
            }
            for tx, name in transactions
        ]

    async def create_offer(
        self,
        task_id: str,
        requesting_user_id: str,
        reward_note: str | None,
    ) -> TaskOffer:
        task, project = await self._get_task_with_project(task_id)
        group_id = await self._household_group_id(project)
        if group_id is None:
            raise AccessDeniedError("Household points are only available for household projects")
        await self._projects.assert_access(project, requesting_user_id)
        existing = await self._points.get_offer_for_task(task_id)
        if existing and existing.status in {"open", "requested", "approved"}:
            raise ConflictError("Task already has an active offer")
        return await self._points.create_offer(
            task_id=task.id,
            group_id=group_id,
            owner_id=requesting_user_id,
            point_value=self.point_value_for_priority(task.priority),
            reward_note=reward_note,
        )

    async def accept_offer(self, offer_id: str, user_id: str) -> TaskOffer:
        offer = await self._points.get_offer_by_id(offer_id)
        if offer is None:
            raise NotFoundError("TaskOffer", offer_id)
        if offer.status != "open":
            raise ConflictError("Offer is not open")
        if offer.owner_id == user_id:
            raise ConflictError("Owner cannot accept their own offer")
        await self._assert_group_access(offer.group_id, user_id)
        offer.accepted_by_id = user_id
        offer.accepted_at = utcnow()
        offer.status = "requested"
        return await self._points.save_offer(offer)

    async def decide_offer(
        self,
        offer_id: str,
        owner_id: str,
        approved: bool,
        reopen: bool = True,
    ) -> TaskOffer:
        offer = await self._points.get_offer_by_id(offer_id)
        if offer is None:
            raise NotFoundError("TaskOffer", offer_id)
        if offer.owner_id != owner_id:
            raise AccessDeniedError("Only the offer owner can decide")
        if offer.status != "requested":
            raise ConflictError("Offer has not been accepted yet")
        if offer.accepted_by_id is None:
            raise ConflictError("Offer is missing an accepted member")

        task, project = await self._get_task_with_project(offer.task_id)
        group_id = await self._household_group_id(project)
        if group_id is None:
            raise AccessDeniedError("Household points are only available for household projects")

        offer.decided_at = utcnow()
        if approved:
            offer.status = "approved"
            offer.approved_by_id = owner_id
            task.assignee_id = offer.accepted_by_id
            await self._tasks.update(task, {"assignee_id": task.assignee_id})
            await self._points.add_transaction(
                group_id=group_id,
                user_id=owner_id,
                amount=-offer.point_value,
                kind="offer",
                task_id=task.id,
                offer_id=offer.id,
                note=offer.reward_note,
            )
            await self._points.add_transaction(
                group_id=group_id,
                user_id=offer.accepted_by_id,
                amount=offer.point_value,
                kind="offer",
                task_id=task.id,
                offer_id=offer.id,
                note=offer.reward_note,
            )
        else:
            offer.approved_by_id = None
            offer.accepted_by_id = None
            offer.accepted_at = None
            offer.status = "open" if reopen else "closed"
        return await self._points.save_offer(offer)

    async def withdraw_offer(self, offer_id: str, owner_id: str) -> TaskOffer:
        offer = await self._points.get_offer_by_id(offer_id)
        if offer is None:
            raise NotFoundError("TaskOffer", offer_id)
        if offer.owner_id != owner_id:
            raise AccessDeniedError("Only the offer owner can withdraw it")
        offer.status = "withdrawn"
        offer.decided_at = utcnow()
        return await self._points.save_offer(offer)

    async def record_task_completion(self, task_id: str, user_id: str) -> None:
        task, project = await self._get_task_with_project(task_id)
        group_id = await self._household_group_id(project)
        if group_id is None:
            return
        offer = await self._points.get_offer_for_task(task_id)
        if offer and offer.status == "approved":
            return
        if offer and offer.status in {"open", "requested"}:
            return
        await self._points.add_transaction(
            group_id=group_id,
            user_id=user_id,
            amount=self.point_value_for_priority(task.priority),
            kind="completion",
            task_id=task.id,
            note=task.title,
        )

    async def reverse_task_completion(self, task_id: str) -> None:
        task, project = await self._get_task_with_project(task_id)
        group_id = await self._household_group_id(project)
        if group_id is None:
            return
        completion = await self._points.get_latest_completion_for_task(task.id)
        if completion is None:
            return
        existing = await self._points.get_reversal_for(completion.id)
        if existing is not None:
            return
        await self._points.add_transaction(
            group_id=group_id,
            user_id=completion.user_id,
            amount=-completion.amount,
            kind="manual",
            task_id=task.id,
            note=f"Reversal: {task.title}",
            reverses_transaction_id=completion.id,
        )

    async def transfer_points(
        self,
        group_id: str,
        requesting_user_id: str,
        to_user_id: str,
        amount: int,
        note: str | None,
    ) -> None:
        await self._assert_group_access(group_id, requesting_user_id)
        if amount <= 0:
            raise ConflictError("Amount must be greater than zero")
        if requesting_user_id == to_user_id:
            raise ConflictError("Cannot transfer points to yourself")
        await self._assert_group_access(group_id, to_user_id)
        await self._points.transfer_points(
            group_id=group_id,
            from_user_id=requesting_user_id,
            to_user_id=to_user_id,
            amount=amount,
            note=note,
        )
