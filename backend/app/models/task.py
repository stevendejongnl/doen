from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid, utcnow


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    category_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("categories.id"), nullable=True
    )
    assignee_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum("todo", "in_progress", "done", name="task_status"),
        nullable=False,
        default="todo",
    )
    priority: Mapped[str] = mapped_column(
        Enum("none", "low", "medium", "high", name="task_priority"),
        nullable=False,
        default="none",
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    category: Mapped["Category | None"] = relationship("Category", back_populates="tasks")
    assignee: Mapped["User | None"] = relationship(
        "User", back_populates="assigned_tasks", foreign_keys=[assignee_id]
    )
    labels: Mapped[list["TaskLabel"]] = relationship(
        "TaskLabel", back_populates="task", cascade="all, delete-orphan"
    )
    recurring_rule: Mapped["RecurringRule | None"] = relationship(
        "RecurringRule", back_populates="template_task", uselist=False, cascade="all, delete-orphan"
    )
    offer: Mapped["TaskOffer | None"] = relationship(
        "TaskOffer", back_populates="task", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def assignee_name(self) -> str | None:
        return self.assignee.name if self.assignee else None

    @property
    def category_name(self) -> str | None:
        return self.category.name if self.category else None

    @property
    def category_color(self) -> str | None:
        return self.category.color if self.category else None

    @property
    def point_value(self) -> int:
        return {
            "none": 1,
            "low": 2,
            "medium": 3,
            "high": 5,
        }[self.priority]


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#94a3b8")
    group_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("groups.id"), nullable=True
    )

    task_labels: Mapped[list["TaskLabel"]] = relationship("TaskLabel", back_populates="label")


class TaskLabel(Base):
    __tablename__ = "task_labels"

    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), primary_key=True)
    label_id: Mapped[str] = mapped_column(String, ForeignKey("labels.id"), primary_key=True)

    task: Mapped["Task"] = relationship("Task", back_populates="labels")
    label: Mapped["Label"] = relationship("Label", back_populates="task_labels")


class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    template_task_id: Mapped[str] = mapped_column(
        String, ForeignKey("tasks.id"), unique=True, nullable=False
    )
    unit: Mapped[str] = mapped_column(
        Enum("day", "week", "month", name="recurring_unit"),
        nullable=False,
        default="week",
    )
    interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # CSV of weekdays (0=Mon..6=Sun) — only meaningful when unit='week'
    weekdays: Mapped[str | None] = mapped_column(String, nullable=True)
    # Day of month (1-31) — only meaningful when unit='month'
    month_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_of_day: Mapped[str] = mapped_column(String, nullable=False, default="08:00")
    # Overlay filter: only fire when the week/day number matches parity
    parity: Mapped[str] = mapped_column(
        Enum("any", "odd", "even", name="recurring_parity"),
        nullable=False,
        default="any",
    )
    # Anchor for interval math (e.g. every 2 weeks from here)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    last_spawned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notify_on_spawn: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    template_task: Mapped["Task"] = relationship("Task", back_populates="recurring_rule")


from app.models.category import Category  # noqa: E402
from app.models.household_points import TaskOffer  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.user import User  # noqa: E402
