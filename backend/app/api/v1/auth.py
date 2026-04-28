"""Auth routes: /auth/login, /auth/logout, /auth/me, /auth/csrf, /auth/signup.

In AUTH_MODE=local these endpoints are still mounted but behave as no-ops --
login always succeeds as the bootstrap admin, and /me returns that same user.
The frontend can still call them; it just never sees a failure.
/auth/signup is disabled in local mode (returns 403).
"""
import time
from collections import defaultdict
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import COOKIE_NAME, get_current_user
from app.models.access_code import AccessCode
from app.models.user import User
from app.schemas.auth import CsrfResponse, LoginRequest, LoginResponse, SignupRequest, UserOut
from app.services import auth_service


router = APIRouter()

# In-memory sliding-window rate limiters.
# Resets on process restart (acceptable for beta; use Redis for scale).
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW_SECONDS = 60.0
_RATE_MAX_ATTEMPTS = 5

_signup_attempts: dict[str, list[float]] = defaultdict(list)
_SIGNUP_RATE_WINDOW = 600.0   # 10 minutes
_SIGNUP_MAX_ATTEMPTS = 5


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    cutoff = now - _RATE_WINDOW_SECONDS
    attempts = [t for t in _login_attempts[ip] if t > cutoff]
    _login_attempts[ip] = attempts
    if len(attempts) >= _RATE_MAX_ATTEMPTS:
        return True
    _login_attempts[ip].append(now)
    return False


def _cookie_kwargs() -> dict:
    """Cookie attributes appropriate for the current mode."""
    base: dict = {
        "key": COOKIE_NAME,
        "httponly": True,
        "max_age": settings.JWT_EXPIRE_MINUTES * 60,
    }
    if settings.AUTH_MODE == "cloud":
        base["secure"] = True
        base["samesite"] = "none"
        if settings.COOKIE_DOMAIN:
            base["domain"] = settings.COOKIE_DOMAIN
    else:
        base["secure"] = False
        base["samesite"] = "lax"
    return base


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    if settings.AUTH_MODE == "cloud" and _is_rate_limited(_get_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again in a minute.",
            headers={"Retry-After": "60"},
        )
    if settings.AUTH_MODE == "local":
        # Local mode: resolve the bootstrap user, skip password check.
        stmt = select(User).where(User.email == settings.BOOTSTRAP_ADMIN_EMAIL)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=500, detail="Bootstrap admin missing")
    else:
        stmt = select(User).where(User.email == payload.email.lower())
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not auth_service.verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth_service.create_access_token(user.id)
    csrf = auth_service.make_csrf_token(user.id)
    response.set_cookie(value=token, **_cookie_kwargs())
    return LoginResponse(user=UserOut.model_validate(user), csrf_token=csrf)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(
        COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN or None,
        samesite="none" if settings.AUTH_MODE == "cloud" else "lax",
        secure=settings.AUTH_MODE == "cloud",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.get("/csrf", response_model=CsrfResponse)
async def csrf(current_user: User = Depends(get_current_user)) -> CsrfResponse:
    return CsrfResponse(csrf_token=auth_service.make_csrf_token(current_user.id))


@router.post("/signup", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    if settings.AUTH_MODE != "cloud":
        raise HTTPException(status_code=403, detail="Signup is not available in this mode.")

    # Rate limit per IP.
    ip = _get_client_ip(request)
    now = time.monotonic()
    cutoff = now - _SIGNUP_RATE_WINDOW
    recent = [t for t in _signup_attempts[ip] if t > cutoff]
    _signup_attempts[ip] = recent
    if len(recent) >= _SIGNUP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many signup attempts. Please try again later.",
            headers={"Retry-After": "600"},
        )
    _signup_attempts[ip].append(now)

    # Validate access code (case-insensitive).
    code_val = payload.access_code.strip().upper()
    result = await db.execute(select(AccessCode).where(AccessCode.code == code_val))
    access_code = result.scalar_one_or_none()

    valid = (
        access_code is not None
        and access_code.is_active
        and (access_code.expires_at is None or access_code.expires_at > datetime.now(timezone.utc))
        and (access_code.max_uses is None or access_code.use_count < access_code.max_uses)
    )
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired access code.")

    # Check email uniqueness.
    email = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    # Create user and increment use_count in one transaction.
    user = User(
        id=str(uuid4()),
        email=email,
        password_hash=auth_service.hash_password(payload.password),
        is_admin=False,
        is_active=True,
    )
    db.add(user)
    access_code.use_count += 1
    await db.commit()
    await db.refresh(user)

    token = auth_service.create_access_token(user.id)
    csrf = auth_service.make_csrf_token(user.id)
    response.set_cookie(value=token, **_cookie_kwargs())
    return LoginResponse(user=UserOut.model_validate(user), csrf_token=csrf)
