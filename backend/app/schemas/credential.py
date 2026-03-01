from pydantic import BaseModel as PydanticBase, ConfigDict
from typing import Optional
from datetime import datetime


class CredentialCreate(PydanticBase):
    application_id: str
    auth_method: str
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    oauth_email: Optional[str] = None
    notes: Optional[str] = None


class CredentialUpdate(PydanticBase):
    auth_method: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    oauth_email: Optional[str] = None
    notes: Optional[str] = None


class CredentialResponse(PydanticBase):
    id: str
    application_id: str
    auth_method: str
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    oauth_email: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
