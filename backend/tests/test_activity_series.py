import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.api import app_obj as app
from app.model import User

def test_get_activity_processed_series(client: TestClient, auth_headers, test_user: User):
    # Mock data with irregular intervals
    mock_df = pd.DataFrame({
        'timestamp': [1000, 1002, 1005, 1010],
        'power': [100, 150, 200, 250],
        'heart_rate': [140, 145, 150, 155]
    })

    activity_id = "test_activity_id"
    
    # Mock activity_crud.fetch_activity_df to return our mock_df
    with patch("app.services.activity_crud.fetch_activity_df", return_value=mock_df):
        response = client.get(f"/activity/{activity_id}/processed_series", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert len(data) > 0
        first_point = data[0]
        assert "time" in first_point
        assert "power" in first_point
        assert "heart_rate" in first_point
        
        # Verify resampling to 1Hz (duration is 10s, so ~11 points)
        # Note: prepare_processed_series resamples to 1Hz
        assert len(data) == 11 

def test_get_activity_processed_series_not_found(client: TestClient, auth_headers, test_user: User):
    activity_id = "non_existent"
    
    with patch("app.services.activity_crud.fetch_activity_df", return_value=None):
        response = client.get(f"/activity/{activity_id}/processed_series", headers=auth_headers)
        assert response.status_code == 404
        assert response.json()["detail"] == "Activity data not found"
