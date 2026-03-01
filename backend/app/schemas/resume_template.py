from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ResumeTemplateCreate(BaseModel):
    name: str
    yaml_content: Optional[str] = None  # If None, will clone from master


class ResumeTemplateUpdate(BaseModel):
    name: Optional[str] = None
    yaml_content: Optional[str] = None
    is_starred: Optional[bool] = None


class ResumeTemplateYamlUpdate(BaseModel):
    yaml_content: str


class LinkedApplicationSummary(BaseModel):
    id: str
    job_title: str
    company: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class ResumeTemplateResponse(BaseModel):
    id: str
    name: str
    yaml_content: str
    is_master: bool
    is_starred: bool
    created_at: datetime
    updated_at: datetime
    linked_application_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ResumeTemplateDetailResponse(ResumeTemplateResponse):
    linked_applications: list[LinkedApplicationSummary] = []


class ApplicationStatusUpdate(BaseModel):
    status: str


class ApplicationResumeTemplateUpdate(BaseModel):
    resume_template_id: Optional[str] = None
