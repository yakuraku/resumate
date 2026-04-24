import enum
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, Optional
from .base import BaseModel

if TYPE_CHECKING:
    from .application import Application

class VersionSource(str, enum.Enum):
    MASTER = "master"
    MANUAL_EDIT = "manual_edit"
    AI_TAILORED = "ai_tailored"

class Resume(BaseModel):
    __tablename__ = "resumes"

    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True
    )
    cloned_from_id: Mapped[str | None] = mapped_column(ForeignKey("resumes.id"))
    yaml_content: Mapped[str] = mapped_column(Text, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    application: Mapped["Application"] = relationship(back_populates="resume")
    versions: Mapped[list["ResumeVersion"]] = relationship(
        back_populates="resume", cascade="all, delete-orphan",
        order_by="ResumeVersion.version_number"
    )
    cloned_from: Mapped["Resume"] = relationship(remote_side="Resume.id", backref="clones")

class ResumeVersion(BaseModel):
    __tablename__ = "resume_versions"

    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    yaml_content: Mapped[str] = mapped_column(Text, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(50), default="manual_edit")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    label: Mapped[str | None] = mapped_column(String(100))
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pdf_rendered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    resume: Mapped["Resume"] = relationship(back_populates="versions")
