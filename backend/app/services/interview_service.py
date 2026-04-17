import json
from uuid import uuid4
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.interview import InterviewSession, InterviewQuestion, InterviewAnswer, InterviewType
from app.models.application import Application
from app.models.resume import Resume
from app.services.llm_service import llm_service
from app.services.prompts import (
    INTERVIEW_QUESTION_GENERATION_SYSTEM_PROMPT,
    INTERVIEW_QUESTION_GENERATION_USER_PROMPT_TEMPLATE,
)


class InterviewService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def _assert_application_owned(self, application_id: str) -> Application:
        result = await self.db.execute(
            select(Application).where(Application.id == application_id)
        )
        app = result.scalar_one_or_none()
        if app is None or app.user_id != self.user_id:
            raise HTTPException(status_code=404, detail="Application not found")
        return app

    async def _assert_session_owned(self, session_id: str) -> InterviewSession:
        result = await self.db.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=404, detail="Interview session not found")
        await self._assert_application_owned(session.application_id)
        return session

    async def create_session(self, application_id: str, interview_type: InterviewType = InterviewType.MIXED, persona: str = "Friendly Recruiter") -> InterviewSession:
        await self._assert_application_owned(application_id)
        session = InterviewSession(
            id=str(uuid4()),
            application_id=application_id,
            interview_type=interview_type,
            persona=persona,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        query = select(InterviewSession).where(InterviewSession.id == session.id).options(
            selectinload(InterviewSession.questions)
        )
        result = await self.db.execute(query)
        session = result.scalars().first()
        return session

    async def get_session(self, session_id: str) -> Optional[InterviewSession]:
        # Ownership enforced for API callers; used internally by simulator too.
        query = select(InterviewSession).where(InterviewSession.id == session_id).options(
            selectinload(InterviewSession.questions).selectinload(InterviewQuestion.answer)
        )
        result = await self.db.execute(query)
        session = result.scalars().first()
        if session is None:
            return None
        # Ownership check via application
        app_result = await self.db.execute(
            select(Application).where(Application.id == session.application_id)
        )
        app = app_result.scalar_one_or_none()
        if app is None or app.user_id != self.user_id:
            return None
        return session

    async def get_application_interviews(self, application_id: str) -> List[InterviewSession]:
        await self._assert_application_owned(application_id)
        query = select(InterviewSession).where(InterviewSession.application_id == application_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_question(self, session_id: str, question_text: str, order: int = 0) -> InterviewQuestion:
        question = InterviewQuestion(
            id=str(uuid4()),
            session_id=session_id,
            question_text=question_text,
            question_order=order,
        )
        self.db.add(question)
        await self.db.commit()
        await self.db.refresh(question)

        q_query = select(InterviewQuestion).where(InterviewQuestion.id == question.id).options(
            selectinload(InterviewQuestion.answer)
        )
        result = await self.db.execute(q_query)
        question = result.scalars().first()
        return question

    async def submit_answer(self, question_id: str, answer_text: str) -> InterviewAnswer:
        # Verify question belongs to an owned session.
        q_result = await self.db.execute(
            select(InterviewQuestion).where(InterviewQuestion.id == question_id)
        )
        question = q_result.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        await self._assert_session_owned(question.session_id)

        query = select(InterviewAnswer).where(InterviewAnswer.question_id == question_id)
        result = await self.db.execute(query)
        existing_answer = result.scalars().first()

        if existing_answer:
            existing_answer.answer_text = answer_text
            await self.db.commit()
            await self.db.refresh(existing_answer)
            return existing_answer

        answer = InterviewAnswer(
            id=str(uuid4()),
            question_id=question_id,
            answer_text=answer_text,
        )
        self.db.add(answer)
        await self.db.commit()
        await self.db.refresh(answer)
        return answer

    async def generate_questions(self, session_id: str, num_questions: int = 5) -> List[InterviewQuestion]:
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        app_query = select(Application).where(Application.id == session.application_id)
        app_result = await self.db.execute(app_query)
        application = app_result.scalars().first()
        if not application:
            raise ValueError("Application not found")

        resume_content = "No resume content available."
        resume_query = select(Resume).where(Resume.application_id == application.id)
        resume_result = await self.db.execute(resume_query)
        record_resume = resume_result.scalars().first()
        if record_resume:
            resume_content = record_resume.yaml_content

        user_prompt = INTERVIEW_QUESTION_GENERATION_USER_PROMPT_TEMPLATE.format(
            num_questions=num_questions,
            interview_type=session.interview_type,
            job_description=application.job_description or "No Job Description Provided",
            resume_content=resume_content,
        )

        messages = [
            {"role": "system", "content": INTERVIEW_QUESTION_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        response_json = await llm_service.get_completion(messages, json_mode=True)

        clean_json = response_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]

        try:
            data = json.loads(clean_json)
            questions_text = data.get("questions", [])
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}, Content: {response_json}")
            questions_text = ["Could not generate questions. Please try again."]

        questions = []
        count_query = select(func.count(InterviewQuestion.id)).where(
            InterviewQuestion.session_id == session_id
        )
        count_result = await self.db.execute(count_query)
        base_count = count_result.scalar_one()

        for idx, q_text in enumerate(questions_text):
            q = await self.add_question(session_id, q_text, order=base_count + idx + 1)
            questions.append(q)

        return questions
