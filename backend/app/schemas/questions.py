from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class QuestionCreate(BaseModel):
    application_id: str
    question_text: str
    answer_text: Optional[str] = None


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    answer_text: Optional[str] = None


class RefineAnswerRequest(BaseModel):
    instruction: str


class QuestionResponse(BaseModel):
    id: str
    application_id: str
    question_text: str
    answer_text: Optional[str] = None
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
