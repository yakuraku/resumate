from sqlalchemy import String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class UserSetting(BaseModel):
    __tablename__ = "user_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "setting_key", name="uq_user_settings_user_key"),
    )

    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    setting_key: Mapped[str] = mapped_column(String(100), nullable=False)
    setting_value: Mapped[str | None] = mapped_column(Text, nullable=True)
