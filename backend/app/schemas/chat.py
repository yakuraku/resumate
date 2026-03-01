from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ChatCreate(BaseModel):
    application_id: str
    module: str  # "qa_generate" or "qa_rewrite"


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    role: str
    content: str


class ChatConversationSummary(BaseModel):
    id: str
    module: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    preview: str


class ChatConversationFull(BaseModel):
    id: str
    module: str
    messages: list
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
