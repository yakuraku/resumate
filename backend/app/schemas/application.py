import re
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime
from typing import Optional
from enum import Enum

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    APPLIED = "applied"
    SCREENING = "screening"
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
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _HEX_COLOR_RE.match(v):
            raise ValueError("color must be a valid 6-digit hex color string (e.g. #A1B2C3)")
        return v

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
    color: Optional[str] = None
    ghost_disabled: Optional[bool] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _HEX_COLOR_RE.match(v):
            raise ValueError("color must be a valid 6-digit hex color string (e.g. #A1B2C3)")
        return v


class ColorUpdate(BaseModel):
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _HEX_COLOR_RE.match(v):
            raise ValueError("color must be a valid 6-digit hex color string (e.g. #A1B2C3)")
        return v

class ApplicationResponse(ApplicationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    resume_template_id: Optional[str] = None
    resume_snapshot_yaml: Optional[str] = None
    status_changed_at: Optional[datetime] = None
    ghosted_at: Optional[datetime] = None
    ghost_disabled: bool = False

    model_config = ConfigDict(from_attributes=True)

class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    total: int
    page: int
    page_size: int

class ApplicationDeleteResponse(BaseModel):
    """Returned after a successful application deletion."""
    saved_template_name: Optional[str] = None
    """Name of the ResumeTemplate that was saved from the tailored resume, or None."""
