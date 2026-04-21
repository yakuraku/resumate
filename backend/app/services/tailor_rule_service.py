from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException

from app.models.tailor_rule import TailorRule
from app.models.application import Application
from app.schemas.tailor_rule import TailorRuleCreate, TailorRuleUpdate


class TailorRuleService:

    async def _assert_application_owned(self, db: AsyncSession, user_id: str, application_id: str) -> None:
        result = await db.execute(select(Application).where(Application.id == application_id))
        app = result.scalar_one_or_none()
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

    async def get_rules(self, db: AsyncSession, user_id: str, application_id: str | None = None) -> list[TailorRule]:
        """Global (application_id IS NULL) + app-specific rules, scoped to user."""
        stmt = select(TailorRule).where(TailorRule.user_id == user_id)
        if application_id:
            stmt = stmt.where(
                or_(TailorRule.application_id == None, TailorRule.application_id == application_id)  # noqa: E711
            )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_enabled_rule_texts(
        self, db: AsyncSession, user_id: str, application_id: str | None = None
    ) -> list[str]:
        rules = await self.get_rules(db, user_id, application_id)
        return [r.rule_text for r in rules if r.is_enabled]

    async def create_rule(self, db: AsyncSession, user_id: str, data: TailorRuleCreate) -> TailorRule:
        if data.application_id:
            await self._assert_application_owned(db, user_id, data.application_id)
        rule = TailorRule(
            user_id=user_id,
            application_id=data.application_id,
            rule_text=data.rule_text,
            is_enabled=data.is_enabled,
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        return rule

    async def update_rule(self, db: AsyncSession, user_id: str, rule_id: str, data: TailorRuleUpdate) -> TailorRule:
        rule = await db.get(TailorRule, rule_id)
        if not rule or rule.user_id != user_id:
            raise HTTPException(status_code=404, detail="Tailor rule not found")
        if data.rule_text is not None:
            rule.rule_text = data.rule_text
        if data.is_enabled is not None:
            rule.is_enabled = data.is_enabled
        await db.commit()
        await db.refresh(rule)
        return rule

    async def delete_rule(self, db: AsyncSession, user_id: str, rule_id: str) -> None:
        rule = await db.get(TailorRule, rule_id)
        if not rule or rule.user_id != user_id:
            raise HTTPException(status_code=404, detail="Tailor rule not found")
        await db.delete(rule)
        await db.commit()


tailor_rule_service = TailorRuleService()
