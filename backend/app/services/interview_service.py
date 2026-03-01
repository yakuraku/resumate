import json
from uuid import uuid4
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.interview import InterviewSession, InterviewQuestion, InterviewAnswer, InterviewType
from app.models.application import Application
from app.models.resume import Resume
from app.services.llm_service import llm_service
from app.services.prompts import (
    INTERVIEW_QUESTION_GENERATION_SYSTEM_PROMPT,
    INTERVIEW_QUESTION_GENERATION_USER_PROMPT_TEMPLATE
)

class InterviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, application_id: str, interview_type: InterviewType = InterviewType.MIXED, persona: str = "Friendly Recruiter") -> InterviewSession:
        """Create a new interview session."""
        session = InterviewSession(
            id=str(uuid4()),
            application_id=application_id,
            interview_type=interview_type,
            persona=persona
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        # Reload with relationships to satisfy Pydantic
        query = select(InterviewSession).where(InterviewSession.id == session.id).options(
            selectinload(InterviewSession.questions)
        )
        result = await self.db.execute(query)
        session = result.scalars().first()
        return session

    async def get_session(self, session_id: str) -> Optional[InterviewSession]:
        """Get an interview session by ID, loading questions and answers."""
        query = select(InterviewSession).where(InterviewSession.id == session_id).options(
            selectinload(InterviewSession.questions).selectinload(InterviewQuestion.answer)
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_application_interviews(self, application_id: str) -> List[InterviewSession]:
        """Get all interviews for an application."""
        query = select(InterviewSession).where(InterviewSession.application_id == application_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_question(self, session_id: str, question_text: str, order: int = 0) -> InterviewQuestion:
        """Add a question to the session."""
        question = InterviewQuestion(
            id=str(uuid4()),
            session_id=session_id,
            question_text=question_text,
            question_order=order
        )
        self.db.add(question)
        await self.db.commit()
        await self.db.refresh(question)
        
        # Reload to satisfy Pydantic relationship access
        q_query = select(InterviewQuestion).where(InterviewQuestion.id == question.id).options(
            selectinload(InterviewQuestion.answer)
        )
        result = await self.db.execute(q_query)
        question = result.scalars().first()
        return question

    async def submit_answer(self, question_id: str, answer_text: str) -> InterviewAnswer:
        """Submit an answer for a question."""
        # check if answer already exists
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
            answer_text=answer_text
        )
        self.db.add(answer)
        await self.db.commit()
        await self.db.refresh(answer)
        return answer

    async def generate_questions(self, session_id: str, num_questions: int = 5) -> List[InterviewQuestion]:
        """Generate questions using LLM based on JD and Resume."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Get Application
        app_query = select(Application).where(Application.id == session.application_id)
        app_result = await self.db.execute(app_query)
        application = app_result.scalars().first()
        
        if not application:
            raise ValueError("Application not found")

        # Get Resume content
        resume_content = "No resume content available."
        resume_query = select(Resume).where(Resume.application_id == application.id)
        resume_result = await self.db.execute(resume_query)
        record_resume = resume_result.scalars().first()
        
        if record_resume:
             resume_content = record_resume.yaml_content
        
        # Prepare Prompt
        user_prompt = INTERVIEW_QUESTION_GENERATION_USER_PROMPT_TEMPLATE.format(
            num_questions=num_questions,
            interview_type=session.interview_type,
            job_description=application.job_description or "No Job Description Provided",
            resume_content=resume_content
        )

        messages = [
            {"role": "system", "content": INTERVIEW_QUESTION_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        # Call LLM
        response_json = await llm_service.get_completion(messages, json_mode=True)
        
        # Clean Markdown code blocks if present
        clean_json = response_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        
        # Parse JSON
        try:
            data = json.loads(clean_json)
            questions_text = data.get("questions", [])
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}, Content: {response_json}")
            # Fallback if parsing fails
            questions_text = ["Could not generate questions. Please try again."]

        questions = []
        
        # Get current count queries
        count_query = select(func.count(InterviewQuestion.id)).where(InterviewQuestion.session_id == session_id)
        count_result = await self.db.execute(count_query)
        base_count = count_result.scalar_one()

        for idx, q_text in enumerate(questions_text):
            q = await self.add_question(session_id, q_text, order=base_count + idx + 1)
            questions.append(q)
            
        return questions
