"""Tests for api.py"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel
from app.api import app_obj as app
from app import model
from app.model_helpers import get_db_session
from app.auth.auth_handler import get_current_user_id # For dependency override
from datetime import datetime, timezone

# Define a test database URL (in-memory SQLite)
DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Test user credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword"
TEST_USER_FULLNAME = "Test User"

# Sample GPX data (minimal valid)
MINIMAL_GPX_BYTES = """<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <metadata><name>Test GPX Route</name></metadata>
  <trk><name>Test Track</name><trkseg>
    <trkpt lat="34.0" lon="-118.0"><ele>70</ele><time>2023-01-01T12:00:00Z</time></trkpt>
    <trkpt lat="34.1" lon="-118.1"><ele>71</ele><time>2023-01-01T12:00:05Z</time></trkpt>
  </trkseg></trk>
</gpx>""".encode('utf-8')

# Sample FIT data (very simplified, actual FIT is binary and complex)
# For robust testing, a real minimal FIT file's bytes would be better,
# or mocking the fit_parsing.extract_data_to_dataframe function.
# This is a placeholder and will likely NOT be parsed correctly by fitparse.
# We will mock the parser for FIT files for now.
MINIMAL_FIT_BYTES = b"minimal_fit_file_content_placeholder"


@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    def get_current_user_id_override():
        # Check if user exists, if not create one for test setup
        user = session.query(model.User).filter(model.User.email == TEST_USER_EMAIL).first()
        if not user:
            from app.auth.crypto import get_password_hash
            hashed_password = get_password_hash(TEST_USER_PASSWORD)
            user = model.User(
                email=TEST_USER_EMAIL, 
                password=hashed_password, 
                fullname=TEST_USER_FULLNAME,
                # id will be set by DB
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        return model.UserId(id=user.id, email=user.email)


    app.dependency_overrides[get_db_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture(name="auth_token")
def auth_token_fixture(client: TestClient):
    # Create user directly or use signup if preferred, then login
    # For simplicity, assuming get_current_user_id_override handles user creation
    # Now, login to get a token
    response = client.post("/token", data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD})
    assert response.status_code == 200
    token_data = response.json()
    return token_data["access_token"]

# Mocking fit_parsing for FIT file uploads as creating valid minimal FIT bytes is complex
@pytest.fixture(autouse=True)
def mock_fit_parser(mocker):
    mock_df = pd.DataFrame({
        'timestamp': pd.to_datetime([datetime(2023, 1, 1, 10, 0, 0, tzinfo=timezone.utc), datetime(2023, 1, 1, 10, 0, 5, tzinfo=timezone.utc)]),
        'position_lat': [35.0, 35.1],
        'position_long': [-119.0, -119.1],
        'altitude': [100.0, 101.0],
        'distance': [0.0, 50.0],
        'speed': [10.0, 10.0], # m/s
        # Add other columns if compute_activity_summary expects them
    })
    # Ensure timestamp column is timezone-aware (UTC)
    if mock_df['timestamp'].dt.tz is None:
        mock_df['timestamp'] = mock_df['timestamp'].dt.tz_localize('UTC')
    else:
        mock_df['timestamp'] = mock_df['timestamp'].dt.tz_convert('UTC')

    mocker.patch('app.fit_parsing.extract_data_to_dataframe', return_value=mock_df)
    return mock_df


def test_upload_gpx_activity(client: TestClient, session: Session, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    files = {"file": ("test.gpx", MINIMAL_GPX_BYTES, "application/gpx+xml")}
    
    response = client.post("/upload_activity", files=files, headers=headers)
    
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["activity_type"] == "route"
    assert response_data["name"] == "Route" # Default name for routes
    
    # Verify in DB
    activity_db = session.get(model.ActivityTable, response_data["activity_id"])
    assert activity_db is not None
    assert activity_db.activity_type == "route"
    assert activity_db.name == "Route"
    assert activity_db.owner_id is not None 

def test_upload_fit_activity(client: TestClient, session: Session, auth_token: str, mock_fit_parser):
    # mock_fit_parser is active due to autouse=True and being passed as an arg
    headers = {"Authorization": f"Bearer {auth_token}"}
    files = {"file": ("test.fit", MINIMAL_FIT_BYTES, "application/octet-stream")} # content type for .fit
    
    response = client.post("/upload_activity", files=files, headers=headers)
    
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["activity_type"] == "recorded"
    assert response_data["name"] == "Ride" # Default name for FIT
        
    activity_db = session.get(model.ActivityTable, response_data["activity_id"])
    assert activity_db is not None
    assert activity_db.activity_type == "recorded"
    assert activity_db.name == "Ride"
    assert activity_db.owner_id is not None

def test_get_activities_filtering(client: TestClient, session: Session, auth_token: str, mock_fit_parser):
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Upload a FIT activity
    fit_files = {"file": ("test.fit", MINIMAL_FIT_BYTES, "application/octet-stream")}
    fit_response = client.post("/upload_activity", files=fit_files, headers=headers)
    assert fit_response.status_code == 200
    fit_activity_id = fit_response.json()["activity_id"]

    # Upload a GPX activity
    gpx_files = {"file": ("test.gpx", MINIMAL_GPX_BYTES, "application/gpx+xml")}
    gpx_response = client.post("/upload_activity", files=gpx_files, headers=headers)
    assert gpx_response.status_code == 200
    gpx_activity_id = gpx_response.json()["activity_id"]

    # Test filtering for 'route'
    response_route = client.get("/activities?activity_type=route", headers=headers)
    assert response_route.status_code == 200
    route_activities = response_route.json()
    assert len(route_activities) >= 1
    assert any(act["activity_id"] == gpx_activity_id for act in route_activities)
    assert all(act["activity_type"] == "route" for act in route_activities)
    # Ensure FIT activity is not present unless it was miscategorized (which would be a bug)
    assert not any(act["activity_id"] == fit_activity_id for act in route_activities if act["activity_type"] == "route")


    # Test filtering for 'recorded'
    response_recorded = client.get("/activities?activity_type=recorded", headers=headers)
    assert response_recorded.status_code == 200
    recorded_activities = response_recorded.json()
    assert len(recorded_activities) >= 1
    assert any(act["activity_id"] == fit_activity_id for act in recorded_activities)
    assert all(act["activity_type"] == "recorded" for act in recorded_activities)
    assert not any(act["activity_id"] == gpx_activity_id for act in recorded_activities if act["activity_type"] == "recorded")


    # Test no type filter (should return all for the user, or respect default if any)
    response_all = client.get("/activities", headers=headers)
    assert response_all.status_code == 200
    all_activities = response_all.json()
    assert len(all_activities) >= 2 # Expecting at least the two we uploaded
    
    activity_ids_in_all = [act["activity_id"] for act in all_activities]
    assert fit_activity_id in activity_ids_in_all
    assert gpx_activity_id in activity_ids_in_all

def test_upload_unsupported_file_type(client: TestClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    files = {"file": ("test.txt", b"some text data", "text/plain")}
    
    response = client.post("/upload_activity", files=files, headers=headers)
    
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]

# Need to import pandas for the mock_fit_parser fixture
import pandas as pd
