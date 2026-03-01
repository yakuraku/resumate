import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user_setting import UserSetting
from app.schemas.settings import SettingsResponse, SettingsUpdate

DEFAULT_SETTINGS = {
    "llm_provider": "openai",  # "openai" | "openrouter" | "gemini"
    "llm_api_key": "",
    "llm_api_key_openai": "",
    "llm_api_key_openrouter": "",
    "llm_api_key_gemini": "",
    "llm_model": "gpt-4o-mini",
    "theme": "dark",
    "default_master_resume_path": "master-resume_CV.yaml",
    "autosave_enabled": "true",
}

# Default model per provider
PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "openrouter": "anthropic/claude-sonnet-4",
    "gemini": "gemini-2.5-flash",
}


class SettingsService:

    async def _get_all_raw(self, db: AsyncSession) -> dict[str, str]:
        result = await db.execute(select(UserSetting))
        rows = result.scalars().all()
        return {row.setting_key: row.setting_value or "" for row in rows}

    async def _ensure_defaults(self, db: AsyncSession) -> None:
        existing_raw = await self._get_all_raw(db)
        for key, default_value in DEFAULT_SETTINGS.items():
            if key not in existing_raw:
                db.add(UserSetting(setting_key=key, setting_value=default_value))
        await db.commit()

    async def get_settings(self, db: AsyncSession) -> SettingsResponse:
        await self._ensure_defaults(db)
        raw = await self._get_all_raw(db)

        return SettingsResponse(
            llm_provider=raw.get("llm_provider", DEFAULT_SETTINGS["llm_provider"]),
            llm_api_key=raw.get("llm_api_key", ""),
            llm_api_key_openai=raw.get("llm_api_key_openai", ""),
            llm_api_key_openrouter=raw.get("llm_api_key_openrouter", ""),
            llm_api_key_gemini=raw.get("llm_api_key_gemini", ""),
            llm_model=raw.get("llm_model", DEFAULT_SETTINGS["llm_model"]),
            theme=raw.get("theme", DEFAULT_SETTINGS["theme"]),
            default_master_resume_path=raw.get("default_master_resume_path", DEFAULT_SETTINGS["default_master_resume_path"]),
            autosave_enabled=raw.get("autosave_enabled", "true").lower() == "true",
        )

    async def update_settings(self, db: AsyncSession, data: SettingsUpdate) -> SettingsResponse:
        await self._ensure_defaults(db)
        update_dict = data.model_dump(exclude_unset=True)

        for key, value in update_dict.items():
            # Convert boolean to string for storage
            if isinstance(value, bool):
                str_value = "true" if value else "false"
            else:
                str_value = str(value) if value is not None else ""

            result = await db.execute(
                select(UserSetting).where(UserSetting.setting_key == key)
            )
            setting = result.scalar_one_or_none()
            if setting:
                setting.setting_value = str_value
            else:
                db.add(UserSetting(setting_key=key, setting_value=str_value))

        await db.commit()

        # If any LLM setting changed, refresh the live service
        llm_keys = {"llm_api_key", "llm_api_key_openai", "llm_api_key_openrouter", "llm_api_key_gemini", "llm_provider", "llm_model"}
        if llm_keys & update_dict.keys():
            await self._refresh_llm_service(db)

        return await self.get_settings(db)

    async def _refresh_llm_service(self, db: AsyncSession) -> None:
        """Refresh the global llm_service with updated settings."""
        from app.services.llm_service import llm_service
        raw = await self._get_all_raw(db)

        provider = raw.get("llm_provider", "openai")
        model = raw.get("llm_model", "")

        # Prefer the provider-specific key; fall back to the legacy shared key
        provider_key_map = {
            "openai": "llm_api_key_openai",
            "openrouter": "llm_api_key_openrouter",
            "gemini": "llm_api_key_gemini",
        }
        api_key = raw.get(provider_key_map.get(provider, "llm_api_key"), "") or raw.get("llm_api_key", "")

        if not api_key:
            # Fall back to .env values
            from app.config import settings as app_settings
            if app_settings.OPENAI_API_KEY:
                api_key = app_settings.OPENAI_API_KEY
                provider = "openai"
                if not model:
                    model = app_settings.OPENAI_MODEL
            elif app_settings.OPENROUTER_API_KEY:
                api_key = app_settings.OPENROUTER_API_KEY
                provider = "openrouter"
                if not model:
                    model = app_settings.DEFAULT_MODEL
            elif app_settings.GEMINI_API_KEY:
                api_key = app_settings.GEMINI_API_KEY
                provider = "gemini"
                if not model:
                    model = app_settings.GEMINI_MODEL

        if not model:
            model = PROVIDER_DEFAULT_MODELS.get(provider, "gpt-4o-mini")

        if api_key:
            llm_service.api_key = api_key
            llm_service.provider = provider
            llm_service.default_model = model

            from app.config import settings as app_settings
            if provider == "openai":
                llm_service.base_url = "https://api.openai.com/v1/chat/completions"
                llm_service.headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
            elif provider == "gemini":
                llm_service.base_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
                llm_service.headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
            else:  # openrouter
                llm_service.base_url = "https://openrouter.ai/api/v1/chat/completions"
                llm_service.headers = {
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": app_settings.PROJECT_NAME,
                    "Content-Type": "application/json",
                }

    async def get_effective_api_key(self, db: AsyncSession) -> tuple[str, str, str]:
        """Returns (api_key, provider, model) using settings with .env fallback."""
        raw = await self._get_all_raw(db)
        from app.config import settings as app_settings

        provider = raw.get("llm_provider", "openai")
        model = raw.get("llm_model", "")

        provider_key_map = {
            "openai": "llm_api_key_openai",
            "openrouter": "llm_api_key_openrouter",
            "gemini": "llm_api_key_gemini",
        }
        api_key = raw.get(provider_key_map.get(provider, "llm_api_key"), "") or raw.get("llm_api_key", "")

        if not api_key:
            if app_settings.OPENAI_API_KEY:
                api_key = app_settings.OPENAI_API_KEY
                provider = "openai"
                if not model:
                    model = app_settings.OPENAI_MODEL
            elif app_settings.OPENROUTER_API_KEY:
                api_key = app_settings.OPENROUTER_API_KEY
                provider = "openrouter"
                if not model:
                    model = app_settings.DEFAULT_MODEL
            elif app_settings.GEMINI_API_KEY:
                api_key = app_settings.GEMINI_API_KEY
                provider = "gemini"
                if not model:
                    model = app_settings.GEMINI_MODEL

        if not model:
            model = PROVIDER_DEFAULT_MODELS.get(provider, "gpt-4o-mini")

        return api_key, provider, model


settings_service = SettingsService()
