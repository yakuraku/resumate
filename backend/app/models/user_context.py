from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import BaseModel

class UserContext(BaseModel):
    __tablename__ = "user_context"

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
