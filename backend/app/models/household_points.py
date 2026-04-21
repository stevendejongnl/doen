from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class PointTransaction(Base, TimestampMixin):
    __tablename__ = "point_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(
        Enum("completion", "offer", "manual", name="point_transaction_kind"),
        nullable=False,
    )
    task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), nullable=True)
    offer_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("task_offers.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reverses_transaction_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("point_transactions.id"), nullable=True, unique=True
    )

    task: Mapped[Task | None] = relationship("Task")
    offer: Mapped[TaskOffer | None] = relationship("TaskOffer")


class TaskOffer(Base, TimestampMixin):
    __tablename__ = "task_offers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    task_id: Mapped[str] = mapped_column(
        String, ForeignKey("tasks.id"), unique=True, nullable=False
    )
    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), nullable=False)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    accepted_by_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    approved_by_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "open",
            "requested",
            "approved",
            "rejected",
            "withdrawn",
            "closed",
            name="task_offer_status",
        ),
        nullable=False,
        default="open",
    )
    reward_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    point_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped[Task] = relationship("Task", back_populates="offer")
    owner: Mapped[User] = relationship("User", foreign_keys=[owner_id])
    accepted_by: Mapped[User | None] = relationship("User", foreign_keys=[accepted_by_id])
    approved_by: Mapped[User | None] = relationship("User", foreign_keys=[approved_by_id])


from app.models.task import Task  # noqa: E402
from app.models.user import User  # noqa: E402
