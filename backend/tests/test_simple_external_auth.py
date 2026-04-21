import pytest
import os
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api import app_obj as app
from app import model

# Use fixtures from conftest.py: dbsession, client

@patch("httpx.AsyncClient.get")
def test_exchange_token_success(mock_get, client, dbsession):
    # Setup mock response from external auth
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": 123,
        "email": "test-new@example.com",
        "role": "user",
        "name": "Test New User",
        "scopes": ["app:access", "other:scope"]
    }
    mock_get.return_value = mock_resp

    # Set env vars
    with patch.dict(os.environ, {
        "EXTERNAL_AUTH_ENDPOINT": "http://external-auth/me",
        "EXTERNAL_AUTH_REQ_SCOPE": "app:access",
        "JWT_SECRET": "test_secret",
        "JWT_ALGORITHM": "HS256"
    }):
        response = client.post(
            "/exchange-token",
            json={"external_token": "valid_external_token"}
        )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Verify user created in local DB
    # We use dbsession which is already configured to see the app's database
    q = select(model.User).where(model.User.email == "test-new@example.com")
    user = dbsession.exec(q).first()
    assert user is not None
    assert user.fullname == "Test New User"

@patch("httpx.AsyncClient.get")
def test_exchange_token_missing_scope(mock_get, client, dbsession):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": 123,
        "email": "test-scope@example.com",
        "role": "user",
        "name": "Test Scope User",
        "scopes": ["other:scope"]
    }
    mock_get.return_value = mock_resp

    with patch.dict(os.environ, {
        "EXTERNAL_AUTH_ENDPOINT": "http://external-auth/me",
        "EXTERNAL_AUTH_REQ_SCOPE": "app:access"
    }):
        response = client.post(
            "/exchange-token",
            json={"external_token": "valid_external_token"}
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Missing required scope"

@patch("httpx.AsyncClient.get")
def test_exchange_token_invalid_external_token(mock_get, client, dbsession):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_get.return_value = mock_resp

    with patch.dict(os.environ, {"EXTERNAL_AUTH_ENDPOINT": "http://external-auth/me"}):
        response = client.post(
            "/exchange-token",
            json={"external_token": "invalid_token"}
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "External authentication failed"
@patch("httpx.AsyncClient")
def test_exchange_token_with_cookies(mock_client_class, client, dbsession):
    # Setup mock client and response
    mock_client = MagicMock()
    mock_client_class.return_value.__aenter__.return_value = mock_client
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": 456,
        "email": "cookie-user@example.com",
        "role": "user",
        "name": "Cookie User",
        "scopes": ["app:access"]
    }
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch.dict(os.environ, {
        "EXTERNAL_AUTH_ENDPOINT": "http://external-auth/me",
        "EXTERNAL_AUTH_REQ_SCOPE": "app:access"
    }):
        # Send request with cookies
        response = client.post(
            "/exchange-token",
            json={},
            cookies={"session_id": "fake_cookie_123"}
        )

    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # Verify client was initialized with the cookies
    mock_client_class.assert_called_once()
    assert mock_client_class.call_args.kwargs["cookies"] == {"session_id": "fake_cookie_123"}

    # Verify user created
    user = dbsession.exec(select(model.User).where(model.User.email == "cookie-user@example.com")).first()
    assert user is not None
    assert user.fullname == "Cookie User"
