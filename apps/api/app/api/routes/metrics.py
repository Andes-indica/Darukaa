from collections import defaultdict
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, SessionDependency
from app.api.routes.projects import get_owned_project
from app.models import Site, SiteMetric
from app.models.enums import MetricType
from app.schemas.metric import (
    MetricSeriesSummary,
    SiteAnalyticsResponse,
    SiteMetricCreate,
    SiteMetricListResponse,
    SiteMetricPublic,
)

router = APIRouter(
    prefix="/projects/{project_id}/sites/{site_id}/metrics",
    tags=["site metrics"],
)

METRIC_UNITS = {
    MetricType.CARBON_TONNES: "tCO₂e",
    MetricType.BIODIVERSITY_INDEX: "index",
    MetricType.VEGETATION_COVER: "%",
}


async def get_owned_site_name(
    project_id: UUID,
    site_id: UUID,
    current_user: CurrentUser,
    session: SessionDependency,
) -> str:
    await get_owned_project(project_id, current_user.id, session)
    site_name = await session.scalar(
        select(Site.name).where(Site.id == site_id, Site.project_id == project_id)
    )
    if site_name is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site_name


@router.post("", response_model=SiteMetricPublic, status_code=status.HTTP_201_CREATED)
async def create_site_metric(
    project_id: UUID,
    site_id: UUID,
    payload: SiteMetricCreate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SiteMetric:
    await get_owned_site_name(project_id, site_id, current_user, session)
    metric = SiteMetric(
        site_id=site_id,
        metric_type=payload.metric_type,
        value=payload.value,
        unit=METRIC_UNITS[payload.metric_type],
        observed_at=payload.observed_at,
        source=payload.source,
    )
    session.add(metric)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An observation of this metric already exists at that time",
        ) from exc
    await session.refresh(metric)
    return metric


@router.get("", response_model=SiteMetricListResponse)
async def list_site_metrics(
    project_id: UUID,
    site_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
    metric_type: Annotated[MetricType | None, Query()] = None,
) -> SiteMetricListResponse:
    await get_owned_site_name(project_id, site_id, current_user, session)
    query = select(SiteMetric).where(SiteMetric.site_id == site_id)
    if metric_type is not None:
        query = query.where(SiteMetric.metric_type == metric_type)
    result = await session.scalars(query.order_by(SiteMetric.observed_at, SiteMetric.id))
    items = list(result.all())
    return SiteMetricListResponse(items=items, total=len(items))


@router.get("/analytics", response_model=SiteAnalyticsResponse)
async def read_site_analytics(
    project_id: UUID,
    site_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> SiteAnalyticsResponse:
    site_name = await get_owned_site_name(project_id, site_id, current_user, session)
    result = await session.scalars(
        select(SiteMetric)
        .where(SiteMetric.site_id == site_id)
        .order_by(SiteMetric.metric_type, SiteMetric.observed_at, SiteMetric.id)
    )
    metrics = list(result.all())
    grouped: dict[MetricType, list[SiteMetric]] = defaultdict(list)
    for metric in metrics:
        grouped[metric.metric_type].append(metric)

    series: list[MetricSeriesSummary] = []
    for metric_type in MetricType:
        points = grouped.get(metric_type, [])
        if not points:
            continue
        values = [point.value for point in points]
        latest = points[-1]
        previous = points[-2] if len(points) > 1 else None
        change_absolute = latest.value - previous.value if previous else None
        change_percent = None
        if previous and previous.value != 0:
            change_percent = (
                (latest.value - previous.value) / abs(previous.value) * Decimal("100")
            ).quantize(Decimal("0.01"))
        series.append(
            MetricSeriesSummary(
                metric_type=metric_type,
                unit=METRIC_UNITS[metric_type],
                observations=len(points),
                latest_value=latest.value,
                latest_observed_at=latest.observed_at,
                previous_value=previous.value if previous else None,
                change_absolute=change_absolute,
                change_percent=change_percent,
                minimum=min(values),
                maximum=max(values),
                average=sum(values, start=Decimal("0")) / len(values),
                points=points,
            )
        )

    return SiteAnalyticsResponse(
        site_id=site_id,
        site_name=site_name,
        total_observations=len(metrics),
        series=series,
    )


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site_metric(
    project_id: UUID,
    site_id: UUID,
    metric_id: UUID,
    session: SessionDependency,
    current_user: CurrentUser,
) -> Response:
    await get_owned_site_name(project_id, site_id, current_user, session)
    metric = await session.scalar(
        select(SiteMetric).where(SiteMetric.id == metric_id, SiteMetric.site_id == site_id)
    )
    if metric is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metric not found")
    await session.delete(metric)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
