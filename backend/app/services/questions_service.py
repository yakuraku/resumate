from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.application_question import ApplicationQuestion
from app.models.application import Application
from app.models.resume import Resume
from app.schemas.questions import QuestionCreate, QuestionUpdate
from app.services.llm_service import llm_service
from app.services.prompts import APPLICATION_QA_USER_PROMPT_TEMPLATE, REFINE_ANSWER_SYSTEM_PROMPT, get_active_prompt
from app.services.tailor_rule_service import tailor_rule_service
from app.services import text_storage_service


class QuestionsService:

    async def _assert_application_owned(self, db: AsyncSession, user_id: str, application_id: str) -> Application:
        result = await db.execute(select(Application).where(Application.id == application_id))
        app = result.scalar_one_or_none()
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")
        return app

    async def _load_question_owned(
        self, db: AsyncSession, user_id: str, question_id: str
    ) -> tuple[ApplicationQuestion, Application]:
        q_result = await db.execute(
            select(ApplicationQuestion).where(ApplicationQuestion.id == question_id)
        )
        question = q_result.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        application = await self._assert_application_owned(db, user_id, question.application_id)
        return question, application

    async def get_by_application(
        self, db: AsyncSession, user_id: str, application_id: str
    ) -> list[ApplicationQuestion]:
        await self._assert_application_owned(db, user_id, application_id)
        stmt = select(ApplicationQuestion).where(
            ApplicationQuestion.application_id == application_id
        ).order_by(ApplicationQuestion.created_at)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, user_id: str, data: QuestionCreate) -> ApplicationQuestion:
        await self._assert_application_owned(db, user_id, data.application_id)

        question = ApplicationQuestion(
            application_id=data.application_id,
            question_text=data.question_text,
            answer_text=data.answer_text,
            is_ai_generated=False,
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)
        return question

    async def update(
        self, db: AsyncSession, user_id: str, question_id: str, data: QuestionUpdate
    ) -> ApplicationQuestion:
        question, _ = await self._load_question_owned(db, user_id, question_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(question, key, value)
        if "answer_text" in update_data:
            question.is_ai_generated = False

        await db.commit()
        await db.refresh(question)
        return question

    async def delete(self, db: AsyncSession, user_id: str, question_id: str) -> bool:
        try:
            question, _ = await self._load_question_owned(db, user_id, question_id)
        except HTTPException:
            return False
        await db.delete(question)
        await db.commit()
        return True

    async def generate_answer(
        self, db: AsyncSession, user_id: str, question_id: str
    ) -> ApplicationQuestion:
        question, application = await self._load_question_owned(db, user_id, question_id)

        resume_yaml = ""
        resume_result = await db.execute(
            select(Resume).where(Resume.application_id == application.id)
        )
        resume = resume_result.scalar_one_or_none()
        if resume:
            resume_yaml = resume.yaml_content or ""

        context_parts = []
        try:
            rows = await text_storage_service.list_context_files(db, user_id)
            for row in rows:
                stem = row.filename.rsplit(".", 1)[0]
                full = await text_storage_service.get_context_file(db, user_id, row.filename)
                if full:
                    context_parts.append(f"### {stem}\n{full.content}")
        except Exception as e:
            print(f"Error loading context files: {e}")

        user_context = "\n\n".join(context_parts) if context_parts else ""

        active_system_prompt = await get_active_prompt(db, user_id, "qa_saved")
        rules = await tailor_rule_service.get_enabled_rule_texts(
            db, user_id, application_id=question.application_id
        )
        if rules:
            rules_text = "\n".join(f"- {r}" for r in rules)
            active_system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

        messages = [
            {"role": "system", "content": active_system_prompt},
            {
                "role": "user",
                "content": APPLICATION_QA_USER_PROMPT_TEMPLATE.format(
                    question_text=question.question_text,
                    role=application.role,
                    company=application.company,
                    job_description=application.job_description or "Not provided",
                    user_context=user_context or "No context available",
                    resume_yaml=llm_service.truncate_text(resume_yaml, 2000),
                ),
            },
        ]

        answer_text = await llm_service.get_completion(
            messages=messages,
            temperature=0.6,
            max_tokens=1000,
            json_mode=False,
        )

        question.answer_text = answer_text.strip()
        question.is_ai_generated = True
        await db.commit()
        await db.refresh(question)
        return question

    async def refine_answer(
        self, db: AsyncSession, user_id: str, question_id: str, instruction: str
    ) -> ApplicationQuestion:
        question, _ = await self._load_question_owned(db, user_id, question_id)

        if not question.answer_text:
            raise HTTPException(status_code=400, detail="No existing answer to refine. Generate one first.")

        refine_system_prompt = REFINE_ANSWER_SYSTEM_PROMPT
        rules = await tailor_rule_service.get_enabled_rule_texts(
            db, user_id, application_id=question.application_id
        )
        if rules:
            rules_text = "\n".join(f"- {r}" for r in rules)
            refine_system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

        messages = [
            {"role": "system", "content": refine_system_prompt},
            {
                "role": "user",
                "content": (
                    f"Question: {question.question_text}\n\n"
                    f"Current answer:\n{question.answer_text}\n\n"
                    f"Refinement instruction: {instruction}\n\n"
                    "Please refine the answer accordingly."
                ),
            },
        ]

        refined_text = await llm_service.get_completion(
            messages=messages,
            temperature=0.5,
            max_tokens=1000,
            json_mode=False,
        )

        question.answer_text = refined_text.strip()
        question.is_ai_generated = True
        await db.commit()
        await db.refresh(question)
        return question


questions_service = QuestionsService()
