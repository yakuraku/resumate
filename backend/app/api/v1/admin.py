"""Admin-only endpoints for user management and access code management.

All routes require the requesting user to be is_admin=True.
Available in both local and cloud mode so admins can provision beta testers
without needing direct database access.
"""
import secrets
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models.access_code import AccessCode
from app.models.user import User
from app.schemas.auth import UserOut
from app.services import auth_service

router = APIRouter()


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    is_admin: bool = False

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserCreateResponse(UserOut):
    pass


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.get("/users", response_model=UserListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> UserListResponse:
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return UserListResponse(
        items=[UserOut.model_validate(u) for u in users],
        total=len(users),
    )


@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> UserCreateResponse:
    email = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A user with email '{email}' already exists.",
        )
    user = User(
        id=str(uuid4()),
        email=email,
        password_hash=auth_service.hash_password(payload.password),
        is_admin=payload.is_admin,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserCreateResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> UserOut:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admins from deactivating or de-admining themselves.
    if user_id == admin.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        if payload.is_admin is False:
            raise HTTPException(status_code=400, detail="Cannot remove admin from your own account")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.password is not None:
        user.password_hash = auth_service.hash_password(payload.password)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


# ── Access Code Management ────────────────────────────────────────────────────


class AccessCodeCreateRequest(BaseModel):
    code: Optional[str] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    note: Optional[str] = None


class AccessCodeUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    note: Optional[str] = None


class AccessCodeOut(BaseModel):
    id: str
    code: str
    is_active: bool
    max_uses: Optional[int]
    use_count: int
    expires_at: Optional[datetime]
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/access-codes", response_model=list[AccessCodeOut])
async def list_access_codes(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[AccessCodeOut]:
    result = await db.execute(select(AccessCode).order_by(AccessCode.created_at.desc()))
    codes = result.scalars().all()
    return [AccessCodeOut.model_validate(c) for c in codes]


@router.post("/access-codes", response_model=AccessCodeOut, status_code=status.HTTP_201_CREATED)
async def create_access_code(
    payload: AccessCodeCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AccessCodeOut:
    code_val = (payload.code.strip().upper() if payload.code else None) or secrets.token_urlsafe(9).upper()[:12]

    existing = await db.execute(select(AccessCode).where(AccessCode.code == code_val))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Access code '{code_val}' already exists.")

    code = AccessCode(
        id=str(uuid4()),
        code=code_val,
        is_active=True,
        max_uses=payload.max_uses,
        use_count=0,
        expires_at=payload.expires_at,
        note=payload.note,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    return AccessCodeOut.model_validate(code)


@router.patch("/access-codes/{code_id}", response_model=AccessCodeOut)
async def update_access_code(
    code_id: str,
    payload: AccessCodeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AccessCodeOut:
    code = await db.get(AccessCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Access code not found.")

    if payload.is_active is not None:
        code.is_active = payload.is_active
    if payload.max_uses is not None:
        code.max_uses = payload.max_uses
    if payload.expires_at is not None:
        code.expires_at = payload.expires_at
    if payload.note is not None:
        code.note = payload.note

    await db.commit()
    await db.refresh(code)
    return AccessCodeOut.model_validate(code)


@router.delete("/access-codes/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_access_code(
    code_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> None:
    code = await db.get(AccessCode, code_id)
    if not code:
        raise HTTPException(status_code=404, detail="Access code not found.")
    await db.delete(code)
    await db.commit()
