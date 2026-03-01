from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException

from app.models.tailor_rule import TailorRule
from app.schemas.tailor_rule import TailorRuleCreate, TailorRuleUpdate


class TailorRuleService:

    async def get_rules(self, db: AsyncSession, application_id: str | None = None) -> list[TailorRule]:
        """Get all rules: global (application_id=None) + app-specific if application_id provided."""
        if application_id:
            stmt = select(TailorRule).where(
                or_(TailorRule.application_id == None, TailorRule.application_id == application_id)
            )
        else:
            stmt = select(TailorRule)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_enabled_rule_texts(self, db: AsyncSession, application_id: str | None = None) -> list[str]:
        """Get enabled rule texts for prompt injection."""
        rules = await self.get_rules(db, application_id)
        return [r.rule_text for r in rules if r.is_enabled]

    async def create_rule(self, db: AsyncSession, data: TailorRuleCreate) -> TailorRule:
        rule = TailorRule(
            application_id=data.application_id,
            rule_text=data.rule_text,
            is_enabled=data.is_enabled,
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        return rule

    async def update_rule(self, db: AsyncSession, rule_id: str, data: TailorRuleUpdate) -> TailorRule:
        rule = await db.get(TailorRule, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Tailor rule not found")
        if data.rule_text is not None:
            rule.rule_text = data.rule_text
        if data.is_enabled is not None:
            rule.is_enabled = data.is_enabled
        await db.commit()
        await db.refresh(rule)
        return rule

    async def delete_rule(self, db: AsyncSession, rule_id: str) -> None:
        rule = await db.get(TailorRule, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Tailor rule not found")
        await db.delete(rule)
        await db.commit()


tailor_rule_service = TailorRuleService()
