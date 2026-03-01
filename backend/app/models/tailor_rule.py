from sqlalchemy import String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import BaseModel


class TailorRule(BaseModel):
    __tablename__ = "tailor_rules"

    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    application_id: Mapped[str | None] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=True
    )
    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    application = relationship("Application", backref="tailor_rules")
