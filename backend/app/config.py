from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "ResuMate Career OS"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Public URL of this ResuMate instance.
    # Used as the HTTP-Referer header for OpenRouter and in other places that
    # need to identify the app to external services.
    # Docker default: http://localhost:1235  (the frontend port)
    APP_URL: str = "http://localhost:1235"

    # CORS origins allowed to reach the backend directly.
    # In Docker the frontend proxies all /api/v1/* requests internally, so
    # the browser never talks to the backend directly -- CORS is not an issue.
    # Kept for local dev compatibility.
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:1234",
        "http://localhost:1235",
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # Database
    # Local dev: relative path resolved from the backend/ working directory.
    # Docker: override via DATABASE_URL=sqlite+aiosqlite:////app/data/resumate.db
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/resumate.db"

    # LLM providers -- all optional, at least one key must be set for AI features.
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5-mini"

    OPENROUTER_API_KEY: str = ""
    DEFAULT_MODEL: str = "anthropic/claude-sonnet-4"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # ----- Auth (Phase 1) -----
    # AUTH_MODE=local bypasses auth entirely: every request resolves to the
    # BOOTSTRAP_ADMIN user. AUTH_MODE=cloud enforces JWT cookie + CSRF.
    AUTH_MODE: str = "local"
    JWT_SECRET_KEY: str = "dev-insecure-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    CSRF_SECRET_KEY: str = "dev-insecure-change-me"
    ENCRYPTION_KEY: str = ""  # Fernet key; required when storing user API keys

    # Bootstrap admin (used to seed local installs and during first cloud deploy).
    BOOTSTRAP_ADMIN_EMAIL: str = "admin@localhost"
    BOOTSTRAP_ADMIN_PASSWORD: str = "change-me"

    # Cookie / CORS -- only meaningful in cloud mode.
    COOKIE_DOMAIN: str = ""
    COOKIE_SECURE: bool = False

    # ----- Storage backend (Phase 2+) -----
    STORAGE_BACKEND: str = "local"  # "local" | "r2"
    R2_ACCOUNT_ID: str = ""
    R2_BUCKET_NAME: str = "resumate-files"
    R2_ENDPOINT_URL: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
