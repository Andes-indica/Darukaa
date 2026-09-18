import pytest
from pydantic import ValidationError

from app.schemas.site import PolygonGeometry, SiteCreate


def valid_polygon() -> dict[str, object]:
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [75.0, 15.0],
                [75.1, 15.0],
                [75.1, 15.1],
                [75.0, 15.1],
                [75.0, 15.0],
            ]
        ],
    }


def test_accepts_valid_wgs84_polygon() -> None:
    site = SiteCreate(name="Restoration plot", boundary=valid_polygon())

    assert site.boundary.type == "Polygon"
    assert site.boundary.to_polygon().is_valid


@pytest.mark.parametrize(
    "coordinates",
    [
        [[[75.0, 15.0], [75.1, 15.0], [75.1, 15.1], [75.0, 15.1]]],
        [[[181.0, 15.0], [181.1, 15.0], [181.1, 15.1], [181.0, 15.0]]],
        [[[75.0, 15.0], [75.1, 15.1], [75.1, 15.0], [75.0, 15.1], [75.0, 15.0]]],
    ],
)
def test_rejects_open_out_of_range_or_self_intersecting_polygons(
    coordinates: list[list[list[float]]],
) -> None:
    with pytest.raises(ValidationError):
        PolygonGeometry(type="Polygon", coordinates=coordinates)
