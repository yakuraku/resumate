from sqlalchemy import String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class MasterResume(BaseModel):
    __tablename__ = "master_resumes"
    __table_args__ = (UniqueConstraint("user_id", name="uq_master_resumes_user_id"),)

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    yaml_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
