from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.interview_service import InterviewService
from app.services.interview_simulator import InterviewSimulator
from app.schemas.interview import (
    InterviewSessionSchema,
    InterviewCreate,
    AnswerSubmit,
    GenerateQuestionsRequest,
    InterviewQuestionSchema,
    InterviewAnswerSchema,
)
from app.models.interview import InterviewType

router = APIRouter()


@router.post("/", response_model=InterviewSessionSchema)
async def create_session(
    session_in: InterviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InterviewService(db, current_user.id)
    try:
        itype = InterviewType(session_in.interview_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid interview type. Must be one of: {[t.value for t in InterviewType]}")

    return await service.create_session(
        application_id=session_in.application_id,
        interview_type=itype,
        persona=session_in.persona,
    )


@router.get("/{session_id}", response_model=InterviewSessionSchema)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InterviewService(db, current_user.id)
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session


@router.get("/application/{application_id}", response_model=List[InterviewSessionSchema])
async def get_application_interviews(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InterviewService(db, current_user.id)
    return await service.get_application_interviews(application_id)


@router.post("/{session_id}/generate", response_model=List[InterviewQuestionSchema])
async def generate_questions(
    session_id: str,
    req: GenerateQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InterviewService(db, current_user.id)
    try:
        questions = await service.generate_questions(session_id, num_questions=req.num_questions)
        return questions
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate questions")


@router.post("/questions/{question_id}/answer", response_model=InterviewAnswerSchema)
async def submit_answer(
    question_id: str,
    answer_in: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InterviewService(db, current_user.id)
    simulator = InterviewSimulator(db, current_user.id)
    try:
        answer = await service.submit_answer(question_id, answer_in.answer_text)
        sim_result = await simulator.process_answer(answer.id)
        return sim_result["answer"]
    except Exception as e:
        print(f"Error in submit_answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))
