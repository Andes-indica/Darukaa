import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.usefixtures("override_database")


@pytest.fixture
def registration_payload() -> dict[str, str]:
    return {
        "email": "admin@example.com",
        "full_name": "Project Administrator",
        "password": "secure-password-123",
    }


@pytest.mark.asyncio
async def test_register_login_and_read_profile(registration_payload: dict[str, str]) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        register_response = await client.post("/api/v1/auth/register", json=registration_payload)
        assert register_response.status_code == 201
        register_body = register_response.json()
        assert register_body["token_type"] == "bearer"
        assert register_body["user"]["email"] == registration_payload["email"]
        assert register_body["user"]["role"] == "admin"
        assert "password_hash" not in register_body["user"]

        login_response = await client.post(
            "/api/v1/auth/login",
            data={
                "username": registration_payload["email"],
                "password": registration_payload["password"],
            },
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]

        profile_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert profile_response.status_code == 200
        assert profile_response.json()["full_name"] == registration_payload["full_name"]


@pytest.mark.asyncio
async def test_duplicate_registration_returns_conflict(
    registration_payload: dict[str, str],
) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first_response = await client.post("/api/v1/auth/register", json=registration_payload)
        second_response = await client.post("/api/v1/auth/register", json=registration_payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


@pytest.mark.asyncio
async def test_incorrect_password_and_missing_token_are_rejected(
    registration_payload: dict[str, str],
) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json=registration_payload)
        login_response = await client.post(
            "/api/v1/auth/login",
            data={"username": registration_payload["email"], "password": "wrong-password"},
        )
        profile_response = await client.get("/api/v1/auth/me")

    assert login_response.status_code == 401
    assert profile_response.status_code == 401
