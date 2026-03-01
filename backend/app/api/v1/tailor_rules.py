from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.schemas.tailor_rule import TailorRuleCreate, TailorRuleUpdate, TailorRuleRead
from app.services.tailor_rule_service import tailor_rule_service

router = APIRouter()


@router.get("", response_model=List[TailorRuleRead])
async def get_tailor_rules(
    application_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    return await tailor_rule_service.get_rules(db, application_id)


@router.post("", response_model=TailorRuleRead)
async def create_tailor_rule(
    data: TailorRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    return await tailor_rule_service.create_rule(db, data)


@router.patch("/{rule_id}", response_model=TailorRuleRead)
async def update_tailor_rule(
    rule_id: str,
    data: TailorRuleUpdate,
    db: AsyncSession = Depends(get_db)
):
    return await tailor_rule_service.update_rule(db, rule_id, data)


@router.delete("/{rule_id}", status_code=204)
async def delete_tailor_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db)
):
    await tailor_rule_service.delete_rule(db, rule_id)
