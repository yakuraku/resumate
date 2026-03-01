import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.llm_service import llm_service
from app.services.context_service import ContextService
from app.schemas.context import UserContextCreate, UserContextUpdate
from app.services.prompts import (
    CONTEXT_EXTRACTION_SYSTEM_PROMPT,
    CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE
)

class ContextSummarizer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.context_service = ContextService(db)

    async def summarize_and_store(self, input_text: str):
        """
        Analyze text using LLM, extract key context items, and upsert them into DB.
        """
        if not input_text or len(input_text.strip()) < 10:
             raise ValueError("Input text too short")

        # 1. Prepare Prompt
        user_prompt = CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE.format(input_text=input_text[:5000]) # Limit input size
        messages = [
            {"role": "system", "content": CONTEXT_EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        # 2. Call LLM
        response_json = await llm_service.get_completion(messages, json_mode=True)
        
        # 3. Parse Response
        clean_json = response_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
            
        try:
            data = json.loads(clean_json)
            items = data.get("items", [])
        except json.JSONDecodeError:
            print(f"Failed to parse Context response: {response_json}")
            raise ValueError("Failed to extract context from text")

        results = []
        # 4. Store Items
        for item in items:
            key = item.get("key")
            value = item.get("value")
            category = item.get("category", "general")
            description = item.get("description")
            
            if not key or not value:
                continue

            # Check if exists
            existing = await self.context_service.get_context_by_key(key)
            if existing:
                update_data = UserContextUpdate(
                    value=value,
                    category=category,
                    description=description
                )
                updated = await self.context_service.update_context(key, update_data)
                results.append(updated)
            else:
                create_data = UserContextCreate(
                    key=key,
                    value=value,
                    category=category,
                    description=description
                )
                created = await self.context_service.create_context(create_data)
                results.append(created)
                
        return results
