
from unittest.mock import AsyncMock, patch
import pytest
from app.model import User, Token
from sqlmodel import select

# Test Config Endpoint
def test_get_auth_config(client):
    response = client.get("/config")
    assert response.status_code == 200
    assert response.json() == {"auth_provider": "local"} # Default

def test_get_auth_config_external(client, monkeypatch):
    monkeypatch.setenv("AUTH_PROVIDER", "external")
    response = client.get("/config")
    assert response.status_code == 200
    assert response.json() == {"auth_provider": "external"}

# Test Exchange Token
def test_exchange_token_success(client, dbsession, mocker):
    # Mock httpx.AsyncClient
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "email": "external@example.com",
        "name": "External User"
    }

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get.return_value = mock_response
    
    # Patch httpx which is imported inside the function.
    # We patch the module 'httpx' in the sys.modules or similar
    # But simpler: patch 'httpx.AsyncClient' using mocker which patches where it is found?
    # No, mocker.patch('string') patches based on import path.
    # Since the function does 'import httpx', it uses the global httpx module.
    # So patching 'httpx.AsyncClient' should work if httpx is importable.
    import httpx
    mocker.patch("httpx.AsyncClient", return_value=mock_client)

    response = client.post("/exchange-token", json={"external_token": "valid_token"})
    
    # Debugging if needed
    if response.status_code != 200:
        print(response.json())

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Verify user created
    user = dbsession.exec(select(User).where(User.email == "external@example.com")).first()
    assert user is not None
    assert user.fullname == "External User"

def test_exchange_token_invalid_token(client, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 401
    
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get.return_value = mock_response
    
    import httpx
    mocker.patch("httpx.AsyncClient", return_value=mock_client)

    response = client.post("/exchange-token", json={"external_token": "invalid_token"})
    
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid external token"

def test_exchange_token_no_email(client, mocker):
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "name": "No Email User"
        # No email
    }
    
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get.return_value = mock_response
    
    import httpx
    mocker.patch("httpx.AsyncClient", return_value=mock_client)

    response = client.post("/exchange-token", json={"external_token": "valid_token"})
    
    
    assert response.status_code == 400
    assert response.json()["detail"] == "External user has no email"

def test_exchange_token_existing_user(client, dbsession, mocker):
    """
    Test that if a user with the same email already exists, 
    they are logged in and NO new user is created.
    """
    # 1. Create existing user
    import app.auth.crypto as crypto
    existing_user = User(
        email="existing@example.com",
        password=crypto.get_password_hash("password123"),
        fullname="Existing User"
    )
    dbsession.add(existing_user)
    dbsession.commit()
    dbsession.refresh(existing_user)
    original_user_id = existing_user.id

    # 2. Mock external auth response with SAME email
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "email": "existing@example.com",
        "name": "External Name Update? (Optional)" 
    }

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get.return_value = mock_response
    
    import httpx
    mocker.patch("httpx.AsyncClient", return_value=mock_client)

    # 3. Call exchange token
    response = client.post("/exchange-token", json={"external_token": "valid_token_existing"})

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

    # 4. Verify user count did NOT increase
    users = dbsession.exec(select(User).where(User.email == "existing@example.com")).all()
    assert len(users) == 1
    
    # 5. Verify it is the SAME user
    logged_in_user = users[0]
    assert logged_in_user.id == original_user_id
