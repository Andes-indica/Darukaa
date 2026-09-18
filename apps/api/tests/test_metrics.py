from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.main import app
from tests.test_projects import auth_headers, register_user

pytestmark = pytest.mark.usefixtures("override_database")


async def create_project_and_site(client: AsyncClient, token: str, db_session) -> tuple[str, str]:
    project_response = await client.post(
        "/api/v1/projects",
        headers=auth_headers(token),
        json={"name": "Measured Forest", "project_type": "mixed", "status": "active"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    site_id = str(uuid4())
    await db_session.execute(
        text("INSERT INTO sites (id, project_id, name) VALUES (:id, :project_id, :name)"),
        {
            "id": site_id.replace("-", ""),
            "project_id": project_id.replace("-", ""),
            "name": "North Ridge",
        },
    )
    await db_session.commit()
    return project_id, site_id


@pytest.mark.asyncio
async def test_metric_flow_and_analytics(db_session) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await register_user(client, "metrics@example.com")
        headers = auth_headers(token)
        project_id, site_id = await create_project_and_site(client, token, db_session)
        metric_url = f"/api/v1/projects/{project_id}/sites/{site_id}/metrics"

        first = await client.post(
            metric_url,
            headers=headers,
            json={
                "metric_type": "vegetation_cover",
                "value": 61.25,
                "observed_at": "2026-01-01T09:00:00Z",
                "source": " Sentinel-2 ",
            },
        )
        second = await client.post(
            metric_url,
            headers=headers,
            json={
                "metric_type": "vegetation_cover",
                "value": 73.5,
                "observed_at": "2026-02-01T09:00:00Z",
                "source": "Sentinel-2",
            },
        )
        carbon = await client.post(
            metric_url,
            headers=headers,
            json={
                "metric_type": "carbon_tonnes",
                "value": 1450,
                "observed_at": "2026-02-01T09:00:00+00:00",
            },
        )

        assert first.status_code == 201
        assert first.json()["unit"] == "%"
        assert first.json()["source"] == "Sentinel-2"
        assert second.status_code == 201
        assert carbon.status_code == 201
        assert carbon.json()["unit"] == "tCO₂e"

        filtered = await client.get(
            metric_url,
            headers=headers,
            params={"metric_type": "vegetation_cover"},
        )
        assert filtered.status_code == 200
        assert filtered.json()["total"] == 2

        analytics = await client.get(f"{metric_url}/analytics", headers=headers)
        assert analytics.status_code == 200
        payload = analytics.json()
        assert payload["site_name"] == "North Ridge"
        assert payload["total_observations"] == 3
        vegetation = next(
            series for series in payload["series"] if series["metric_type"] == "vegetation_cover"
        )
        assert vegetation["observations"] == 2
        assert vegetation["latest_value"] == "73.500000"
        assert vegetation["change_absolute"] == "12.250000"
        assert vegetation["change_percent"] == "20.00"

        duplicate = await client.post(
            metric_url,
            headers=headers,
            json={
                "metric_type": "vegetation_cover",
                "value": 70,
                "observed_at": "2026-02-01T09:00:00Z",
            },
        )
        assert duplicate.status_code == 409

        deleted = await client.delete(f"{metric_url}/{first.json()['id']}", headers=headers)
        assert deleted.status_code == 204
        remaining = await client.get(metric_url, headers=headers)
        assert remaining.json()["total"] == 2


@pytest.mark.asyncio
async def test_metrics_require_site_ownership_and_valid_input(db_session) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        owner_token = await register_user(client, "metric-owner@example.com")
        other_token = await register_user(client, "metric-other@example.com")
        project_id, site_id = await create_project_and_site(client, owner_token, db_session)
        metric_url = f"/api/v1/projects/{project_id}/sites/{site_id}/metrics"

        forbidden = await client.get(metric_url, headers=auth_headers(other_token))
        naive_time = await client.post(
            metric_url,
            headers=auth_headers(owner_token),
            json={
                "metric_type": "biodiversity_index",
                "value": 42,
                "observed_at": "2026-01-01T09:00:00",
            },
        )
        negative = await client.post(
            metric_url,
            headers=auth_headers(owner_token),
            json={
                "metric_type": "carbon_tonnes",
                "value": -1,
                "observed_at": "2026-01-01T09:00:00Z",
            },
        )
        invalid_percentage = await client.post(
            metric_url,
            headers=auth_headers(owner_token),
            json={
                "metric_type": "vegetation_cover",
                "value": 101,
                "observed_at": "2026-01-01T09:00:00Z",
            },
        )

    assert forbidden.status_code == 404
    assert naive_time.status_code == 422
    assert negative.status_code == 422
    assert invalid_percentage.status_code == 422
