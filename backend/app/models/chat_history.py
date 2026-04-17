from sqlalchemy import String, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import BaseModel

if TYPE_CHECKING:
    from .application import Application

class ChatHistory(BaseModel):
    __tablename__ = "chat_histories"

    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    module: Mapped[str] = mapped_column(String(50), nullable=False)  # drafting, editor, interview
    messages: Mapped[list] = mapped_column(JSON, default=list)
    context_summary: Mapped[str | None] = mapped_column(Text)
    
    # Relationships
    application: Mapped["Application"] = relationship(back_populates="chat_histories")
