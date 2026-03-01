from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import BaseModel

if TYPE_CHECKING:
    from .application import Application

class InterviewType(str, Enum):
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    MIXED = "mixed"

class InterviewSession(BaseModel):
    __tablename__ = "interview_sessions"

    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"), nullable=False)
    interview_type: Mapped[str] = mapped_column(String(50), default=InterviewType.MIXED.value)
    
    # Configuration for the mock interviewer
    persona: Mapped[str | None] = mapped_column(String(100), default="Friendly Recruiter")
    
    # Relationships
    application: Mapped["Application"] = relationship(back_populates="interviews")
    questions: Mapped[list["InterviewQuestion"]] = relationship(back_populates="session", cascade="all, delete-orphan")

class InterviewQuestion(BaseModel):
    __tablename__ = "interview_questions"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("interview_sessions.id"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    session: Mapped["InterviewSession"] = relationship(back_populates="questions")
    answer: Mapped["InterviewAnswer | None"] = relationship(back_populates="question", uselist=False, cascade="all, delete-orphan")

class InterviewAnswer(BaseModel):
    __tablename__ = "interview_answers"

    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("interview_questions.id"), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True) # User's answer (transcribed or typed)
    feedback_text: Mapped[str | None] = mapped_column(Text) # AI Feedback
    score: Mapped[int | None] = mapped_column(Integer) # Optional 1-10 score
    
    # Relationships
    question: Mapped["InterviewQuestion"] = relationship(back_populates="answer")
