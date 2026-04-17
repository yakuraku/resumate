from sqlalchemy import String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import BaseModel

class UserContext(BaseModel):
    __tablename__ = "user_context"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_context_user_key"),
    )

    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
