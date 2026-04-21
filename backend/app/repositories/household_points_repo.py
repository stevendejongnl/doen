from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.base import new_uuid
from app.models.household_points import PointTransaction, TaskOffer
from app.models.user import User

_OFFER_LOAD_OPTS = (
    selectinload(TaskOffer.task),
    selectinload(TaskOffer.owner),
    selectinload(TaskOffer.accepted_by),
    selectinload(TaskOffer.approved_by),
)


class HouseholdPointsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_offers_for_group(self, group_id: str) -> list[TaskOffer]:
        result = await self._session.execute(
            select(TaskOffer).options(*_OFFER_LOAD_OPTS).where(TaskOffer.group_id == group_id)
        )
        return list(result.scalars().all())

    async def get_offer_by_id(self, offer_id: str) -> TaskOffer | None:
        result = await self._session.execute(
            select(TaskOffer).options(*_OFFER_LOAD_OPTS).where(TaskOffer.id == offer_id)
        )
        return result.scalar_one_or_none()

    async def get_offer_for_task(self, task_id: str) -> TaskOffer | None:
        result = await self._session.execute(
            select(TaskOffer).options(*_OFFER_LOAD_OPTS).where(TaskOffer.task_id == task_id)
        )
        return result.scalar_one_or_none()

    async def create_offer(
        self,
        *,
        task_id: str,
        group_id: str,
        owner_id: str,
        point_value: int,
        reward_note: str | None,
    ) -> TaskOffer:
        offer = TaskOffer(
            id=new_uuid(),
            task_id=task_id,
            group_id=group_id,
            owner_id=owner_id,
            point_value=point_value,
            reward_note=reward_note,
            status="open",
        )
        self._session.add(offer)
        await self._session.commit()
        result = await self._session.execute(
            select(TaskOffer).options(*_OFFER_LOAD_OPTS).where(TaskOffer.id == offer.id)
        )
        return result.scalar_one()

    async def save_offer(self, offer: TaskOffer) -> TaskOffer:
        await self._session.commit()
        result = await self._session.execute(
            select(TaskOffer).options(*_OFFER_LOAD_OPTS).where(TaskOffer.id == offer.id)
        )
        return result.scalar_one()

    async def list_balances(self, group_id: str) -> dict[str, int]:
        result = await self._session.execute(
            select(
                PointTransaction.user_id,
                func.coalesce(func.sum(PointTransaction.amount), 0),
            )
            .where(PointTransaction.group_id == group_id)
            .group_by(PointTransaction.user_id)
        )
        return {user_id: int(total) for user_id, total in result.all()}

    async def list_transactions(
        self, group_id: str, limit: int = 50
    ) -> list[tuple[PointTransaction, str]]:
        result = await self._session.execute(
            select(PointTransaction, User.name)
            .join(User, User.id == PointTransaction.user_id)
            .where(PointTransaction.group_id == group_id)
            .order_by(PointTransaction.created_at.desc())
            .limit(limit)
        )
        return [(tx, name) for tx, name in result.all()]

    async def add_transaction(
        self,
        *,
        group_id: str,
        user_id: str,
        amount: int,
        kind: str,
        task_id: str | None = None,
        offer_id: str | None = None,
        note: str | None = None,
        reverses_transaction_id: str | None = None,
    ) -> PointTransaction:
        tx = PointTransaction(
            id=new_uuid(),
            group_id=group_id,
            user_id=user_id,
            amount=amount,
            kind=kind,
            task_id=task_id,
            offer_id=offer_id,
            note=note,
            reverses_transaction_id=reverses_transaction_id,
        )
        self._session.add(tx)
        await self._session.commit()
        return tx

    async def transfer_points(
        self,
        *,
        group_id: str,
        from_user_id: str,
        to_user_id: str,
        amount: int,
        note: str | None,
    ) -> None:
        self._session.add_all(
            [
                PointTransaction(
                    id=new_uuid(),
                    group_id=group_id,
                    user_id=from_user_id,
                    amount=-amount,
                    kind="manual",
                    note=note,
                ),
                PointTransaction(
                    id=new_uuid(),
                    group_id=group_id,
                    user_id=to_user_id,
                    amount=amount,
                    kind="manual",
                    note=note,
                ),
            ]
        )
        await self._session.commit()

    async def get_latest_completion_for_task(self, task_id: str) -> PointTransaction | None:
        result = await self._session.execute(
            select(PointTransaction)
            .where(PointTransaction.task_id == task_id, PointTransaction.kind == "completion")
            .order_by(PointTransaction.created_at.desc())
        )
        return result.scalars().first()

    async def get_reversal_for(self, transaction_id: str) -> PointTransaction | None:
        result = await self._session.execute(
            select(PointTransaction).where(
                PointTransaction.reverses_transaction_id == transaction_id
            )
        )
        return result.scalar_one_or_none()
