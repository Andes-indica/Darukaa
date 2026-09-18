import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SiteStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.site_metric import SiteMetric


class Site(TimestampMixin, Base):
    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    boundary: Mapped[object] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=False,
    )
    area_hectares: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    status: Mapped[SiteStatus] = mapped_column(
        Enum(
            SiteStatus,
            name="site_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=SiteStatus.PLANNED,
        nullable=False,
    )

    project: Mapped["Project"] = relationship(back_populates="sites")
    metrics: Mapped[list["SiteMetric"]] = relationship(
        back_populates="site",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
