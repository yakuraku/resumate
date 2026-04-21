from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user_setting import UserSetting
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.services import encryption_service

DEFAULT_SETTINGS = {
    "llm_provider": "openai",  # "openai" | "openrouter" | "gemini"
    "llm_api_key": "",
    "llm_api_key_openai": "",
    "llm_api_key_openrouter": "",
    "llm_api_key_gemini": "",
    "llm_model": "gpt-5-mini",
    "theme": "dark",
    "default_master_resume_path": "master-resume_CV.yaml",
    "autosave_enabled": "true",
    "tailor_mode": "agentic",  # "agentic" | "standard"
    "bg_animation_enabled": "true",
    "bg_animation_type": "particles",  # "particles" | "galaxy"
    # Ghost detection
    "ghost_auto_enabled": "true",
    "ghost_applied_days": "21",
    "ghost_screening_days": "21",
    "ghost_interviewing_days": "60",
    # PDF saving
    "save_pdf_folder_enabled": "false",
    "save_pdf_folder_path": "",
    # Onboarding
    "wizard_dismissed": "false",
    # Profile
    "preferred_name": "",
}

# Default model per provider
PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-5-mini",
    "openrouter": "anthropic/claude-sonnet-4",
    "gemini": "gemini-2.5-flash",
}

# Keys whose values must be encrypted at rest.
_ENCRYPTED_KEYS = {
    "llm_api_key",
    "llm_api_key_openai",
    "llm_api_key_openrouter",
    "llm_api_key_gemini",
}


def _decode_for_read(key: str, value: str) -> str:
    if key in _ENCRYPTED_KEYS and value and encryption_service.is_encrypted(value):
        try:
            return encryption_service.decrypt(value)
        except Exception:
            return ""
    return value or ""


def _encode_for_write(key: str, value: str) -> str:
    if key in _ENCRYPTED_KEYS and value:
        if encryption_service.is_encrypted(value):
            return value
        return encryption_service.encrypt(value)
    return value


class SettingsService:

    async def _get_all_raw(self, db: AsyncSession, user_id: str) -> dict[str, str]:
        """Return decrypted key->value map for a single user."""
        result = await db.execute(
            select(UserSetting).where(UserSetting.user_id == user_id)
        )
        rows = result.scalars().all()
        out: dict[str, str] = {}
        needs_migration: list[UserSetting] = []
        for row in rows:
            raw_val = row.setting_value or ""
            if row.setting_key in _ENCRYPTED_KEYS and raw_val and not encryption_service.is_encrypted(raw_val):
                # Legacy plaintext: surface it to callers but mark for lazy encrypt.
                out[row.setting_key] = raw_val
                needs_migration.append(row)
            else:
                out[row.setting_key] = _decode_for_read(row.setting_key, raw_val)
        if needs_migration:
            for row in needs_migration:
                row.setting_value = _encode_for_write(row.setting_key, row.setting_value or "")
            await db.commit()
        return out

    async def _ensure_defaults(self, db: AsyncSession, user_id: str) -> None:
        existing_raw = await self._get_all_raw(db, user_id)
        added = False
        for key, default_value in DEFAULT_SETTINGS.items():
            if key not in existing_raw:
                stored = _encode_for_write(key, default_value) if default_value else default_value
                db.add(UserSetting(user_id=user_id, setting_key=key, setting_value=stored))
                added = True
        if added:
            await db.commit()

    async def get_settings(self, db: AsyncSession, user_id: str) -> SettingsResponse:
        await self._ensure_defaults(db, user_id)
        raw = await self._get_all_raw(db, user_id)

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
            tailor_mode=raw.get("tailor_mode", "agentic"),
            bg_animation_enabled=raw.get("bg_animation_enabled", "true").lower() == "true",
            bg_animation_type=raw.get("bg_animation_type", "particles"),
            ghost_auto_enabled=raw.get("ghost_auto_enabled", "true").lower() == "true",
            ghost_applied_days=int(raw.get("ghost_applied_days", "21")),
            ghost_screening_days=int(raw.get("ghost_screening_days", "21")),
            ghost_interviewing_days=int(raw.get("ghost_interviewing_days", "60")),
            save_pdf_folder_enabled=raw.get("save_pdf_folder_enabled", "false").lower() == "true",
            save_pdf_folder_path=raw.get("save_pdf_folder_path", ""),
            wizard_dismissed=raw.get("wizard_dismissed", "false").lower() == "true",
            preferred_name=raw.get("preferred_name", ""),
        )

    async def update_settings(self, db: AsyncSession, user_id: str, data: SettingsUpdate) -> SettingsResponse:
        await self._ensure_defaults(db, user_id)
        update_dict = data.model_dump(exclude_unset=True)

        for key, value in update_dict.items():
            if isinstance(value, bool):
                str_value = "true" if value else "false"
            else:
                str_value = str(value) if value is not None else ""

            stored_value = _encode_for_write(key, str_value)

            result = await db.execute(
                select(UserSetting).where(
                    UserSetting.user_id == user_id,
                    UserSetting.setting_key == key,
                )
            )
            setting = result.scalar_one_or_none()
            if setting:
                setting.setting_value = stored_value
            else:
                db.add(UserSetting(user_id=user_id, setting_key=key, setting_value=stored_value))

        await db.commit()

        llm_keys = {"llm_api_key", "llm_api_key_openai", "llm_api_key_openrouter", "llm_api_key_gemini", "llm_provider", "llm_model"}
        if llm_keys & update_dict.keys():
            await self._refresh_llm_service(db, user_id)

        return await self.get_settings(db, user_id)

    async def _refresh_llm_service(self, db: AsyncSession, user_id: str) -> None:
        """Refresh the global llm_service with updated settings for a user."""
        from app.services.llm_service import llm_service
        from app.config import settings as app_settings
        raw = await self._get_all_raw(db, user_id)

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
            model = PROVIDER_DEFAULT_MODELS.get(provider, "gpt-5-mini")

        if api_key:
            llm_service.api_key = api_key
            llm_service.provider = provider
            llm_service.default_model = model

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
                    "HTTP-Referer": app_settings.APP_URL,
                    "X-Title": app_settings.PROJECT_NAME,
                    "Content-Type": "application/json",
                }

    async def get_effective_api_key(self, db: AsyncSession, user_id: str) -> tuple[str, str, str]:
        """Returns (api_key, provider, model) using settings with .env fallback."""
        raw = await self._get_all_raw(db, user_id)
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
            model = PROVIDER_DEFAULT_MODELS.get(provider, "gpt-5-mini")

        return api_key, provider, model


settings_service = SettingsService()
