from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserContextBase(BaseModel):
    key: str
    value: str
    category: str = "general"
    description: Optional[str] = None

class UserContextCreate(UserContextBase):
    pass

class UserContextUpdate(BaseModel):
    value: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

class UserContextSchema(UserContextBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ContextIngestRequest(BaseModel):
    text: str
