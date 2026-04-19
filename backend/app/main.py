from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
import sys
import asyncio

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.asyncio import AsyncioIntegration
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment="production" if settings.AUTH_MODE == "cloud" else "development",
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


def _startup_checks() -> None:
    """Run synchronous file-system checks and initialization at startup."""
    from app.config import settings as _s
    # Cloud mode: all content lives in Postgres/R2 -- no local filesystem to check.
    if _s.STORAGE_BACKEND == "r2":
        return

    from app.utils.filesystem import (
        get_project_root,
        get_data_dir,
        get_master_resume_path,
        get_context_folder,
        get_tailor_helper_path,
        ensure_directory,
    )
    from pathlib import Path
    import json

    root = get_project_root()
    data_dir = get_data_dir()
    ensure_directory(data_dir)

    # 1. Warn loudly if master-resume_CV.yaml is missing.
    master = get_master_resume_path()
    if not master.exists():
        print(
            "\n"
            "=" * 70 + "\n"
            "[WARNING] master-resume_CV.yaml NOT FOUND at:\n"
            f"  {master}\n"
            "\n"
            "  Resume Templates will start with an empty stub. Every new\n"
            "  application resume will be blank until you provide your YAML.\n"
            "\n"
            "  ACTION REQUIRED:\n"
            "    Copy master-resume_CV.yaml.example to master-resume_CV.yaml\n"
            "    and fill it in with your personal details.\n"
            "=" * 70 + "\n"
        )

    # 2. Auto-create my_info/ folder if it doesn't exist.
    my_info = root / "my_info"
    if not my_info.exists():
        my_info.mkdir(parents=True, exist_ok=True)
        print(
            "[Startup] Created my_info/ folder. Populate it with .md context\n"
            "  files (work_experience.md, projects.md, etc.) to enable\n"
            "  high-quality AI resume tailoring. See my_info/*.md.example files."
        )

    # 3. Reset stale context_config.json paths.
    # A path saved on a different machine / OS won't be valid here.
    config_path = data_dir / "context_config.json"
    if config_path.exists():
        try:
            cfg = json.loads(config_path.read_text(encoding="utf-8"))
            saved_path = cfg.get("folder_path", "")
            if saved_path and not Path(saved_path).exists():
                print(
                    f"[Startup] context_config.json references a path that no\n"
                    f"  longer exists: {saved_path}\n"
                    f"  Resetting to default: {my_info}"
                )
                config_path.write_text(
                    json.dumps({"folder_path": str(my_info)}), encoding="utf-8"
                )
        except Exception as e:
            print(f"[Startup] Could not validate context_config.json: {e}")

    # 4. Initialize the per-user tailor helper in data/ from the shipped template.
    helper_path = get_tailor_helper_path()
    if not helper_path.exists():
        template_path = (
            Path(__file__).parent / "templates" / "resume-tailor-helper.template.md"
        )
        if template_path.exists():
            import shutil
            shutil.copy(template_path, helper_path)
            print(f"[Startup] Initialized resume-tailor-helper.md in {data_dir}")
        else:
            print(
                "[Startup] WARNING: resume-tailor-helper.template.md not found. "
                "Tailor helper will be missing until resolved."
            )


async def _daily_ghost_job() -> None:
    """Background task: runs ghost detection once every 24 hours."""
    while True:
        await asyncio.sleep(24 * 60 * 60)
        try:
            from sqlalchemy import select
            from app.database import SessionLocal as AsyncSessionLocal
            from app.services.application_service import ApplicationService
            from app.models.user import User
            async with AsyncSessionLocal() as db:
                users = (await db.execute(select(User))).scalars().all()
                for user in users:
                    svc = ApplicationService(db, user.id)
                    await svc._auto_ghost_stale_applications()
            print("[GhostJob] Daily ghost detection completed.")
        except Exception as e:
            print(f"[GhostJob] Error during daily ghost detection: {e}")


async def _ensure_bootstrap_admin() -> None:
    """Create the bootstrap admin on first run (local mode convenience).

    In AUTH_MODE=local the app skips the login screen and resolves every
    request to this user, so it must exist. In cloud mode we also seed a
    first admin from env vars so initial deployments don't need a shell.
    """
    from sqlalchemy import select
    from uuid import uuid4
    from app.config import settings
    from app.database import SessionLocal as AsyncSessionLocal
    from app.models.user import User
    from app.services import auth_service

    if not settings.BOOTSTRAP_ADMIN_EMAIL or not settings.BOOTSTRAP_ADMIN_PASSWORD:
        print("[Startup] BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set -- skipping admin seed.")
        return

    email = settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            return  # already seeded
        # Only seed if no users exist at all -- avoids accidental admin creation
        # after an admin already made it into the table with a different email.
        any_user = (await db.execute(select(User))).first()
        if any_user:
            print(
                f"[Startup] Users table is non-empty but {email} is missing. "
                "Skipping bootstrap seed."
            )
            return
        user = User(
            id=str(uuid4()),
            email=email,
            password_hash=auth_service.hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
            is_admin=True,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        print(f"[Startup] Seeded bootstrap admin: {email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Synchronous file-system checks first (fast).
    _startup_checks()

    # Ensure bootstrap admin exists. In local mode, this is required before
    # any request can resolve its user (dependencies.get_current_user).
    try:
        await _ensure_bootstrap_admin()
    except Exception as e:
        print(f"[Startup] Bootstrap admin seed failed: {e}")

    # One-shot: migrate on-disk context files / master resume / helper / PDFs
    # into the user-scoped storage. Idempotent; skipped once DB rows exist.
    try:
        from sqlalchemy import select
        from app.database import SessionLocal as AsyncSessionLocal
        from app.models.user import User
        from app.services.storage_seed import seed_user_from_filesystem
        from app.config import settings
        async with AsyncSessionLocal() as db:
            email = settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip()
            user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user:
                await seed_user_from_filesystem(db, user.id)
    except Exception as e:
        print(f"[Startup] Storage seed failed: {e}")

    # Restore LLM settings from DB so last-selected provider is active immediately.
    try:
        from sqlalchemy import select
        from app.database import SessionLocal as AsyncSessionLocal
        from app.services.settings_service import settings_service
        from app.models.user import User
        from app.config import settings
        async with AsyncSessionLocal() as db:
            email = settings.BOOTSTRAP_ADMIN_EMAIL.lower().strip()
            user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user:
                await settings_service._refresh_llm_service(db, user.id)
    except Exception as e:
        print(f"[Startup] Could not restore LLM settings from DB (using .env fallback): {e}")

    # Ensure the master ResumeTemplate row exists in the DB.
    try:
        from app.database import SessionLocal as AsyncSessionLocal
        from app.services.resume_template_service import ensure_master_exists
        async with AsyncSessionLocal() as db:
            await ensure_master_exists(db)
        print("[Startup] Master ResumeTemplate ensured.")
    except Exception as e:
        print(f"[Startup] Could not ensure master ResumeTemplate: {e}")

    # Start the daily ghost detection background task.
    ghost_task = asyncio.create_task(_daily_ghost_job())

    yield

    ghost_task.cancel()
    try:
        await ghost_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    lifespan=lifespan,
    title="ResuMate Career OS API",
    description="Backend API for ResuMate Career OS",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware.
# Build the allowed origins from the configured list, then append APP_URL
# (the Vercel frontend) so cross-origin requests with credentials work.
# allow_origins=["*"] is intentionally avoided -- it is incompatible with
# allow_credentials=True (CORS spec rejects it).
_cors_origins = list(settings.BACKEND_CORS_ORIGINS)
if settings.APP_URL and settings.APP_URL not in _cors_origins:
    _cors_origins.append(settings.APP_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
)

from app.api.v1.router import api_router
app.include_router(api_router, prefix="/api/v1")


@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
async def health_check(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    await db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "version": "0.1.0",
        "app": "ResuMate Career OS",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8921, reload=True)
