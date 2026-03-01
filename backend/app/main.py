from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: load saved LLM settings from DB so the last-selected
    # provider/key/model is active immediately without needing a Save.
    try:
        from app.database import SessionLocal as AsyncSessionLocal
        from app.services.settings_service import settings_service
        async with AsyncSessionLocal() as db:
            await settings_service._refresh_llm_service(db)
    except Exception as e:
        print(f"[Startup] Could not restore LLM settings from DB (using .env fallback): {e}")

    try:
        from app.database import SessionLocal as AsyncSessionLocal
        from app.services.resume_template_service import ensure_master_exists
        async with AsyncSessionLocal() as db:
            await ensure_master_exists(db)
        print("[Startup] Master ResumeTemplate ensured.")
    except Exception as e:
        print(f"[Startup] Could not ensure master ResumeTemplate: {e}")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="ResuMate Career OS API",
    description="Backend API for ResuMate Career OS",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
)

from app.api.v1.router import api_router
app.include_router(api_router, prefix="/api/v1")

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ok",
        "version": "0.1.0",
        "app": "ResuMate Career OS"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8921, reload=True)
