import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import MetricType

if TYPE_CHECKING:
    from app.models.site import Site


class SiteMetric(TimestampMixin, Base):
    __tablename__ = "site_metrics"
    __table_args__ = (
        UniqueConstraint(
            "site_id",
            "metric_type",
            "observed_at",
            name="uq_site_metric_observation",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("sites.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    metric_type: Mapped[MetricType] = mapped_column(
        Enum(
            MetricType,
            name="metric_type",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    value: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    source: Mapped[str | None] = mapped_column(String(160))

    site: Mapped["Site"] = relationship(back_populates="metrics")
