from uuid import uuid4
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.models.user_context import UserContext
from app.schemas.context import UserContextCreate, UserContextUpdate

class ContextService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_context(self) -> List[UserContext]:
        result = await self.db.execute(select(UserContext))
        return list(result.scalars().all())

    async def get_context_by_key(self, key: str) -> Optional[UserContext]:
        result = await self.db.execute(select(UserContext).where(UserContext.key == key))
        return result.scalars().first()
    
    async def get_context_by_category(self, category: str) -> List[UserContext]:
        result = await self.db.execute(select(UserContext).where(UserContext.category == category))
        return list(result.scalars().all())

    async def create_context(self, context_in: UserContextCreate) -> UserContext:
        # Check if key exists
        existing = await self.get_context_by_key(context_in.key)
        if existing:
            raise ValueError(f"Context with key '{context_in.key}' already exists. Use update instead.")

        db_obj = UserContext(
            id=str(uuid4()),
            **context_in.dict()
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def update_context(self, key: str, context_in: UserContextUpdate) -> Optional[UserContext]:
        db_obj = await self.get_context_by_key(key)
        if not db_obj:
            return None
        
        update_data = context_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete_context(self, key: str) -> bool:
        db_obj = await self.get_context_by_key(key)
        if not db_obj:
            return False
            
        await self.db.delete(db_obj)
        await self.db.commit()
        return True
