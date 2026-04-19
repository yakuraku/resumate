from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.application import Application
from app.models.application_credential import ApplicationCredential
from app.schemas.credential import CredentialCreate, CredentialUpdate, CredentialResponse
from typing import Optional

router = APIRouter()


async def _assert_application_owned(db: AsyncSession, user_id: str, application_id: str) -> None:
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if app is None or app.user_id != user_id:
        raise HTTPException(status_code=404, detail="Application not found")


async def _load_owned_credential(db: AsyncSession, user_id: str, credential_id: str) -> ApplicationCredential:
    result = await db.execute(
        select(ApplicationCredential).where(ApplicationCredential.id == credential_id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    await _assert_application_owned(db, user_id, cred.application_id)
    return cred


@router.get("", response_model=Optional[CredentialResponse])
async def get_credential(
    application_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_application_owned(db, current_user.id, application_id)
    result = await db.execute(
        select(ApplicationCredential).where(ApplicationCredential.application_id == application_id)
    )
    return result.scalar_one_or_none()


@router.post("", response_model=CredentialResponse)
async def create_credential(
    data: CredentialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_application_owned(db, current_user.id, data.application_id)
    result = await db.execute(
        select(ApplicationCredential).where(ApplicationCredential.application_id == data.application_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Credential already exists for this application")

    cred = ApplicationCredential(**data.model_dump())
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return cred


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: str,
    data: CredentialUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cred = await _load_owned_credential(db, current_user.id, credential_id)

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(cred, key, val)

    await db.commit()
    await db.refresh(cred)
    return cred


@router.delete("/{credential_id}", status_code=204)
async def delete_credential(
    credential_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cred = await _load_owned_credential(db, current_user.id, credential_id)
    await db.delete(cred)
    await db.commit()
