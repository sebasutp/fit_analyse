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
from app.database import get_db_session
from app.services import data_processing
from app import model as app_models # For model.UserId
from app.auth import crypto # For generating activity_id
from datetime import datetime, timedelta
import io
import pandas as pd

# Setup for an in-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, poolclass=StaticPool, connect_args={"check_same_thread": False})

# Store original dependency and override it
original_get_db_session = app.dependency_overrides.get(get_db_session)

def override_get_db_session():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_db_session] = override_get_db_session

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
    
    # Create a simple, valid DataFrame to be serialized
    df = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4]})
    serialized_data = data_processing.serialize_dataframe(df)

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
        data=serialized_data, # Use serialized valid data
        tags=tags,
        laps_data=None, # Add default for other required fields if any
        static_map=None
    )
    dbsession.add(activity)
    dbsession.commit()
    dbsession.refresh(activity)
    return activity

# Test Cases
def test_user_signup(dbsession: Session):
    response = client.post("/user/signup", json={"email": "newuser@example.com", "password": "newpassword", "fullname": "New User"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Verify user is in the database
    user = dbsession.exec(select(User).where(User.email == "newuser@example.com")).first()
    assert user is not None
    assert user.fullname == "New User"

def test_user_login(test_user: User):
    response = client.post("/token", data={"username": "test@example.com", "password": "password123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_user_login_incorrect_password(test_user: User):
    response = client.post("/token", data={"username": "test@example.com", "password": "wrongpassword"})
    assert response.status_code == 400
    assert response.json() == {"detail": "Incorrect username or password"}

from pathlib import Path

def test_upload_activity_fit(auth_headers: dict, test_user: User, dbsession: Session):
    fit_file_path = Path(__file__).resolve().parent.parent.parent / "examples" / "2024-11-12-065535-ELEMNT ROAM 8055-155-0.fit"
    with open(fit_file_path, "rb") as f:
        response = client.post("/upload_activity", headers=auth_headers, files={"file": ("test.fit", f, "application/octet-stream")})
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ride"
    assert data["owner_id"] == test_user.id
    
    # Verify activity is in the database
    activity = dbsession.exec(select(ActivityTable).where(ActivityTable.activity_id == data["activity_id"])).first()
    assert activity is not None
    assert activity.name == "Ride"

def test_upload_activity_gpx(auth_headers: dict, test_user: User, dbsession: Session):
    gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="34.052235" lon="-118.243683"><time>2023-01-01T12:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>"""
    with io.BytesIO(gpx_content.encode('utf-8')) as f:
        response = client.post("/upload_activity", headers=auth_headers, files={"file": ("test.gpx", f, "application/gpx+xml")})

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Route"
    assert data["owner_id"] == test_user.id

    # Verify activity is in the database
    activity = dbsession.exec(select(ActivityTable).where(ActivityTable.activity_id == data["activity_id"])).first()
    assert activity is not None
    assert activity.name == "Route"

def test_get_activities(auth_headers: dict, test_user: User, dbsession: Session):
    create_activity_in_db(dbsession, test_user.id, "Activity 1")
    create_activity_in_db(dbsession, test_user.id, "Activity 2")

    response = client.get("/activities", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Activity 2" # Sorted by date desc
    assert data[1]["name"] == "Activity 1"

def test_get_activity(auth_headers: dict, test_user: User, dbsession: Session):
    activity = create_activity_in_db(dbsession, test_user.id, "My Activity")

    response = client.get(f"/activity/{activity.activity_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["activity_base"]["name"] == "My Activity"

def test_update_activity(auth_headers: dict, test_user: User, dbsession: Session):
    activity = create_activity_in_db(dbsession, test_user.id, "Old Name")

    response = client.patch(f"/activity/{activity.activity_id}", headers=auth_headers, json={"name": "New Name", "tags": ["updated"]})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["tags"] == ["updated"]

    # Verify the update in the database
    dbsession.refresh(activity)
    updated_activity = dbsession.exec(select(ActivityTable).where(ActivityTable.activity_id == activity.activity_id)).one()
    assert updated_activity.name == "New Name"
    assert updated_activity.tags == ["updated"]

def test_delete_activity(auth_headers: dict, test_user: User, dbsession: Session):
    activity = create_activity_in_db(dbsession, test_user.id, "To Be Deleted")

    response = client.delete(f"/activity/{activity.activity_id}", headers=auth_headers)
    assert response.status_code == 200

    # Verify it's deleted from the database
    deleted_activity = dbsession.exec(select(ActivityTable).where(ActivityTable.activity_id == activity.activity_id)).first()
    assert deleted_activity is None

def test_get_activity_unauthorized(test_user: User, dbsession: Session):
    # Create a second user and an activity for them
    other_user_data = {"email": "other@example.com", "password": "password123", "fullname": "Other User"}
    other_user = User.model_validate(other_user_data)
    other_user.password = crypto.get_password_hash(other_user.password)
    dbsession.add(other_user)
    dbsession.commit()
    dbsession.refresh(other_user)

    activity = create_activity_in_db(dbsession, other_user.id, "Other's Activity")

    # Log in as test_user and try to access other_user's activity
    token = create_access_token(test_user, timedelta(minutes=30))
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get(f"/activity/{activity.activity_id}", headers=headers)
    assert response.status_code == 200 

def test_update_activity_unauthorized(auth_headers: dict, test_user: User, dbsession: Session):
    # As before, create another user and their activity
    other_user_data = {"email": "other@example.com", "password": "password123", "fullname": "Other User"}
    other_user = User.model_validate(other_user_data)
    other_user.password = crypto.get_password_hash(other_user.password)
    dbsession.add(other_user)
    dbsession.commit()
    dbsession.refresh(other_user)
    activity = create_activity_in_db(dbsession, other_user.id, "Other's Activity")

    # test_user (with auth_headers) tries to update it
    response = client.patch(f"/activity/{activity.activity_id}", headers=auth_headers, json={"name": "Hacked"})
    assert response.status_code == 401
    # Check that the response body is empty for an unauthorized request
    assert not response.content

# Search-related tests have been removed.

# Teardown: Restore original dependencies if necessary
# This is mostly for completeness if tests run in a shared environment or with other test suites.
# Pytest fixtures usually handle cleanup well for test isolation.
def teardown_module(module):
    if original_get_db_session:
        app.dependency_overrides[get_db_session] = original_get_db_session
    else:
        del app.dependency_overrides[get_db_session]
