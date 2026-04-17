from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import BaseModel

if TYPE_CHECKING:
    from .application import Application


class ResumeTemplate(BaseModel):
    __tablename__ = "resume_templates"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_resume_templates_user_name"),
    )

    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    yaml_content: Mapped[str] = mapped_column(Text, nullable=False)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    applications: Mapped[list["Application"]] = relationship(
        back_populates="resume_template"
    )
