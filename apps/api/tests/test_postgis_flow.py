import os
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        not os.getenv("TEST_DATABASE_URL"),
        reason="TEST_DATABASE_URL is required for the PostGIS integration flow",
    ),
]


async def test_complete_project_site_and_analytics_flow() -> None:
    transport = ASGITransport(app=app)
    email = f"integration-{uuid4()}@example.com"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        registration = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "full_name": "Integration Owner",
                "password": "secure-password-123",
            },
        )
        assert registration.status_code == 201
        headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

        project_response = await client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "PostGIS Integration Project",
                "project_type": "mixed",
                "status": "active",
            },
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        site_response = await client.post(
            f"/api/v1/projects/{project_id}/sites",
            headers=headers,
            json={
                "name": "Integration Forest",
                "status": "monitored",
                "boundary": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [75.0, 15.0],
                            [75.01, 15.0],
                            [75.01, 15.01],
                            [75.0, 15.01],
                            [75.0, 15.0],
                        ]
                    ],
                },
            },
        )
        assert site_response.status_code == 201
        site = site_response.json()
        site_id = site["id"]
        assert site["boundary"]["type"] == "Polygon"
        assert 100 < float(site["area_hectares"]) < 130

        metric_url = f"/api/v1/projects/{project_id}/sites/{site_id}/metrics"
        for value, observed_at in (
            (48.5, "2026-01-01T08:00:00Z"),
            (57.25, "2026-02-01T08:00:00Z"),
        ):
            metric_response = await client.post(
                metric_url,
                headers=headers,
                json={
                    "metric_type": "vegetation_cover",
                    "value": value,
                    "observed_at": observed_at,
                    "source": "PostGIS integration test",
                },
            )
            assert metric_response.status_code == 201

        analytics_response = await client.get(f"{metric_url}/analytics", headers=headers)
        assert analytics_response.status_code == 200
        analytics = analytics_response.json()
        assert analytics["total_observations"] == 2
        assert analytics["series"][0]["latest_value"] == "57.250000"

        database_health = await client.get("/api/v1/health/database")
        assert database_health.status_code == 200
        assert database_health.json()["database"] == "connected"

        delete_response = await client.delete(
            f"/api/v1/projects/{project_id}",
            headers=headers,
        )
        assert delete_response.status_code == 204
