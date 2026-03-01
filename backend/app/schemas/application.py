from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional
from enum import Enum

class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    REJECTED = "rejected"
    GHOSTED = "ghosted"

class ApplicationBase(BaseModel):
    company: str
    role: str
    status: ApplicationStatus = ApplicationStatus.DRAFT
    job_description: Optional[str] = None
    location: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    applied_date: Optional[date] = None

class ApplicationCreate(ApplicationBase):
    pass

class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    job_description: Optional[str] = None
    location: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    applied_date: Optional[date] = None

class ApplicationResponse(ApplicationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    resume_template_id: Optional[str] = None
    resume_snapshot_yaml: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    total: int
    page: int
    page_size: int
