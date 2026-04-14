from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from app.models import Application
from app.models.resume import Resume, ResumeVersion
from app.models.resume_template import ResumeTemplate
from app.schemas.application import ApplicationCreate, ApplicationUpdate
from typing import Optional, List, Tuple
from fastapi import HTTPException
from datetime import date, datetime, timedelta, timezone
import uuid

class ApplicationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _auto_ghost_stale_applications(self) -> None:
        """
        Automatically mark stale applications as 'ghosted'.

        Timer baseline per app (fallback chain):
          1. status_changed_at  — set on every manual or auto status transition
          2. applied_date       — legacy fallback for apps created before status_changed_at existed
          3. created_at         — final fallback so no app is ever immune (even without applied_date)

        Thresholds (configurable in Settings → General → Application Pipeline):
          - 'applied'      → ghost_applied_days (default 21)
          - 'screening'    → ghost_screening_days (default 21)
          - 'interviewing' → ghost_interviewing_days (default 60)

        Apps with ghost_disabled=True are skipped.
        Draft, offer, rejected, and ghosted apps are never touched.
        """
        from app.services.settings_service import settings_service

        raw = await settings_service._get_all_raw(self.db)

        if raw.get("ghost_auto_enabled", "true").lower() != "true":
            return

        applied_days = int(raw.get("ghost_applied_days", "21"))
        screening_days = int(raw.get("ghost_screening_days", "21"))
        interviewing_days = int(raw.get("ghost_interviewing_days", "60"))

        thresholds = {
            "applied": timedelta(days=applied_days),
            "screening": timedelta(days=screening_days),
            "interviewing": timedelta(days=interviewing_days),
        }

        today = date.today()
        now = datetime.now(timezone.utc)
        any_changed = False

        for status, delta in thresholds.items():
            cutoff = today - delta

            # Fetch all non-opted-out apps in this status; Python-side date comparison
            # is fine here since volumes are small and avoids SQLite date-cast complexity.
            candidates_result = await self.db.execute(
                select(Application)
                .where(Application.status == status)
                .where(Application.ghost_disabled == False)  # noqa: E712
            )
            candidates = candidates_result.scalars().all()

            for app in candidates:
                # Determine effective baseline date (fallback chain)
                if app.status_changed_at is not None:
                    effective_date = app.status_changed_at.date()
                elif app.applied_date is not None:
                    effective_date = app.applied_date
                else:
                    effective_date = app.created_at.date()

                if effective_date <= cutoff:
                    app.status = "ghosted"
                    app.ghosted_at = now
                    app.status_changed_at = now
                    any_changed = True

        if any_changed:
            await self.db.commit()

    async def get_all(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None
    ) -> Tuple[List[Application], int]:
        # Auto-ghost stale applied applications before returning results
        await self._auto_ghost_stale_applications()

        query = select(Application)
        count_query = select(func.count()).select_from(Application)

        if status:
            query = query.where(Application.status == status)
            count_query = count_query.where(Application.status == status)

        query = query.order_by(desc(Application.updated_at))
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        count_result = await self.db.execute(count_query)

        return result.scalars().all(), count_result.scalar()

    async def create(self, data: ApplicationCreate) -> Application:
        app = Application(**data.model_dump())
        app.status_changed_at = datetime.now(timezone.utc)
        self.db.add(app)
        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def get(self, id: str) -> Optional[Application]:
        result = await self.db.execute(select(Application).where(Application.id == id))
        return result.scalars().first()

    async def update(self, id: str, data: ApplicationUpdate) -> Optional[Application]:
        app = await self.get(id)
        if not app:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(app, key, value)
            
        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def delete(self, id: str) -> Optional[str]:
        """
        Delete an application and all its owned data.

        Before deleting, checks if the application has a tailored resume
        (any version with source != 'master'). If so, saves the active
        version's YAML as a new ResumeTemplate so the user doesn't lose work.

        Returns:
            The name of the saved ResumeTemplate if one was created,
            or None if no tailored resume existed.
            Raises a ValueError if the application is not found.
        """
        # Load application with its resume and versions in one query
        result = await self.db.execute(
            select(Application)
            .where(Application.id == id)
            .options(
                selectinload(Application.resume).selectinload(Resume.versions)
            )
        )
        app = result.scalars().first()
        if not app:
            raise ValueError("Application not found")

        saved_template_name: Optional[str] = None

        # Check if there is a tailored (non-master-only) resume to preserve
        if app.resume and app.resume.versions:
            non_master_versions = [
                v for v in app.resume.versions
                if v.source != "master"
            ]
            if non_master_versions:
                # Get the YAML from the active version
                active_version = next(
                    (v for v in app.resume.versions if v.is_active), None
                ) or app.resume.versions[-1]
                yaml_to_save = active_version.yaml_content

                # Build a unique template name
                base_name = f"{app.role} at {app.company}"
                template_name = base_name
                counter = 2
                while True:
                    existing = await self.db.execute(
                        select(ResumeTemplate).where(ResumeTemplate.name == template_name)
                    )
                    if not existing.scalars().first():
                        break
                    template_name = f"{base_name} ({counter})"
                    counter += 1

                new_template = ResumeTemplate(
                    id=str(uuid.uuid4()),
                    name=template_name,
                    yaml_content=yaml_to_save,
                    is_master=False,
                    is_starred=False,
                )
                self.db.add(new_template)
                saved_template_name = template_name

        await self.db.delete(app)
        await self.db.commit()
        return saved_template_name

    async def update_application_status(self, id: str, status: str) -> Optional[Application]:
        """
        Update the status of an application.
        When transitioning to 'applied', take a snapshot of the linked resume template's
        yaml_content into resume_snapshot_yaml (if not already set).
        """
        app = await self.get(id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        valid_statuses = {"draft", "applied", "screening", "interviewing", "offer", "rejected", "ghosted"}
        if status not in valid_statuses:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status '{status}'. Must be one of: {sorted(valid_statuses)}"
            )

        # Snapshot on transition to "applied"
        if status == "applied" and app.status != "applied":
            if app.resume_template_id and not app.resume_snapshot_yaml:
                from app.models.resume_template import ResumeTemplate
                result = await self.db.execute(
                    select(ResumeTemplate).where(ResumeTemplate.id == app.resume_template_id)
                )
                template = result.scalars().first()
                if template:
                    app.resume_snapshot_yaml = template.yaml_content

        app.status = status
        app.status_changed_at = datetime.now(timezone.utc)
        # Record ghosted_at whenever an app is explicitly moved to ghosted (manual or auto).
        if status == "ghosted":
            app.ghosted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def update_color(self, id: str, color: Optional[str]) -> Optional[Application]:
        """Update color for all applications sharing the same company name."""
        app = await self.get(id)
        if not app:
            return None

        company = app.company
        result = await self.db.execute(
            select(Application).where(Application.company == company)
        )
        apps = result.scalars().all()
        for a in apps:
            a.color = color
        await self.db.commit()
        await self.db.refresh(app)
        return app

    async def update_application_resume_template(
        self, id: str, resume_template_id: Optional[str]
    ) -> Optional[Application]:
        """
        Link an application to a resume template.
        Only allowed when the application is in 'draft' status.
        """
        app = await self.get(id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        if app.status != "draft":
            raise HTTPException(
                status_code=409,
                detail="Resume template can only be changed while the application is in 'draft' status."
            )

        if resume_template_id is not None:
            from app.models.resume_template import ResumeTemplate
            result = await self.db.execute(
                select(ResumeTemplate).where(ResumeTemplate.id == resume_template_id)
            )
            if not result.scalars().first():
                raise HTTPException(status_code=404, detail="ResumeTemplate not found")

        app.resume_template_id = resume_template_id
        await self.db.commit()
        await self.db.refresh(app)
        return app
