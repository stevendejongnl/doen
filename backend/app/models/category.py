from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#a855f7")
    # Hybrid scope: either group-wide, project-specific, or both.
    group_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("groups.id"), nullable=True
    )
    project_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("projects.id"), nullable=True
    )
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="category")


from app.models.task import Task  # noqa: E402
