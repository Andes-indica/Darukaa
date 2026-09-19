from functools import lru_cache
from json import loads
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Darukaa.Earth API"
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://darukaa:darukaa@localhost:5432/darukaa"
    jwt_secret: str = "development-only-secret-change-before-deploying"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            normalized_value = value.strip()
            if normalized_value.startswith("["):
                decoded_value = loads(normalized_value)
                if not isinstance(decoded_value, list):
                    raise ValueError("CORS_ORIGINS JSON value must be a list")
                value = decoded_value
            else:
                value = normalized_value.split(",")
        if isinstance(value, list):
            return [origin.strip() for origin in value if origin.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def use_async_postgres_driver(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.app_env.lower() in {"production", "prod"} and (
            self.jwt_secret == "development-only-secret-change-before-deploying"
            or len(self.jwt_secret) < 32
        ):
            raise ValueError("Production requires a unique JWT_SECRET of at least 32 characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
