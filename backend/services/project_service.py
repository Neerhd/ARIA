"""Project resolution helpers shared by the chat pipeline and the migration script."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.schemas import Project

DEFAULT_PROJECT_NAME = "Default"


async def get_or_create_default_project(db: AsyncSession) -> str:
    """Return the id of the 'Default' project, creating it if it doesn't exist yet."""
    result = await db.execute(select(Project).where(Project.name == DEFAULT_PROJECT_NAME))
    project = result.scalar_one_or_none()
    if project:
        return project.id

    project = Project(name=DEFAULT_PROJECT_NAME, description="Default project for pre-existing conversations")
    db.add(project)
    await db.flush()
    return project.id
