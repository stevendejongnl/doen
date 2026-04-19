from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ha_user_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)

    credential: Mapped["LocalCredential | None"] = relationship(
        "LocalCredential", back_populates="user", uselist=False
    )
    group_memberships: Mapped[list["GroupMember"]] = relationship(
        "GroupMember", back_populates="user"
    )
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="assignee", foreign_keys="Task.assignee_id"
    )


class LocalCredential(Base):
    __tablename__ = "local_credentials"

    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="credential")


# Avoid circular imports — imported where needed
from app.models.group import GroupMember  # noqa: E402
from app.models.task import Task  # noqa: E402
