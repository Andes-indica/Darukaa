from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.usefixtures("override_database")


async def register_user(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "Project Owner",
            "password": "secure-password-123",
        },
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_project_crud_flow() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await register_user(client, "owner@example.com")
        headers = auth_headers(token)

        create_response = await client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "Western Ghats Rewilding",
                "description": "Habitat restoration and biodiversity monitoring",
                "project_type": "biodiversity",
                "status": "active",
                "start_date": "2026-01-15",
            },
        )
        assert create_response.status_code == 201
        project = create_response.json()
        project_id = project["id"]
        assert project["site_count"] == 0

        list_response = await client.get("/api/v1/projects", headers=headers)
        assert list_response.status_code == 200
        assert list_response.json()["total"] == 1
        assert list_response.json()["items"][0]["name"] == project["name"]

        update_response = await client.patch(
            f"/api/v1/projects/{project_id}",
            headers=headers,
            json={"name": "Western Ghats Landscape", "status": "completed"},
        )
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Western Ghats Landscape"
        assert update_response.json()["status"] == "completed"

        delete_response = await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
        assert delete_response.status_code == 204

        missing_response = await client.get(f"/api/v1/projects/{project_id}", headers=headers)
        assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_projects_are_private_to_their_owner() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        owner_token = await register_user(client, "first-owner@example.com")
        other_token = await register_user(client, "second-owner@example.com")

        create_response = await client.post(
            "/api/v1/projects",
            headers=auth_headers(owner_token),
            json={"name": "Private Carbon Project", "project_type": "carbon"},
        )
        project_id = create_response.json()["id"]

        other_list = await client.get(
            "/api/v1/projects",
            headers=auth_headers(other_token),
        )
        other_read = await client.get(
            f"/api/v1/projects/{project_id}",
            headers=auth_headers(other_token),
        )
        other_update = await client.patch(
            f"/api/v1/projects/{project_id}",
            headers=auth_headers(other_token),
            json={"name": "Unauthorized rename"},
        )
        other_delete = await client.delete(
            f"/api/v1/projects/{project_id}",
            headers=auth_headers(other_token),
        )

    assert other_list.json()["total"] == 0
    assert other_read.status_code == 404
    assert other_update.status_code == 404
    assert other_delete.status_code == 404


@pytest.mark.asyncio
async def test_project_filters_pagination_and_date_validation() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await register_user(client, "filters@example.com")
        headers = auth_headers(token)

        for index in range(3):
            response = await client.post(
                "/api/v1/projects",
                headers=headers,
                json={
                    "name": f"Forest Project {index}",
                    "project_type": "carbon" if index < 2 else "biodiversity",
                    "status": "active" if index != 1 else "draft",
                },
            )
            assert response.status_code == 201

        filtered = await client.get(
            "/api/v1/projects",
            headers=headers,
            params={"project_type": "carbon", "status": "active", "search": "Forest"},
        )
        assert filtered.status_code == 200
        assert filtered.json()["total"] == 1

        paginated = await client.get(
            "/api/v1/projects",
            headers=headers,
            params={"page": 2, "page_size": 2},
        )
        assert paginated.json()["total"] == 3
        assert paginated.json()["pages"] == 2
        assert len(paginated.json()["items"]) == 1

        invalid_dates = await client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "Invalid Timeline",
                "project_type": "mixed",
                "start_date": date(2026, 5, 1).isoformat(),
                "end_date": date(2026, 4, 1).isoformat(),
            },
        )
        assert invalid_dates.status_code == 422

        invalid_update = await client.patch(
            f"/api/v1/projects/{paginated.json()['items'][0]['id']}",
            headers=headers,
            json={"name": None},
        )
        assert invalid_update.status_code == 422
