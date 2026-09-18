from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import MetricType


class SiteMetricCreate(BaseModel):
    metric_type: MetricType
    value: Decimal = Field(ge=0, max_digits=18, decimal_places=6)
    observed_at: datetime
    source: str | None = Field(default=None, max_length=160)

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        return value

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validate_metric_range(self) -> "SiteMetricCreate":
        if self.metric_type == MetricType.VEGETATION_COVER and self.value > 100:
            raise ValueError("vegetation_cover cannot exceed 100%")
        return self


class SiteMetricPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_id: UUID
    metric_type: MetricType
    value: Decimal
    unit: str
    observed_at: datetime
    source: str | None
    created_at: datetime
    updated_at: datetime


class SiteMetricListResponse(BaseModel):
    items: list[SiteMetricPublic]
    total: int


class MetricSeriesSummary(BaseModel):
    metric_type: MetricType
    unit: str
    observations: int
    latest_value: Decimal
    latest_observed_at: datetime
    previous_value: Decimal | None
    change_absolute: Decimal | None
    change_percent: Decimal | None
    minimum: Decimal
    maximum: Decimal
    average: Decimal
    points: list[SiteMetricPublic]


class SiteAnalyticsResponse(BaseModel):
    site_id: UUID
    site_name: str
    total_observations: int
    series: list[MetricSeriesSummary]
