import json
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, SessionDependency
from app.api.routes.projects import get_owned_project
from app.models import Site
from app.schemas.site import SiteCreate, SiteListResponse, SitePublic, SiteUpdate

router = APIRouter(prefix="/projects/{project_id}/sites", tags=["sites"])


def serialize_site(site: Site, boundary_json: str) -> SitePublic:
    return SitePublic(
        id=site.id,
        project_id=site.project_id,
        name=site.name,
        description=site.description,
        boundary=json.loads(boundary_json),
        area_hectares=site.area_hectares,
        status=site.status,
        created_at=site.created_at,
        updated_at=site.updated_at,
    )


async def load_site(
    project_id: UUID,
    site_id: UUID,
    session: SessionDependency,
) -> tuple[Site, str]:
    result = await session.execute(
        select(Site, func.ST_AsGeoJSON(Site.boundary))
        .where(Site.id == site_id, Site.project_id == project_id)
        .limit(1)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return row[0], row[1]


async def recalculate_area(site: Site, session: SessionDependency) -> None:
    await session.flush()
    area = await session.scalar(
        select(func.ST_Area(func.ST_Transform(Site.boundary, 6933)) / 10_000).where(
            Site.id == site.id
        )
    )
    site.area_hectares = Decimal(str(area)) if area is not None else None


@router.post("", response_model=SitePublic, status_code=status.HTTP_201_CREATED)
async def create_site(
    project_id: UUID,
    payload: SiteCreate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SitePublic:
    await get_owned_project(project_id, current_user.id, session)
    site = Site(
        project_id=project_id,
        name=payload.name.strip(),
        description=payload.description,
        boundary=WKTElement(payload.boundary.to_polygon().wkt, srid=4326),
        status=payload.status,
    )
    session.add(site)
    await recalculate_area(site, session)
    await session.commit()
    stored_site, boundary_json = await load_site(project_id, site.id, session)
    return serialize_site(stored_site, boundary_json)


@router.get("", response_model=SiteListResponse)
async def list_sites(
    project_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SiteListResponse:
    await get_owned_project(project_id, current_user.id, session)
    result = await session.execute(
        select(Site, func.ST_AsGeoJSON(Site.boundary))
        .where(Site.project_id == project_id)
        .order_by(Site.updated_at.desc(), Site.id)
    )
    items = [serialize_site(site, boundary_json) for site, boundary_json in result.all()]
    return SiteListResponse(items=items, total=len(items))


@router.get("/{site_id}", response_model=SitePublic)
async def read_site(
    project_id: UUID,
    site_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SitePublic:
    await get_owned_project(project_id, current_user.id, session)
    site, boundary_json = await load_site(project_id, site_id, session)
    return serialize_site(site, boundary_json)


@router.patch("/{site_id}", response_model=SitePublic)
async def update_site(
    project_id: UUID,
    site_id: UUID,
    payload: SiteUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SitePublic:
    await get_owned_project(project_id, current_user.id, session)
    site, _ = await load_site(project_id, site_id, session)
    updates = payload.model_dump(exclude_unset=True, exclude={"boundary"})
    for field, value in updates.items():
        setattr(site, field, value.strip() if field == "name" else value)

    if "boundary" in payload.model_fields_set and payload.boundary is not None:
        site.boundary = WKTElement(payload.boundary.to_polygon().wkt, srid=4326)
        await recalculate_area(site, session)

    await session.commit()
    stored_site, boundary_json = await load_site(project_id, site.id, session)
    return serialize_site(stored_site, boundary_json)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    project_id: UUID,
    site_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> Response:
    await get_owned_project(project_id, current_user.id, session)
    site, _ = await load_site(project_id, site_id, session)
    await session.delete(site)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
