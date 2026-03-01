import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.chat_history import ChatHistory
from app.models.application import Application
from app.models.user_context import UserContext
from app.services.llm_service import LLMService
from app.services.prompts import (
    QA_CHAT_GENERATE_SYSTEM_PROMPT,
    QA_CHAT_REWRITE_SYSTEM_PROMPT,
    QA_CHAT_CONTEXT_TEMPLATE,
    get_active_prompt,
)
from app.services.tailor_rule_service import tailor_rule_service

llm_service = LLMService()


async def _load_context(application: Application, db: AsyncSession) -> str:
    """Load user context: my_info files + UserContext DB rows + resume YAML snippet."""
    from app.utils.filesystem import get_project_root

    context_parts = []

    # Load my_info/*.md files
    try:
        my_info_dir = get_project_root() / "my_info"
        if my_info_dir.exists():
            for md_file in sorted(my_info_dir.glob("*.md")):
                try:
                    content = md_file.read_text(encoding="utf-8")
                    context_parts.append(f"### {md_file.stem}\n{content}")
                except Exception:
                    pass
    except Exception as e:
        print(f"Error loading my_info: {e}")

    # Load UserContext rows
    result = await db.execute(select(UserContext))
    user_contexts = result.scalars().all()
    for uc in user_contexts:
        context_parts.append(f"### {uc.key}\n{uc.value}")

    user_context_str = "\n\n".join(context_parts) if context_parts else "No user context available."

    # Get resume YAML snippet (first 2000 chars) via the relationship
    resume_yaml = ""
    if application.resume and application.resume.yaml_content:
        resume_yaml = application.resume.yaml_content[:2000]

    return QA_CHAT_CONTEXT_TEMPLATE.format(
        role=application.role or "Unknown Role",
        company=application.company or "Unknown Company",
        job_description=(application.job_description or "")[:3000],
        user_context=user_context_str,
        resume_yaml=resume_yaml,
    )


async def get_conversations(db: AsyncSession, application_id: str, module: str = None):
    stmt = select(ChatHistory).where(ChatHistory.application_id == application_id)
    if module:
        stmt = stmt.where(ChatHistory.module == module)
    stmt = stmt.order_by(ChatHistory.updated_at.desc())
    result = await db.execute(stmt)
    histories = result.scalars().all()

    summaries = []
    for h in histories:
        messages = h.messages or []
        user_messages = [m for m in messages if m.get("role") == "user"]
        preview = user_messages[0]["content"][:60] if user_messages else "(empty)"
        summaries.append({
            "id": h.id,
            "module": h.module,
            "created_at": h.created_at,
            "updated_at": h.updated_at,
            "message_count": len(messages),
            "preview": preview,
        })
    return summaries


async def get_conversation(db: AsyncSession, chat_id: str):
    result = await db.execute(select(ChatHistory).where(ChatHistory.id == chat_id))
    return result.scalar_one_or_none()


async def create_conversation(db: AsyncSession, application_id: str, module: str):
    chat = ChatHistory(
        id=str(uuid.uuid4()),
        application_id=application_id,
        module=module,
        messages=[],
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def delete_conversation(db: AsyncSession, chat_id: str):
    result = await db.execute(select(ChatHistory).where(ChatHistory.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat:
        await db.delete(chat)
        await db.commit()


async def send_message(db: AsyncSession, chat_id: str, user_content: str):
    # Load conversation
    result = await db.execute(
        select(ChatHistory).where(ChatHistory.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise ValueError(f"Conversation {chat_id} not found")

    # Load application — eagerly load resume via selectinload to avoid lazy load issues
    from sqlalchemy.orm import selectinload
    app_result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume))
        .where(Application.id == chat.application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise ValueError("Application not found")

    # Load context
    context = await _load_context(application, db)

    # Choose system prompt (use custom if set, otherwise default)
    if chat.module == "qa_generate":
        base_prompt = await get_active_prompt(db, "qa_generate")
    else:
        base_prompt = await get_active_prompt(db, "qa_rewrite")
    system_prompt = base_prompt + "\n\n" + context

    # Inject global + app-specific rules
    rules = await tailor_rule_service.get_enabled_rule_texts(db, application_id=application.id)
    if rules:
        rules_text = "\n".join(f"- {r}" for r in rules)
        system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

    # Build messages for LLM
    messages = chat.messages or []
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(messages)
    llm_messages.append({"role": "user", "content": user_content})

    # Call LLM
    assistant_content = await llm_service.get_completion(
        messages=llm_messages,
        temperature=0.6,
        max_tokens=1000,
    )

    # Update messages
    new_messages = list(messages)
    new_messages.append({"role": "user", "content": user_content})
    new_messages.append({"role": "assistant", "content": assistant_content})

    chat.messages = new_messages
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)

    return {"role": "assistant", "content": assistant_content}
