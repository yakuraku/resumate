from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.questions import QuestionCreate, QuestionUpdate, QuestionResponse, RefineAnswerRequest
from app.services.questions_service import questions_service

router = APIRouter()


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    application_id: str = Query(..., description="Application ID to fetch questions for"),
    db: AsyncSession = Depends(get_db),
):
    return await questions_service.get_by_application(db, application_id)


@router.post("", response_model=QuestionResponse, status_code=201)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    return await questions_service.create(db, data)


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await questions_service.update(db, question_id, data)


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    success = await questions_service.delete(db, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")


@router.post("/{question_id}/generate", response_model=QuestionResponse)
async def generate_answer(
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-generate an answer for this question using the application's context."""
    return await questions_service.generate_answer(db, question_id)


@router.post("/{question_id}/refine", response_model=QuestionResponse)
async def refine_answer(
    question_id: str,
    data: RefineAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refine an existing AI-generated answer according to a user instruction."""
    return await questions_service.refine_answer(db, question_id, data.instruction)
