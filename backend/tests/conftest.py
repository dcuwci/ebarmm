"""
Pytest configuration and fixtures for API tests

Uses PostgreSQL for testing since models require PostgreSQL-specific features:
- JSONB columns
- PostGIS Geometry columns
- INET type

To run tests, ensure PostgreSQL is running (via docker-compose):
    cd docker && docker-compose -f docker-compose.infrastructure.yml up -d

Then run:
    cd backend && pytest
"""

import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid
from datetime import datetime

from app.main import app
from app.core.database import Base, get_db
from app.models import User, DEO, Project
from app.core.security import create_access_token, get_password_hash


# Use PostgreSQL test database (same server, different database)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://ebarmm_app:DevPassword123@localhost:5432/ebarmm_test"
)

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test database and tables once per test session"""
    from sqlalchemy_utils import database_exists, create_database

    # Create test database if it doesn't exist
    if not database_exists(engine.url):
        create_database(engine.url)
        # Enable PostGIS extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            conn.commit()

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield

    # Cleanup after all tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(setup_test_database):
    """Create a fresh database session for each test with transaction rollback"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create test client with overridden database"""
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def deo_1(db_session):
    """Create first test DEO"""
    deo = DEO(
        deo_id=1,
        deo_name="Test DEO 1",
        province="Maguindanao del Norte",
        region="BARMM",
    )
    db_session.add(deo)
    db_session.commit()
    db_session.refresh(deo)
    return deo


@pytest.fixture
def deo_2(db_session):
    """Create second test DEO"""
    deo = DEO(
        deo_id=2,
        deo_name="Test DEO 2",
        province="Lanao del Sur",
        region="BARMM",
    )
    db_session.add(deo)
    db_session.commit()
    db_session.refresh(deo)
    return deo


@pytest.fixture
def super_admin_user(db_session, deo_1):
    """Create super admin user"""
    user = User(
        user_id=uuid.uuid4(),
        username="super_admin",
        email="super@test.com",
        password_hash=get_password_hash("testpass123"),
        role="super_admin",
        deo_id=deo_1.deo_id,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def regional_admin_user(db_session, deo_1):
    """Create regional admin user"""
    user = User(
        user_id=uuid.uuid4(),
        username="regional_admin",
        email="regional@test.com",
        password_hash=get_password_hash("testpass123"),
        role="regional_admin",
        deo_id=deo_1.deo_id,
        region="BARMM",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def deo_user_1(db_session, deo_1):
    """Create DEO user for DEO 1"""
    user = User(
        user_id=uuid.uuid4(),
        username="deo_user_1",
        email="deo1@test.com",
        password_hash=get_password_hash("testpass123"),
        role="deo_user",
        deo_id=deo_1.deo_id,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def deo_user_2(db_session, deo_2):
    """Create DEO user for DEO 2"""
    user = User(
        user_id=uuid.uuid4(),
        username="deo_user_2",
        email="deo2@test.com",
        password_hash=get_password_hash("testpass123"),
        role="deo_user",
        deo_id=deo_2.deo_id,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def project_deo_1(db_session, deo_1, deo_user_1):
    """Create project belonging to DEO 1"""
    project = Project(
        project_id=uuid.uuid4(),
        deo_id=deo_1.deo_id,
        project_title="Test Project DEO 1",
        location="Test Location",
        fund_source="GAA",
        project_cost=1000000.00,
        fund_year=2024,
        status="ongoing",
        created_by=deo_user_1.user_id,
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture
def project_deo_2(db_session, deo_2, deo_user_2):
    """Create project belonging to DEO 2"""
    project = Project(
        project_id=uuid.uuid4(),
        deo_id=deo_2.deo_id,
        project_title="Test Project DEO 2",
        location="Test Location 2",
        fund_source="BTA",
        project_cost=2000000.00,
        fund_year=2024,
        status="planning",
        created_by=deo_user_2.user_id,
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def get_auth_header(user: User) -> dict:
    """Generate authorization header for a user"""
    token = create_access_token(
        data={"sub": user.username, "user_id": str(user.user_id)}
    )
    return {"Authorization": f"Bearer {token}"}
