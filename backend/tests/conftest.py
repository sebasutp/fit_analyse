import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel, select
from sqlmodel.pool import StaticPool
from sqlalchemy.exc import IntegrityError
from datetime import timedelta

# Adjust import according to your project structure
from app.api import app_obj as app
from app.model import User
from app.auth.auth_handler import create_access_token
from app.database import get_db_session
from app.auth import crypto

# Setup for an in-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, poolclass=StaticPool, connect_args={"check_same_thread": False})

@pytest.fixture(scope="session")
def engine_fixture():
    return engine

@pytest.fixture(scope="session", autouse=True)
def mock_env():
    """Ensure tests run with a known valid environment, ignoring local .env"""
    import os
    os.environ["AUTH_PROVIDER"] = "local"
    # Add other defaults as needed
    os.environ["JWT_SECRET"] = "testselect"
    os.environ["JWT_ALGORITHM"] = "HS256"

@pytest.fixture(scope="function", autouse=True)
def setup_database(engine_fixture):
    SQLModel.metadata.create_all(engine_fixture)
    yield
    SQLModel.metadata.drop_all(engine_fixture)

@pytest.fixture(scope="function")
def dbsession(engine_fixture):
    # Override dependency for this session
    def override_get_db_session():
        with Session(engine_fixture) as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    with Session(engine_fixture) as session:
        yield session
    # Cleanup dependency override
    app.dependency_overrides.pop(get_db_session, None)

@pytest.fixture(scope="module")
def client():
    # We can use the same app instance
    return TestClient(app)

@pytest.fixture(scope="function")
def test_user(dbsession: Session):
    user_data = {"email": "test@example.com", "password": "password123", "fullname": "Test User"}
    user = User.model_validate(user_data)
    user.password = crypto.get_password_hash(user.password)

    dbsession.add(user)
    try:
        dbsession.commit()
        dbsession.refresh(user)
    except IntegrityError:
        dbsession.rollback()
        user = dbsession.exec(select(User).where(User.email == user_data["email"])).one()
    return user

@pytest.fixture(scope="function")
def auth_headers(test_user: User):
    token = create_access_token(test_user, timedelta(minutes=30))
    return {"Authorization": f"Bearer {token}"}
