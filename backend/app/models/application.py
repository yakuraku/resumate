from enum import Enum
from datetime import date
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import BaseModel

if TYPE_CHECKING:
    from .resume import Resume
    from .chat_history import ChatHistory
    from .interview import InterviewSession
    from .application_question import ApplicationQuestion
    from .application_credential import ApplicationCredential
    from .resume_template import ResumeTemplate

class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    REJECTED = "rejected"
    GHOSTED = "ghosted"

class Application(BaseModel):
    __tablename__ = "applications"
    
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=ApplicationStatus.DRAFT.value)
    job_description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    applied_date: Mapped[date | None] = mapped_column(Date)
    resume_template_id: Mapped[str | None] = mapped_column(
        ForeignKey("resume_templates.id", ondelete="SET NULL"), nullable=True
    )
    resume_snapshot_yaml: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    # Relationships
    resume: Mapped["Resume | None"] = relationship(
        back_populates="application", uselist=False, cascade="all, delete-orphan"
    )
    resume_template: Mapped["ResumeTemplate | None"] = relationship(
        back_populates="applications"
    )
    chat_histories: Mapped[list["ChatHistory"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    interviews: Mapped[list["InterviewSession"]] = relationship(back_populates="application", cascade="all, delete-orphan")
    questions: Mapped[list["ApplicationQuestion"]] = relationship(back_populates="application", cascade="all, delete-orphan")
    credential: Mapped["ApplicationCredential | None"] = relationship(
        back_populates="application", uselist=False, cascade="all, delete-orphan"
    )
