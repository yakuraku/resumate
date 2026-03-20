from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models import Application
from app.schemas.application import ApplicationCreate, ApplicationUpdate
from typing import Optional, List, Tuple
from fastapi import HTTPException
from datetime import date, timedelta

class ApplicationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _auto_ghost_stale_applications(self) -> None:
        """
        Automatically mark 'applied' applications as 'ghosted' if applied_date
        is more than 30 days in the past.
        """
        cutoff = date.today() - timedelta(days=30)
        stale_query = (
            select(Application)
            .where(Application.status == "applied")
            .where(Application.applied_date != None)  # noqa: E711
            .where(Application.applied_date <= cutoff)
        )
        stale_result = await self.db.execute(stale_query)
        stale_apps = stale_result.scalars().all()
        for app in stale_apps:
            app.status = "ghosted"
        if stale_apps:
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

    async def delete(self, id: str) -> bool:
        app = await self.get(id)
        if not app:
            return False

        await self.db.delete(app)
        await self.db.commit()
        return True

    async def update_application_status(self, id: str, status: str) -> Optional[Application]:
        """
        Update the status of an application.
        When transitioning to 'applied', take a snapshot of the linked resume template's
        yaml_content into resume_snapshot_yaml (if not already set).
        """
        app = await self.get(id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        valid_statuses = {"draft", "applied", "interviewing", "offer", "rejected", "ghosted"}
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
