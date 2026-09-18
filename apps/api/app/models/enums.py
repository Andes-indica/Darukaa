from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "admin"
    ANALYST = "analyst"


class ProjectType(StrEnum):
    CARBON = "carbon"
    BIODIVERSITY = "biodiversity"
    MIXED = "mixed"


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"


class SiteStatus(StrEnum):
    PLANNED = "planned"
    MONITORED = "monitored"
    ARCHIVED = "archived"


class MetricType(StrEnum):
    CARBON_TONNES = "carbon_tonnes"
    BIODIVERSITY_INDEX = "biodiversity_index"
    VEGETATION_COVER = "vegetation_cover"
