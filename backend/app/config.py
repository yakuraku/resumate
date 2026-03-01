from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "ResuMate Career OS"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:1234", "http://localhost:3000", "http://localhost:3001"]
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/resumate.db"
    
    # LLM
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    OPENROUTER_API_KEY: str = ""
    DEFAULT_MODEL: str = "anthropic/claude-sonnet-4"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
