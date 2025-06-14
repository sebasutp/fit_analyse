# backend/tests/test_api.py
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel, select, func
from sqlmodel.pool import StaticPool
import pytest
from sqlalchemy.exc import IntegrityError


# Adjust import according to your project structure
# Assuming your FastAPI app is in app.main or app.api if main is just a wrapper
# Based on previous files, the FastAPI app_obj is in app.api
from app.api import app_obj as app
from app.model import ActivityTable, User # Assuming model.py contains these
from app.auth.auth_handler import create_access_token # For generating test tokens
from app import model_helpers # For get_db_session
from app import model as app_models # For model.UserId
from app.auth import crypto # For generating activity_id
from datetime import datetime, timedelta

# Setup for an in-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, poolclass=StaticPool, connect_args={"check_same_thread": False})

# Store original dependency and override it
original_get_db_session = app.dependency_overrides.get(model_helpers.get_db_session)

def override_get_db_session():
    with Session(engine) as session:
        yield session

app.dependency_overrides[model_helpers.get_db_session] = override_get_db_session

client = TestClient(app)

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def dbsession(): # Renamed from session to dbsession to avoid conflict with pytest's session
    with Session(engine) as session_instance:
        yield session_instance

@pytest.fixture(scope="function")
def test_user(dbsession: Session):
    user_data = {"email": "test@example.com", "password": "password123", "fullname": "Test User"}
    # Assuming UserCreate is used for creation and User for table representation
    user = User.model_validate(user_data) # Use model_validate if User is a SQLModel table class
    user.password = crypto.get_password_hash(user.password) # Hash password

    dbsession.add(user)
    try:
        dbsession.commit()
        dbsession.refresh(user)
    except IntegrityError: # Handle case where user might already exist from another fixture instance if not careful with scopes
        dbsession.rollback()
        user = dbsession.exec(select(User).where(User.email == user_data["email"])).one()

    return user

@pytest.fixture(scope="function")
def auth_headers(test_user: User):
    # create_access_token expects a User object as defined in auth_handler
    token = create_access_token(test_user, timedelta(minutes=30))
    return {"Authorization": f"Bearer {token}"}

# Test data helper
def create_activity_in_db(dbsession: Session, user_id: int, name: str, tags: list[str] = None, activity_type: str = "recorded", date: datetime = None):
    if date is None:
        date = datetime.utcnow()
    activity = ActivityTable(
        activity_id=crypto.generate_random_base64_string(16), # Use crypto for unique ID
        name=name,
        owner_id=user_id,
        activity_type=activity_type,
        distance=10.0,
        active_time=3600.0,
        elevation_gain=100.0,
        date=date,
        last_modified=date,
        data=b"some data", # dummy data
        tags=tags,
        laps_data=None, # Add default for other required fields if any
        static_map=None
    )
    dbsession.add(activity)
    dbsession.commit()
    dbsession.refresh(activity)
    return activity

# Test Cases
# Search-related tests have been removed.

# Teardown: Restore original dependencies if necessary
# This is mostly for completeness if tests run in a shared environment or with other test suites.
# Pytest fixtures usually handle cleanup well for test isolation.
def teardown_module(module):
    if original_get_db_session:
        app.dependency_overrides[model_helpers.get_db_session] = original_get_db_session
    else:
        del app.dependency_overrides[model_helpers.get_db_session]
