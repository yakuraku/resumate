from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.services.context_service import ContextService
from app.services.context_summarizer import ContextSummarizer
from app.schemas.context import UserContextSchema, UserContextCreate, UserContextUpdate, ContextIngestRequest

router = APIRouter()

@router.get("/", response_model=List[UserContextSchema])
async def get_all_context(category: str | None = None, db: AsyncSession = Depends(get_db)):
    service = ContextService(db)
    if category:
        return await service.get_context_by_category(category)
    return await service.get_all_context()

@router.get("/{key}", response_model=UserContextSchema)
async def get_context(key: str, db: AsyncSession = Depends(get_db)):
    service = ContextService(db)
    context = await service.get_context_by_key(key)
    if not context:
        raise HTTPException(status_code=404, detail="Context item not found")
    return context

@router.post("/", response_model=UserContextSchema)
async def create_context(context_in: UserContextCreate, db: AsyncSession = Depends(get_db)):
    service = ContextService(db)
    try:
        return await service.create_context(context_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{key}", response_model=UserContextSchema)
async def update_context(key: str, context_in: UserContextUpdate, db: AsyncSession = Depends(get_db)):
    service = ContextService(db)
    context = await service.update_context(key, context_in)
    if not context:
        raise HTTPException(status_code=404, detail="Context item not found")
    return context

@router.delete("/{key}")
async def delete_context(key: str, db: AsyncSession = Depends(get_db)):
    service = ContextService(db)
    success = await service.delete_context(key)
    if not success:
        raise HTTPException(status_code=404, detail="Context item not found")
    return {"status": "success"}

@router.post("/ingest", response_model=List[UserContextSchema])
async def ingest_context(req: ContextIngestRequest, db: AsyncSession = Depends(get_db)):
    summarizer = ContextSummarizer(db)
    try:
        results = await summarizer.summarize_and_store(req.text)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Ingest Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to ingest context")
