from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from shapely.geometry import Polygon, shape
from shapely.validation import explain_validity

from app.models.enums import SiteStatus

Position = tuple[float, float]


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[Position]]

    @model_validator(mode="after")
    def validate_polygon(self) -> "PolygonGeometry":
        if not self.coordinates:
            raise ValueError("A polygon requires an exterior ring")

        for ring in self.coordinates:
            if len(ring) < 4:
                raise ValueError("Each polygon ring requires at least four positions")
            if ring[0] != ring[-1]:
                raise ValueError("Each polygon ring must be closed")
            for longitude, latitude in ring:
                if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                    raise ValueError("Polygon coordinates are outside WGS84 bounds")

        geometry = shape(self.model_dump())
        if not isinstance(geometry, Polygon) or geometry.is_empty or geometry.area == 0:
            raise ValueError("Polygon must enclose a non-zero area")
        if not geometry.is_valid:
            raise ValueError(f"Invalid polygon: {explain_validity(geometry)}")
        return self

    def to_polygon(self) -> Polygon:
        return shape(self.model_dump())


class SiteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    boundary: PolygonGeometry
    status: SiteStatus = SiteStatus.PLANNED


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    boundary: PolygonGeometry | None = None
    status: SiteStatus | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "SiteUpdate":
        for field in ("name", "boundary", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class SitePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str | None
    boundary: PolygonGeometry
    area_hectares: Decimal | None
    status: SiteStatus
    created_at: datetime
    updated_at: datetime


class SiteListResponse(BaseModel):
    items: list[SitePublic]
    total: int
