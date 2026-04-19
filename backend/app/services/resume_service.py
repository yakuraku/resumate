from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.resume import Resume, ResumeVersion, VersionSource
from app.schemas.resume import ResumeUpdate
from app.utils.filesystem import get_master_resume_path, read_file
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

    async def create_resume(self, db: AsyncSession, application_id: str, user_id: str | None = None, clone_from_id: str = None) -> Resume:
        existing_result = await db.execute(select(Resume).where(Resume.application_id == application_id))
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Resume already exists for this application")

        yaml_content = ""
        initial_label_prefix = "Master"

        if clone_from_id:
            source_resume = await db.get(Resume, clone_from_id)
            if not source_resume:
                raise HTTPException(status_code=404, detail="Source resume not found")
            yaml_content = source_resume.yaml_content
        else:
            app_result = await db.execute(select(Application).where(Application.id == application_id))
            linked_app = app_result.scalars().first()
            if linked_app and linked_app.resume_template_id:
                from app.models.resume_template import ResumeTemplate
                tmpl_result = await db.execute(
                    select(ResumeTemplate).where(ResumeTemplate.id == linked_app.resume_template_id)
                )
                template = tmpl_result.scalars().first()
                if template and template.yaml_content:
                    yaml_content = template.yaml_content
                    if template.name and template.name.strip():
                        initial_label_prefix = template.name.strip()

            if not yaml_content:
                # Try DB-backed master resume first (cloud mode), then filesystem (local mode)
                if user_id:
                    try:
                        from app.services import text_storage_service as _tss
                        master_row = await _tss.get_master_resume(db, user_id)
                        yaml_content = master_row.yaml_content if master_row else ""
                    except Exception:
                        yaml_content = ""
                if not yaml_content:
                    master_path = get_master_resume_path()
                    try:
                        yaml_content = read_file(master_path)
                    except Exception as e:
                        yaml_content = "cv:\n  name: Your Name\n"
                        print(f"Warning: Could not read master resume: {e}")

        # IDs are Python-side defaults -- both objects can be added before the single commit
        new_resume = Resume(
            application_id=application_id,
            cloned_from_id=clone_from_id,
            yaml_content=yaml_content,
            current_version=1,
        )
        first_version = ResumeVersion(
            resume_id=new_resume.id,
            version_number=1,
            yaml_content=yaml_content,
            change_summary="Initial creation",
            source=VersionSource.MASTER,
            is_active=True,
            label=f"{initial_label_prefix} v1",
        )
        db.add(new_resume)
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

    async def get_all_resumes(self, db: AsyncSession, user_id: str) -> list[Resume]:
        stmt = (
            select(Resume)
            .join(Application, Resume.application_id == Application.id)
            .where(Application.user_id == user_id)
            .options(selectinload(Resume.versions))
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_resume_by_id(self, db: AsyncSession, resume_id: str, user_id: str | None = None) -> Resume:
        # Only load the application relationship when we need the ownership check.
        # Avoids the extra JOIN on every internal call that doesn't require it.
        opts = [selectinload(Resume.versions)]
        if user_id is not None:
            opts.append(selectinload(Resume.application))
        stmt = select(Resume).where(Resume.id == resume_id).options(*opts)
        result = await db.execute(stmt)
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        if user_id is not None and (not resume.application or resume.application.user_id != user_id):
            raise HTTPException(status_code=404, detail="Resume not found")
        return resume

    async def update_resume_yaml_content(self, db: AsyncSession, resume_id: str, yaml_content: str, user_id: str | None = None) -> Resume:
        """Auto-save: update Resume.yaml_content and active version in-place. No new version created."""
        resume = await self.get_resume_by_id(db, resume_id, user_id)
        resume.yaml_content = yaml_content
        active_version = next((v for v in resume.versions if v.is_active), None)
        if active_version:
            active_version.yaml_content = yaml_content
            active_version.pdf_path = None
            active_version.pdf_rendered_at = None
        await db.commit()
        await db.refresh(resume)
        return resume

    async def update_version_content(self, db: AsyncSession, resume_id: str, version_id: str, yaml_content: str, user_id: str | None = None) -> Resume:
        """Update a specific version's yaml_content in-place. Only the active version may be edited."""
        resume = await self.get_resume_by_id(db, resume_id, user_id)
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

    async def save_as_new_version(self, db: AsyncSession, resume_id: str, change_summary: str = "Manual save", user_id: str | None = None) -> Resume:
        """Snapshot current yaml_content as a new explicit version."""
        resume = await self.get_resume_by_id(db, resume_id, user_id)
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
            label=self._generate_label(VersionSource.MANUAL_EDIT, resume.current_version),
        )
        db.add(new_version)
        await db.commit()
        return await self.get_resume_by_id(db, str(resume.id))

    async def activate_version(self, db: AsyncSession, resume_id: str, version_id: str, user_id: str | None = None) -> Resume:
        """Set a specific version as active and sync Resume.yaml_content."""
        resume = await self.get_resume_by_id(db, resume_id, user_id)
        target_version = None
        for v in resume.versions:
            if v.id == version_id:
                target_version = v
                v.is_active = True
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
        """Legacy update -- updates yaml_content only (no version creation for auto-save)."""
        resume = await self.get_resume_by_id(db, resume_id)
        resume.yaml_content = resume_update.yaml_content
        await db.commit()
        await db.refresh(resume)
        return resume

    async def get_version(self, db: AsyncSession, resume_id: str, version: int) -> ResumeVersion:
        stmt = select(ResumeVersion).where(
            ResumeVersion.resume_id == resume_id,
            ResumeVersion.version_number == version,
        )
        result = await db.execute(stmt)
        version_obj = result.scalar_one_or_none()
        if not version_obj:
            raise HTTPException(status_code=404, detail="Version not found")
        return version_obj

    async def delete_version(self, db: AsyncSession, resume_id: str, version_id: str, user_id: str | None = None) -> tuple[str | None, int | None]:
        """Delete a non-active version. Returns (pdf_path, version_number) for storage cleanup."""
        resume = await self.get_resume_by_id(db, resume_id, user_id)
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

    async def tailor_resume(self, db: AsyncSession, resume_id: str, user_id: str | None = None) -> Resume:
        """Tailor the resume with LLM. Creates a new version with source=ai_tailored."""
        stmt = select(Resume).where(Resume.id == resume_id).options(
            selectinload(Resume.application)
        )
        result = await db.execute(stmt)
        resume = result.scalar_one_or_none()

        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        if user_id is not None and (not resume.application or resume.application.user_id != user_id):
            raise HTTPException(status_code=404, detail="Resume not found")
        if not resume.application or not resume.application.job_description:
            raise HTTPException(status_code=400, detail="Associated Application has no Job Description")

        owner_user_id = resume.application.user_id
        from app.services.tailor_rule_service import tailor_rule_service
        rules = await tailor_rule_service.get_enabled_rule_texts(
            db, owner_user_id, application_id=resume.application.id
        )

        from app.services.prompts import get_active_prompt
        active_system_prompt = await get_active_prompt(db, owner_user_id, "resume_tailoring")

        tailored_yaml = await tailor_service.tailor_resume(
            resume.yaml_content, resume.application.job_description,
            rules=rules, system_prompt=active_system_prompt,
        )

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
            label=self._generate_label(VersionSource.AI_TAILORED, resume.current_version),
        )
        db.add(new_version)
        await db.commit()
        await db.refresh(resume)

        return await self.get_resume_by_id(db, str(resume.id))


resume_service = ResumeService()
