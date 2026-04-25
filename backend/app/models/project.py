from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#6366f1")
    group_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("groups.id"), nullable=True
    )
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    offers_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    group: Mapped["Group | None"] = relationship("Group", back_populates="projects")
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="project", cascade="all, delete-orphan"
    )


from app.models.group import Group  # noqa: E402
from app.models.task import Task  # noqa: E402
