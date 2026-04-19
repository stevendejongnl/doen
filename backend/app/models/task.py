from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
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
    assignee: Mapped["User | None"] = relationship(
        "User", back_populates="assigned_tasks", foreign_keys=[assignee_id]
    )
    labels: Mapped[list["TaskLabel"]] = relationship(
        "TaskLabel", back_populates="task", cascade="all, delete-orphan"
    )
    recurring_rule: Mapped["RecurringRule | None"] = relationship(
        "RecurringRule", back_populates="template_task", uselist=False, cascade="all, delete-orphan"
    )


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
    schedule_cron: Mapped[str] = mapped_column(String, nullable=False)
    last_spawned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notify_on_spawn: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    template_task: Mapped["Task"] = relationship("Task", back_populates="recurring_rule")


from app.models.project import Project  # noqa: E402
from app.models.user import User  # noqa: E402
