from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import get_db_session
from app.main import app
from app.models import Project, User


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(User.__table__.create)
        await connection.run_sync(Project.__table__.create)
        await connection.execute(
            text(
                "CREATE TABLE sites ("
                "id CHAR(32) PRIMARY KEY, "
                "project_id CHAR(32) NOT NULL REFERENCES projects(id) ON DELETE CASCADE, "
                "name VARCHAR(160) NOT NULL"
                ")"
            )
        )
        await connection.execute(
            text(
                "CREATE TABLE site_metrics ("
                "id CHAR(32) PRIMARY KEY, "
                "site_id CHAR(32) NOT NULL REFERENCES sites(id) ON DELETE CASCADE, "
                "metric_type VARCHAR(40) NOT NULL, "
                "value NUMERIC(18, 6) NOT NULL, "
                "unit VARCHAR(40) NOT NULL, "
                "observed_at DATETIME NOT NULL, "
                "source VARCHAR(160), "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "CONSTRAINT uq_site_metric_observation "
                "UNIQUE (site_id, metric_type, observed_at)"
                ")"
            )
        )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def override_database(db_session: AsyncSession) -> AsyncIterator[None]:
    async def get_test_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db_session] = get_test_session
    yield
    app.dependency_overrides.clear()
