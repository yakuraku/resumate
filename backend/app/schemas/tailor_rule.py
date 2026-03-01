from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TailorRuleCreate(BaseModel):
    application_id: Optional[str] = None  # None = global rule
    rule_text: str
    is_enabled: bool = True


class TailorRuleUpdate(BaseModel):
    rule_text: Optional[str] = None
    is_enabled: Optional[bool] = None


class TailorRuleRead(BaseModel):
    id: str
    user_id: Optional[str] = None
    application_id: Optional[str] = None
    rule_text: str
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
