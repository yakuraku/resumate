import json as _json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.chat import (
    ChatCreate,
    ChatMessageRequest,
    ChatConversationFull,
    ChatConversationSummary,
)
from app.services import chat_service

router = APIRouter()


@router.get("", response_model=list[ChatConversationSummary])
async def list_conversations(
    application_id: str,
    module: str = None,
    db: AsyncSession = Depends(get_db),
):
    return await chat_service.get_conversations(db, application_id, module)


@router.post("", response_model=ChatConversationFull)
async def create_conversation(
    body: ChatCreate,
    db: AsyncSession = Depends(get_db),
):
    chat = await chat_service.create_conversation(db, body.application_id, body.module)
    return {
        "id": chat.id,
        "module": chat.module,
        "messages": chat.messages or [],
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
    }


@router.get("/{chat_id}", response_model=ChatConversationFull)
async def get_conversation(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
):
    chat = await chat_service.get_conversation(db, chat_id)
    if not chat:
        raise HTTPException(404, "Conversation not found")
    return {
        "id": chat.id,
        "module": chat.module,
        "messages": chat.messages or [],
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
    }


@router.delete("/{chat_id}")
async def delete_conversation(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
):
    await chat_service.delete_conversation(db, chat_id)
    return {"ok": True}


@router.post("/{chat_id}/message")
async def send_message(
    chat_id: str,
    body: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await chat_service.send_message(db, chat_id, body.content)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"Chat message error: {e}")
        raise HTTPException(500, detail=f"Failed to generate response: {str(e)}")


@router.post("/{chat_id}/message/stream")
async def stream_message(
    chat_id: str,
    body: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for streaming chat responses token by token."""
    try:
        gen = await chat_service.stream_message(db, chat_id, body.content)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"[Chat Stream] Setup error: {e}")
        raise HTTPException(500, detail=f"Failed to prepare stream: {str(e)}")

    async def event_generator():
        try:
            async for event in gen:
                yield f"data: {_json.dumps(event)}\n\n"
        except Exception as e:
            print(f"[Chat Stream] Generator error: {e}")
            yield f"data: {_json.dumps({'type': 'error', 'message': 'Stream interrupted'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
