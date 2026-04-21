from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.questions import QuestionCreate, QuestionUpdate, QuestionResponse, RefineAnswerRequest
from app.services.questions_service import questions_service

router = APIRouter()


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    application_id: str = Query(..., description="Application ID to fetch questions for"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await questions_service.get_by_application(db, current_user.id, application_id)


@router.post("", response_model=QuestionResponse, status_code=201)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await questions_service.create(db, current_user.id, data)


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await questions_service.update(db, current_user.id, question_id, data)


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = await questions_service.delete(db, current_user.id, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")


@router.post("/{question_id}/generate", response_model=QuestionResponse)
async def generate_answer(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await questions_service.generate_answer(db, current_user.id, question_id)


@router.post("/{question_id}/refine", response_model=QuestionResponse)
async def refine_answer(
    question_id: str,
    data: RefineAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await questions_service.refine_answer(db, current_user.id, question_id, data.instruction)
