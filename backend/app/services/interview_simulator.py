
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.interview import InterviewSession, InterviewQuestion, InterviewAnswer
from app.models.application import Application
from app.models.resume import Resume
from app.services.llm_service import llm_service
from app.services.prompts import (
    INTERVIEW_SIMULATION_SYSTEM_PROMPT,
    INTERVIEW_SIMULATION_USER_PROMPT_TEMPLATE
)
from app.services.interview_service import InterviewService

class InterviewSimulator:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self.interview_service = InterviewService(db, user_id)

    async def process_answer(self, answer_id: str):
        """
        Process a submitted answer:
        1. Analyze with LLM.
        2. Update Answer with Feedback/score.
        3. Generate and insert next question (Follow-up).
        """
        # 1. Fetch Context
        # Get the specific answer
        query = select(InterviewAnswer).where(InterviewAnswer.id == answer_id)
        result = await self.db.execute(query)
        answer = result.scalars().first()
        
        if not answer:
            raise ValueError("Answer not found")
            
        # Get the question for this answer
        q_query = select(InterviewQuestion).where(InterviewQuestion.id == answer.question_id)
        q_result = await self.db.execute(q_query)
        question = q_result.scalars().first()
        
        if not question:
            raise ValueError("Question not found")
            
        session_id = question.session_id
        session = await self.interview_service.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        # Get Application and Job Description
        app_query = select(Application).where(Application.id == session.application_id)
        app_result = await self.db.execute(app_query)
        application = app_result.scalars().first()
        
        jd_text = application.job_description if application and application.job_description else "N/A"
        company_name = application.company if application and application.company else "Unknown Company"
        job_title = application.role if application and application.role else "Candidate"
        
        # Get Resume
        resume_query = select(Resume).where(Resume.application_id == session.application_id)
        resume_result = await self.db.execute(resume_query)
        resume = resume_result.scalars().first()
        resume_snippet = resume.yaml_content[:2000] if resume else "No Resume" # Truncate for prompt context limits if needed

        # 2. Prepare Prompt
        user_prompt = INTERVIEW_SIMULATION_USER_PROMPT_TEMPLATE.format(
            persona=session.persona or "Interviewer",
            interview_type=session.interview_type,
            job_title=job_title,
            company=company_name,
            job_description_snippet=jd_text[:1500],
            resume_snippet=resume_snippet,
            question_text=question.question_text,
            answer_text=answer.answer_text
        )

        messages = [
            {"role": "system", "content": INTERVIEW_SIMULATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        # 3. Call LLM
        response_json = await llm_service.get_completion(messages, json_mode=True)
        
        # Clean Clean JSON
        clean_json = response_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
            
        try:
            data = json.loads(clean_json)
        except json.JSONDecodeError:
            print(f"Failed to parse Simulator response: {response_json}")
            data = {
                "feedback": "Improper response from AI.",
                "score": 0,
                "next_question": "Could you elaborate on that?",
                "is_follow_up": True
            }

        # 4. Update Answer with Feedback
        answer.feedback_text = data.get("feedback", "")
        answer.score = data.get("score", 0)
        self.db.add(answer)
        await self.db.commit() # Commit feedback

        # 5. Handle Next Question
        next_q_text = data.get("next_question")
        
        if next_q_text and next_q_text != "END_INTERVIEW":
            # If it's a follow-up, we want to insert it IMMEDIATELY after this question.
            
            current_order = question.question_order
            
            # Shift all subsequent questions down by 1
            update_stmt = (
                update(InterviewQuestion)
                .where(InterviewQuestion.session_id == session_id)
                .where(InterviewQuestion.question_order > current_order)
                .values(question_order=InterviewQuestion.question_order + 1)
            )
            await self.db.execute(update_stmt)
            await self.db.commit()
            
            # Add new question at current_order + 1
            new_q = await self.interview_service.add_question(
                session_id=session_id,
                question_text=next_q_text,
                order=current_order + 1
            )
            
            return {
                "answer": answer,
                "next_question": new_q,
                "simulation_data": data
            }
            
        return {
            "answer": answer,
            "next_question": None,
            "simulation_data": data
        }
