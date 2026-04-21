import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.chat_history import ChatHistory
from app.models.application import Application
from app.services.llm_service import LLMService
from app.services.prompts import (
    QA_CHAT_GENERATE_SYSTEM_PROMPT,
    QA_CHAT_REWRITE_SYSTEM_PROMPT,
    QA_CHAT_CONTEXT_TEMPLATE,
    get_active_prompt,
)
from app.services.tailor_rule_service import tailor_rule_service

llm_service = LLMService()


async def _load_context(application: Application, db: AsyncSession, user_id: str) -> str:
    """Load user context: user-scoped context files + resume YAML snippet."""
    from app.services import text_storage_service

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

    user_context_str = "\n\n".join(context_parts) if context_parts else "No user context available."

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


async def _assert_application_owned(db: AsyncSession, application_id: str, user_id: str) -> Application:
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if app is None or app.user_id != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Application not found")
    return app


async def get_conversations(db: AsyncSession, user_id: str, application_id: str, module: str = None):
    await _assert_application_owned(db, application_id, user_id)
    stmt = select(ChatHistory).where(
        ChatHistory.application_id == application_id,
        ChatHistory.user_id == user_id,
    )
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


async def get_conversation(db: AsyncSession, user_id: str, chat_id: str):
    result = await db.execute(select(ChatHistory).where(ChatHistory.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat is None or chat.user_id != user_id:
        return None
    return chat


async def create_conversation(db: AsyncSession, user_id: str, application_id: str, module: str):
    await _assert_application_owned(db, application_id, user_id)
    chat = ChatHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        application_id=application_id,
        module=module,
        messages=[],
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def delete_conversation(db: AsyncSession, user_id: str, chat_id: str):
    result = await db.execute(select(ChatHistory).where(ChatHistory.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat and chat.user_id == user_id:
        await db.delete(chat)
        await db.commit()


async def send_message(db: AsyncSession, user_id: str, chat_id: str, user_content: str):
    result = await db.execute(
        select(ChatHistory).where(ChatHistory.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat or chat.user_id != user_id:
        raise ValueError(f"Conversation {chat_id} not found")

    from sqlalchemy.orm import selectinload
    app_result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume))
        .where(Application.id == chat.application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application or application.user_id != user_id:
        raise ValueError("Application not found")

    context = await _load_context(application, db, user_id)

    if chat.module == "qa_generate":
        base_prompt = await get_active_prompt(db, user_id, "qa_generate")
    else:
        base_prompt = await get_active_prompt(db, user_id, "qa_rewrite")
    system_prompt = base_prompt + "\n\n" + context

    rules = await tailor_rule_service.get_enabled_rule_texts(db, user_id, application_id=application.id)
    if rules:
        rules_text = "\n".join(f"- {r}" for r in rules)
        system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

    messages = chat.messages or []
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(messages)
    llm_messages.append({"role": "user", "content": user_content})

    assistant_content = await llm_service.get_completion(
        messages=llm_messages,
        temperature=0.6,
        max_tokens=1000,
    )

    new_messages = list(messages)
    new_messages.append({"role": "user", "content": user_content})
    new_messages.append({"role": "assistant", "content": assistant_content})

    chat.messages = new_messages
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)

    return {"role": "assistant", "content": assistant_content}


async def stream_message(
    db: AsyncSession, user_id: str, chat_id: str, user_content: str
) -> AsyncGenerator[dict, None]:
    from sqlalchemy.orm import selectinload
    from app.database import SessionLocal

    result = await db.execute(select(ChatHistory).where(ChatHistory.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat or chat.user_id != user_id:
        raise ValueError(f"Conversation {chat_id} not found")

    app_result = await db.execute(
        select(Application)
        .options(selectinload(Application.resume))
        .where(Application.id == chat.application_id)
    )
    application = app_result.scalar_one_or_none()
    if not application or application.user_id != user_id:
        raise ValueError("Application not found")

    context = await _load_context(application, db, user_id)

    if chat.module == "qa_generate":
        base_prompt = await get_active_prompt(db, user_id, "qa_generate")
    else:
        base_prompt = await get_active_prompt(db, user_id, "qa_rewrite")
    system_prompt = base_prompt + "\n\n" + context

    rules = await tailor_rule_service.get_enabled_rule_texts(db, user_id, application_id=application.id)
    if rules:
        rules_text = "\n".join(f"- {r}" for r in rules)
        system_prompt += f"\n\n## IMPORTANT RULES (You MUST follow these strictly):\n{rules_text}"

    existing_messages = list(chat.messages or [])
    chat_id_str = str(chat.id)

    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(existing_messages)
    llm_messages.append({"role": "user", "content": user_content})

    async def _generator() -> AsyncGenerator[dict, None]:
        collected: list[str] = []
        try:
            async for chunk in llm_service.stream_completion(
                messages=llm_messages, temperature=0.6
            ):
                if chunk:
                    collected.append(chunk)
                    yield {"type": "delta", "content": chunk}
        except Exception as e:
            yield {"type": "error", "message": str(e)}
            return

        assistant_content = "".join(collected).strip()
        if not assistant_content:
            yield {"type": "error", "message": "The model returned an empty response."}
            return

        try:
            async with SessionLocal() as new_db:
                r = await new_db.execute(
                    select(ChatHistory).where(ChatHistory.id == chat_id_str)
                )
                chat_row = r.scalar_one_or_none()
                if chat_row:
                    new_msgs = list(chat_row.messages or [])
                    new_msgs.append({"role": "user", "content": user_content})
                    new_msgs.append({"role": "assistant", "content": assistant_content})
                    chat_row.messages = new_msgs
                    chat_row.updated_at = datetime.now(timezone.utc)
                    await new_db.commit()
        except Exception as e:
            print(f"[Chat Stream] Failed to persist messages for {chat_id_str}: {e}")

        yield {"type": "done"}

    return _generator()
