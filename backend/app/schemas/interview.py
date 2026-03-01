from pydantic import BaseModel
from typing import List, Optional
from app.models.interview import InterviewType

class InterviewAnswerSchema(BaseModel):
    id: str
    question_id: str
    answer_text: Optional[str] = None
    feedback_text: Optional[str] = None
    score: Optional[int] = None

    class Config:
        from_attributes = True

class InterviewQuestionSchema(BaseModel):
    id: str
    session_id: str
    question_text: str
    question_order: int
    answer: Optional[InterviewAnswerSchema] = None

    class Config:
        from_attributes = True

class InterviewSessionSchema(BaseModel):
    id: str
    application_id: str
    interview_type: str
    persona: Optional[str]
    questions: List[InterviewQuestionSchema] = []

    class Config:
        from_attributes = True

class InterviewCreate(BaseModel):
    application_id: str
    interview_type: str = "mixed"
    persona: str = "Friendly Recruiter"

class AnswerSubmit(BaseModel):
    answer_text: str

class GenerateQuestionsRequest(BaseModel):
    num_questions: int = 5
