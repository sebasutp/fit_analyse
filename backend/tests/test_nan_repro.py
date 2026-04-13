import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlmodel import Session
from app.model import ActivityTable, User
from app.auth import crypto
from app.services import data_processing, utils
from fastapi.testclient import TestClient
from app.api import app_obj as app

def create_nan_activity_in_db(dbsession: Session, user_id: int):
    # Create a DataFrame with NaNs in various places
    df = pd.DataFrame({
        'timestamp': [datetime.utcnow(), datetime.utcnow() + timedelta(seconds=1)],
        'speed': [10.0, np.nan], # This causes avg_speed to have potential issues
        'altitude': [100.0, np.nan], # One valid point ensures elev_summary is computed
        'distance': [0.0, np.nan], # One valid point ensures dist_series is computed
        'power': [np.nan, np.nan] # No power data
    })
    serialized_data = data_processing.serialize_dataframe(df)

    activity = ActivityTable(
        activity_id="nan_test_activity",
        name="NaN Test Activity",
        owner_id=user_id,
        activity_type="recorded",
        distance=0.0,
        active_time=2.0,
        elevation_gain=0.0,
        date=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        data=serialized_data,
        laps_data=None,
        static_map=None,
        # Adding a float to an int field to reproduce another log error
        average_temperature=15.5 
    )
    dbsession.add(activity)
    dbsession.commit()
    dbsession.refresh(activity)
    return activity

def test_get_activity_with_nan_handling(auth_headers, test_user, dbsession, client: TestClient):
    """
    This test verifies that the activity endpoint can handle NaN values
    by sanitizing them to null (None) in the JSON response, and also
    checks that the response model validation doesn't fail.
    """
    activity = create_nan_activity_in_db(dbsession, test_user.id)
    
    # We call the activity endpoint. 
    # Before the fixes, this failed with ValueError (JSON) or ResponseValidationError (Pydantic).
    response = client.get(f"/activity/{activity.activity_id}", headers=auth_headers)
    
    # We expect 200 OK after both the sanitization AND model fixes are applied.
    assert response.status_code == 200
    data = response.json()
    assert data["activity_base"]["activity_id"] == activity.activity_id
    
    # Check that average_temperature (which we set to a float) passed validation
    assert data["activity_base"]["average_temperature"] == 15.5
    
    # Check that NaN in series was converted to null
    elev_summary = data["activity_analysis"]["elev_summary"]
    assert elev_summary is not None
    assert any(x is None for x in elev_summary["elev_series"])
