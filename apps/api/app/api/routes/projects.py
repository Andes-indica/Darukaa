from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select

from app.api.dependencies import CurrentUser, SessionDependency
from app.models import Project, Site
from app.models.enums import ProjectStatus, ProjectType
from app.schemas.project import ProjectCreate, ProjectListResponse, ProjectPublic, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def serialize_project(project: Project, site_count: int = 0) -> ProjectPublic:
    return ProjectPublic.model_validate(project).model_copy(update={"site_count": site_count})


async def get_site_count(project_id: UUID, session: SessionDependency) -> int:
    count = await session.scalar(select(func.count(Site.id)).where(Site.project_id == project_id))
    return count or 0


async def get_owned_project(
    project_id: UUID,
    owner_id: UUID,
    session: SessionDependency,
) -> Project:
    project = await session.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=ProjectPublic, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = Project(owner_id=current_user.id, **payload.model_dump())
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return serialize_project(project)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    session: SessionDependency,
    current_user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    project_status: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    project_type: ProjectType | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> ProjectListResponse:
    filters = [Project.owner_id == current_user.id]
    if project_status:
        filters.append(Project.status == project_status)
    if project_type:
        filters.append(Project.project_type == project_type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Project.name.ilike(term), Project.description.ilike(term)))

    total = await session.scalar(select(func.count(Project.id)).where(*filters))
    site_count = (
        select(func.count(Site.id))
        .where(Site.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )
    result = await session.execute(
        select(Project, site_count.label("site_count"))
        .where(*filters)
        .order_by(Project.updated_at.desc(), Project.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    projects = [serialize_project(project, count) for project, count in result.all()]
    return ProjectListResponse.build(projects, total or 0, page, page_size)


@router.get("/{project_id}", response_model=ProjectPublic)
async def read_project(
    project_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = await get_owned_project(project_id, current_user.id, session)
    return serialize_project(project, await get_site_count(project.id, session))


@router.patch("/{project_id}", response_model=ProjectPublic)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = await get_owned_project(project_id, current_user.id, session)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(project, field, value)

    if project.start_date and project.end_date and project.end_date < project.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="end_date must be on or after start_date",
        )

    await session.commit()
    await session.refresh(project)
    return serialize_project(project, await get_site_count(project.id, session))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> Response:
    project = await get_owned_project(project_id, current_user.id, session)
    await session.delete(project)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
