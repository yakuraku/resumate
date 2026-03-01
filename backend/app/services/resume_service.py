from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.resume import Resume, ResumeVersion, VersionSource
from app.schemas.resume import ResumeCreate, ResumeUpdate
from app.utils.filesystem import get_master_resume_path, read_file
from app.services.rendercv_service import rendercv_service
from app.services.tailor_service import tailor_service
from app.models.application import Application


class ResumeService:

    @staticmethod
    def _generate_label(source: str, version_number: int) -> str:
        prefix_map = {
            VersionSource.MASTER: "Master",
            VersionSource.MANUAL_EDIT: "Edit",
            VersionSource.AI_TAILORED: "AI Tailored",
        }
        prefix = prefix_map.get(source, "v")
        return f"{prefix} v{version_number}"

    async def create_resume(self, db: AsyncSession, application_id: str, clone_from_id: str = None) -> Resume:
        # Check if resume already exists for this application
        existing_result = await db.execute(select(Resume).where(Resume.application_id == application_id))
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Resume already exists for this application")

        yaml_content = ""

        if clone_from_id:
            source_resume = await db.get(Resume, clone_from_id)
            if not source_resume:
                raise HTTPException(status_code=404, detail="Source resume not found")
            yaml_content = source_resume.yaml_content
        else:
            master_path = get_master_resume_path()
            try:
                yaml_content = read_file(master_path)
            except Exception as e:
                yaml_content = "cv:\n  name: Your Name\n"
                print(f"Warning: Could not read master resume: {e}")

        new_resume = Resume(
            application_id=application_id,
            cloned_from_id=clone_from_id,
            yaml_content=yaml_content,
            current_version=1
        )

        db.add(new_resume)
        await db.commit()
        await db.refresh(new_resume)

        # Create initial version with source="master"
        first_version = ResumeVersion(
            resume_id=new_resume.id,
            version_number=1,
            yaml_content=yaml_content,
            change_summary="Initial creation",
            source=VersionSource.MASTER,
            is_active=True,
            label=self._generate_label(VersionSource.MASTER, 1)
        )
        db.add(first_version)
        await db.commit()

        return await self.get_resume_by_id(db, str(new_resume.id))

    async def get_resume_by_application_id(self, db: AsyncSession, application_id: str) -> Resume:
        stmt = select(Resume).where(Resume.application_id == application_id).options(selectinload(Resume.versions))
        result = await db.execute(stmt)
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found for this application")
        return resume

    async def get_all_resumes(self, db: AsyncSession) -> list[Resume]:
        stmt = select(Resume).options(selectinload(Resume.versions))
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_resume_by_id(self, db: AsyncSession, resume_id: str) -> Resume:
        stmt = select(Resume).where(Resume.id == resume_id).options(selectinload(Resume.versions))
        result = await db.execute(stmt)
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        return resume

    async def update_resume_yaml_content(self, db: AsyncSession, resume_id: str, yaml_content: str) -> Resume:
        """Update Resume.yaml_content AND the active version's yaml_content in-place (auto-save, no new version)."""
        resume = await self.get_resume_by_id(db, resume_id)
        resume.yaml_content = yaml_content
        # Keep the active version's yaml_content in sync
        active_version = next((v for v in resume.versions if v.is_active), None)
        if active_version:
            active_version.yaml_content = yaml_content
            active_version.pdf_path = None
            active_version.pdf_rendered_at = None
        await db.commit()
        await db.refresh(resume)
        return resume

    async def update_version_content(self, db: AsyncSession, resume_id: str, version_id: str, yaml_content: str) -> Resume:
        """Update a specific version's yaml_content in-place. Only allowed for the active version."""
        resume = await self.get_resume_by_id(db, resume_id)
        target_version = next((v for v in resume.versions if v.id == version_id), None)
        if not target_version:
            raise HTTPException(status_code=404, detail="Version not found")
        if not target_version.is_active:
            raise HTTPException(status_code=400, detail="Can only update the active version's content in-place")
        target_version.yaml_content = yaml_content
        target_version.pdf_path = None
        target_version.pdf_rendered_at = None
        resume.yaml_content = yaml_content
        await db.commit()
        return await self.get_resume_by_id(db, str(resume.id))

    async def save_as_new_version(self, db: AsyncSession, resume_id: str, change_summary: str = "Manual save") -> Resume:
        """Snapshot current yaml_content as a new explicit version."""
        resume = await self.get_resume_by_id(db, resume_id)

        # Deactivate all existing versions
        for v in resume.versions:
            v.is_active = False

        resume.current_version += 1
        new_version = ResumeVersion(
            resume_id=resume.id,
            version_number=resume.current_version,
            yaml_content=resume.yaml_content,
            change_summary=change_summary,
            source=VersionSource.MANUAL_EDIT,
            is_active=True,
            label=self._generate_label(VersionSource.MANUAL_EDIT, resume.current_version)
        )
        db.add(new_version)
        await db.commit()
        return await self.get_resume_by_id(db, str(resume.id))

    async def activate_version(self, db: AsyncSession, resume_id: str, version_id: str) -> Resume:
        """Set a specific version as active and sync Resume.yaml_content."""
        resume = await self.get_resume_by_id(db, resume_id)

        target_version = None
        for v in resume.versions:
            if v.id == version_id:
                target_version = v
                v.is_active = True
                # Clear PDF cache for the newly active version — its "active" PDF
                # path is resume_{id}.pdf which needs to be re-rendered fresh.
                v.pdf_path = None
                v.pdf_rendered_at = None
            else:
                v.is_active = False

        if not target_version:
            raise HTTPException(status_code=404, detail="Version not found")

        resume.yaml_content = target_version.yaml_content
        resume.current_version = target_version.version_number
        await db.commit()
        return await self.get_resume_by_id(db, str(resume.id))

    async def update_resume(self, db: AsyncSession, resume_id: str, resume_update: ResumeUpdate) -> Resume:
        """Legacy update — updates yaml_content only (no version creation for auto-save)."""
        resume = await self.get_resume_by_id(db, resume_id)
        resume.yaml_content = resume_update.yaml_content
        await db.commit()
        await db.refresh(resume)
        return resume

    async def get_version(self, db: AsyncSession, resume_id: str, version: int) -> ResumeVersion:
        stmt = select(ResumeVersion).where(
            ResumeVersion.resume_id == resume_id,
            ResumeVersion.version_number == version
        )
        result = await db.execute(stmt)
        version_obj = result.scalar_one_or_none()
        if not version_obj:
            raise HTTPException(status_code=404, detail="Version not found")
        return version_obj

    async def delete_version(self, db: AsyncSession, resume_id: str, version_id: str) -> tuple[str | None, int | None]:
        """Delete a non-active version. Returns (pdf_path, version_number) for file cleanup by the caller."""
        resume = await self.get_resume_by_id(db, resume_id)
        target = next((v for v in resume.versions if v.id == version_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Version not found")
        if target.is_active:
            raise HTTPException(status_code=400, detail="Cannot delete the active version")
        if len(resume.versions) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the only version")
        pdf_path = target.pdf_path
        version_number = target.version_number
        await db.delete(target)
        await db.commit()
        return pdf_path, version_number

    async def tailor_resume(self, db: AsyncSession, resume_id: str) -> Resume:
        """Tailors the resume using the LLM. Creates a new version with source=ai_tailored."""
        stmt = select(Resume).where(Resume.id == resume_id).options(
            selectinload(Resume.application)
        )
        result = await db.execute(stmt)
        resume = result.scalar_one_or_none()

        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        if not resume.application or not resume.application.job_description:
            raise HTTPException(status_code=400, detail="Associated Application has no Job Description")

        # Fetch tailor rules for this application
        from app.services.tailor_rule_service import tailor_rule_service
        rules = await tailor_rule_service.get_enabled_rule_texts(
            db, application_id=resume.application.id
        )

        original_yaml = resume.yaml_content
        job_description = resume.application.job_description

        from app.services.prompts import get_active_prompt
        active_system_prompt = await get_active_prompt(db, "resume_tailoring")

        tailored_yaml = await tailor_service.tailor_resume(
            original_yaml, job_description, rules=rules, system_prompt=active_system_prompt
        )

        # Deactivate all existing versions
        versions_stmt = select(ResumeVersion).where(ResumeVersion.resume_id == resume.id)
        versions_result = await db.execute(versions_stmt)
        for v in versions_result.scalars().all():
            v.is_active = False

        resume.yaml_content = tailored_yaml
        resume.current_version += 1

        new_version = ResumeVersion(
            resume_id=resume.id,
            version_number=resume.current_version,
            yaml_content=tailored_yaml,
            change_summary="AI Tailored based on Job Description",
            source=VersionSource.AI_TAILORED,
            is_active=True,
            label=self._generate_label(VersionSource.AI_TAILORED, resume.current_version)
        )

        db.add(new_version)
        await db.commit()
        await db.refresh(resume)

        return await self.get_resume_by_id(db, str(resume.id))

resume_service = ResumeService()
