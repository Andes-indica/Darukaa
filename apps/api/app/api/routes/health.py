from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text

from app.db import async_session_factory

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


class DatabaseHealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["connected"]
    postgis_version: str


@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="darukaa-api")


@router.get("/database", response_model=DatabaseHealthResponse)
async def database_health_check() -> DatabaseHealthResponse:
    try:
        async with async_session_factory() as session:
            version = await session.scalar(text("SELECT PostGIS_Version()"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from exc

    return DatabaseHealthResponse(
        status="ok",
        database="connected",
        postgis_version=str(version),
    )
