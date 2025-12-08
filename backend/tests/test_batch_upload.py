from fastapi.testclient import TestClient
from sqlmodel import select, Session
import pytest
from app.model import ActivityTable, User
from app.auth.auth_handler import create_access_token
from app.auth import crypto
from datetime import datetime, timedelta
import hashlib
import io
import pandas as pd

from unittest.mock import patch

# Use existing fixtures from conftest.py

def test_batch_upload_deduplication(auth_headers: dict, test_user: User, dbsession: Session, client: TestClient):
    # 1. Create a dummy FIT file content
    content = b"dummy content"
    file_hash = hashlib.sha256(content).hexdigest()
    
    # We need to simulate a valid FIT file upload or mock the parsing.
    # Since we can't easily create a valid FIT file from scratch without a library on the fly, 
    # we will mock the fit_parsing.extract_data_to_dataframe function.
    # But for an integration test, it's better to use a real file if possible, or handle the mocking.
    # Let's use mocking for parsing to isolate the upload logic.
    
    # Mock return value for extract_data_to_dataframe
    mock_df = pd.DataFrame({
        'timestamp': [datetime.utcnow()],
        'power': [100],
        'distance': [1000]
    })
    
    with patch("app.fit_parsing.extract_data_to_dataframe", return_value=mock_df):
        with patch("app.services.analysis.compute_activity_summary") as mock_summary:
            # Mock summary
            from app.model import ActivitySummary, PowerSummary
            mock_summary.return_value = ActivitySummary(
                distance=1000, total_elapsed_time=100, active_time=100, 
                power_summary=PowerSummary(average_power=100, median_power=100, total_work=100, quantiles=[])
            )

            # First upload
            response = client.post("/upload_activity", headers=auth_headers, files={"file": ("test.fit", content, "application/octet-stream")})
            assert response.status_code == 200
            data1 = response.json()
            assert data1["val_hash"] == file_hash
            
            # Verify DB
            activity1 = dbsession.exec(select(ActivityTable).where(ActivityTable.activity_id == data1["activity_id"])).first()
            assert activity1 is not None
            assert activity1.val_hash == file_hash

            # Second upload (same content)
            response = client.post("/upload_activity", headers=auth_headers, files={"file": ("test.fit", content, "application/octet-stream")})
            assert response.status_code == 200
            data2 = response.json()
            
            # Should be the same activity ID
            assert data2["activity_id"] == data1["activity_id"]
            assert data2["val_hash"] == file_hash


def test_legacy_activity_update(auth_headers: dict, test_user: User, dbsession: Session, client: TestClient):
    from datetime import timezone
    # Use a fixed UTC date
    fixed_date_utc = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    
    mock_df = pd.DataFrame({
        'timestamp': [fixed_date_utc],
        'power': [200],
        'distance': [2000]
    })

    # Manually insert legacy activity
    activity_id = crypto.generate_random_base64_string(16)
    legacy_activity = ActivityTable(
        activity_id=activity_id,
        name="Legacy Ride",
        owner_id=test_user.id,
        activity_type="recorded",
        distance=2000,
        active_time=200,
        elevation_gain=0,
        date=fixed_date_utc,
        last_modified=datetime.now(timezone.utc),
        data=b"",
        val_hash=None
    )
    dbsession.add(legacy_activity)
    dbsession.commit()
    
    content = b"legacy content"
    file_hash = hashlib.sha256(content).hexdigest()

    with patch("app.fit_parsing.extract_data_to_dataframe", return_value=mock_df):
        with patch("app.services.analysis.compute_activity_summary") as mock_summary:
             from app.model import ActivitySummary, PowerSummary
             mock_summary.return_value = ActivitySummary(distance=2000, total_elapsed_time=200, active_time=200, power_summary=None)

             # Upload
             response = client.post("/upload_activity", headers=auth_headers, files={"file": ("legacy.fit", content, "application/octet-stream")})
             assert response.status_code == 200
             data = response.json()
             
             assert data["activity_id"] == activity_id
             assert data["val_hash"] == file_hash
             
             # Verify DB
             dbsession.refresh(legacy_activity)
             assert legacy_activity.val_hash == file_hash
