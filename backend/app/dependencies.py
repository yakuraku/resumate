"""Shared FastAPI dependencies.

In AUTH_MODE=local (self-host / Docker / dev), every request resolves to the
bootstrap admin user -- no cookie, no CSRF, no login UI. In AUTH_MODE=cloud
the JWT cookie + CSRF header are both required for mutating verbs.
"""
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services import auth_service


COOKIE_NAME = "rm_auth"
CSRF_HEADER = "X-CSRF-Token"
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Cached in-process so local mode doesn't hit the DB on every request.
_local_user_cache: Optional[User] = None


async def _get_or_cache_local_user(db: AsyncSession) -> User:
    global _local_user_cache
    if _local_user_cache is not None:
        return _local_user_cache
    stmt = select(User).where(User.email == settings.BOOTSTRAP_ADMIN_EMAIL)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Bootstrap admin not found. This should have been created at "
                "startup. Check BOOTSTRAP_ADMIN_EMAIL in .env."
            ),
        )
    _local_user_cache = user
    return user


def invalidate_local_user_cache() -> None:
    global _local_user_cache
    _local_user_cache = None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # Local mode: auth is a no-op; return bootstrap admin.
    if settings.AUTH_MODE == "local":
        return await _get_or_cache_local_user(db)

    # Cloud mode: read JWT from httpOnly cookie.
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = auth_service.decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # CSRF check on mutating verbs.
    if request.method in MUTATING_METHODS:
        csrf = request.headers.get(CSRF_HEADER, "")
        if not auth_service.verify_csrf_token(csrf, user_id):
            raise HTTPException(status_code=403, detail="CSRF check failed")

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
