import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.application_question import ApplicationQuestion
from app.models.application import Application
from app.models.resume import Resume
from app.schemas.questions import QuestionCreate, QuestionUpdate
from app.services.llm_service import llm_service
from app.services.prompts import APPLICATION_QA_SYSTEM_PROMPT, APPLICATION_QA_USER_PROMPT_TEMPLATE, get_active_prompt
from app.services.tailor_rule_service import tailor_rule_service


class QuestionsService:

    async def get_by_application(self, db: AsyncSession, application_id: str) -> list[ApplicationQuestion]:
        stmt = select(ApplicationQuestion).where(
            ApplicationQuestion.application_id == application_id
        ).order_by(ApplicationQuestion.created_at)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, data: QuestionCreate) -> ApplicationQuestion:
        # Verify application exists
        app_result = await db.execute(select(Application).where(Application.id == data.application_id))
        if not app_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Application not found")

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

    async def update(self, db: AsyncSession, question_id: str, data: QuestionUpdate) -> ApplicationQuestion:
        result = await db.execute(
            select(ApplicationQuestion).where(ApplicationQuestion.id == question_id)
        )
        question = result.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(question, key, value)

        # If answer is manually updated, mark as not AI generated
        if "answer_text" in update_data:
            question.is_ai_generated = False

        await db.commit()
        await db.refresh(question)
        return question

    async def delete(self, db: AsyncSession, question_id: str) -> bool:
        result = await db.execute(
            select(ApplicationQuestion).where(ApplicationQuestion.id == question_id)
        )
        question = result.scalar_one_or_none()
        if not question:
            return False
        await db.delete(question)
        await db.commit()
        return True

    async def generate_answer(self, db: AsyncSession, question_id: str) -> ApplicationQuestion:
        # Load question
        q_result = await db.execute(
            select(ApplicationQuestion).where(ApplicationQuestion.id == question_id)
        )
        question = q_result.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        # Load application
        app_result = await db.execute(
            select(Application).where(Application.id == question.application_id)
        )
        application = app_result.scalar_one_or_none()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        # Load resume YAML (active version)
        resume_yaml = ""
        resume_result = await db.execute(
            select(Resume).where(Resume.application_id == application.id)
        )
        resume = resume_result.scalar_one_or_none()
        if resume:
            resume_yaml = resume.yaml_content or ""

        # Load user context from my_info files
        from app.utils.filesystem import get_project_root

        user_context = ""
        try:
            my_info_dir = get_project_root() / "my_info"
            if my_info_dir.exists():
                for file_path in sorted(my_info_dir.glob("*.md")):
                    content = file_path.read_text(encoding="utf-8")
                    user_context += f"\n--- {file_path.name} ---\n{content}\n"
        except Exception as e:
            print(f"Error loading my_info: {e}")

        # Also load from UserContext table
        from app.models.user_context import UserContext
        ctx_result = await db.execute(select(UserContext))
        for ctx in ctx_result.scalars().all():
            user_context += f"\n{ctx.key}: {ctx.value}"

        # Load active system prompt and inject rules
        active_system_prompt = await get_active_prompt(db, "qa_saved")
        rules = await tailor_rule_service.get_enabled_rule_texts(db, application_id=question.application_id)
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

    async def refine_answer(self, db: AsyncSession, question_id: str, instruction: str) -> ApplicationQuestion:
        """Refine an existing AI-generated answer according to a user instruction."""
        q_result = await db.execute(
            select(ApplicationQuestion).where(ApplicationQuestion.id == question_id)
        )
        question = q_result.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        if not question.answer_text:
            raise HTTPException(status_code=400, detail="No existing answer to refine. Generate one first.")

        refine_system_prompt = (
            "You are a professional career coach helping candidates refine their job application answers. "
            "Given an existing answer and a refinement instruction, produce an improved version of the answer. "
            "Keep the same core content and facts but apply the requested changes. "
            "Return ONLY the refined answer text — no preamble, no labels, no quotes."
        )
        rules = await tailor_rule_service.get_enabled_rule_texts(db, application_id=question.application_id)
        if rules:
            rules_text = "\n".join(f"- {r}" for r in rules)
            refine_system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

        messages = [
            {
                "role": "system",
                "content": refine_system_prompt,
            },
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
