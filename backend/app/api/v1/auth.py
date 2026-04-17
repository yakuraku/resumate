"""Auth routes: /auth/login, /auth/logout, /auth/me, /auth/csrf.

In AUTH_MODE=local these endpoints are still mounted but behave as no-ops --
login always succeeds as the bootstrap admin, and /me returns that same user.
The frontend can still call them; it just never sees a failure.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import COOKIE_NAME, get_current_user
from app.models.user import User
from app.schemas.auth import CsrfResponse, LoginRequest, LoginResponse, UserOut
from app.services import auth_service


router = APIRouter()


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
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
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
