from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Shared properties
class ResumeBase(BaseModel):
    yaml_content: str

# Properties to receive via API on creation
class ResumeCreateRequest(BaseModel):
    clone_from_id: Optional[str] = None

class ResumeCreate(BaseModel):
    application_id: str
    clone_from_id: Optional[str] = None
    yaml_content: Optional[str] = None  # If not provided, will use master or clone

# Properties to receive via API on update
class ResumeUpdate(ResumeBase):
    change_summary: Optional[str] = None  # To describe the update for versioning

# For saving a version explicitly
class ResumeVersionCreate(BaseModel):
    change_summary: Optional[str] = "Manual save"

# Properties to return to client
class ResumeVersionRead(BaseModel):
    id: str
    resume_id: str
    version_number: int
    yaml_content: str
    change_summary: Optional[str] = None
    source: str = "manual_edit"
    is_active: bool = False
    label: Optional[str] = None
    pdf_path: Optional[str] = None
    pdf_rendered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ResumeRead(ResumeBase):
    id: str
    application_id: str
    cloned_from_id: Optional[str] = None
    current_version: int
    created_at: datetime
    updated_at: datetime
    versions: Optional[List[ResumeVersionRead]] = []

    class Config:
        from_attributes = True
