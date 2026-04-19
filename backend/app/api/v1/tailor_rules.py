from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.tailor_rule import TailorRuleCreate, TailorRuleUpdate, TailorRuleRead
from app.services.tailor_rule_service import tailor_rule_service

router = APIRouter()


@router.get("", response_model=List[TailorRuleRead])
async def get_tailor_rules(
    application_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await tailor_rule_service.get_rules(db, current_user.id, application_id)


@router.post("", response_model=TailorRuleRead)
async def create_tailor_rule(
    data: TailorRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await tailor_rule_service.create_rule(db, current_user.id, data)


@router.patch("/{rule_id}", response_model=TailorRuleRead)
async def update_tailor_rule(
    rule_id: str,
    data: TailorRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await tailor_rule_service.update_rule(db, current_user.id, rule_id, data)


@router.delete("/{rule_id}", status_code=204)
async def delete_tailor_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await tailor_rule_service.delete_rule(db, current_user.id, rule_id)
