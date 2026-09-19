import pytest
from pydantic import ValidationError

from app.core.config import Settings


@pytest.mark.parametrize(
    ("raw_origins", "expected_origins"),
    [
        ("http://localhost:5173", ["http://localhost:5173"]),
        (
            "http://localhost:5173, https://darukaa.example.com",
            ["http://localhost:5173", "https://darukaa.example.com"],
        ),
        (
            '["http://localhost:5173", "https://darukaa.example.com"]',
            ["http://localhost:5173", "https://darukaa.example.com"],
        ),
    ],
)
def test_cors_origins_accept_common_environment_formats(
    raw_origins: str, expected_origins: list[str]
) -> None:
    settings = Settings(cors_origins=raw_origins, _env_file=None)

    assert settings.cors_origins == expected_origins


def test_render_postgres_url_uses_asyncpg_driver() -> None:
    settings = Settings(
        database_url="postgresql://user:password@database.internal:5432/darukaa",
        _env_file=None,
    )

    assert settings.database_url == (
        "postgresql+asyncpg://user:password@database.internal:5432/darukaa"
    )


def test_explicit_async_database_url_is_preserved() -> None:
    database_url = "postgresql+asyncpg://darukaa:darukaa@localhost:5432/darukaa"
    settings = Settings(database_url=database_url, _env_file=None)

    assert settings.database_url == database_url


def test_production_rejects_development_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="Production requires a unique JWT_SECRET"):
        Settings(
            app_env="production",
            jwt_secret="development-only-secret-change-before-deploying",
            _env_file=None,
        )


def test_production_accepts_generated_jwt_secret() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret="render-generated-secret-with-more-than-32-characters",
        _env_file=None,
    )

    assert settings.app_env == "production"
