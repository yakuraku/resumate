from fastapi import APIRouter
from app.api.v1 import (
    applications,
    resumes,
    interviews,
    context,
    tailor_rules,
    questions,
    settings,
    chat,
    credentials,
    resume_templates,
)

api_router = APIRouter()
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(resume_templates.router, prefix="/resume-templates", tags=["resume-templates"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
api_router.include_router(context.router, prefix="/context", tags=["context"])
api_router.include_router(tailor_rules.router, prefix="/tailor-rules", tags=["tailor-rules"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
