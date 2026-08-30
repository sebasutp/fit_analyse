import pytest
from fastapi.testclient import TestClient

from app.config import get_cors_origins, get_api_prefix
from app.api import create_app


def test_get_cors_origins_defaults():
    assert get_cors_origins("*") == ["*"]
    assert get_cors_origins("") == ["*"]


def test_get_cors_origins_comma_separated():
    origins = get_cors_origins("http://localhost:3000, http://localhost:5173")
    assert origins == ["http://localhost:3000", "http://localhost:5173"]


def test_get_cors_origins_json_array():
    origins = get_cors_origins('["http://localhost:3000", "http://localhost:5173"]')
    assert origins == ["http://localhost:3000", "http://localhost:5173"]


def test_get_api_prefix_variations():
    assert get_api_prefix("/api") == "/api"
    assert get_api_prefix("api") == "/api"
    assert get_api_prefix("/api/") == "/api"
    assert get_api_prefix("/custom/v1") == "/custom/v1"
    assert get_api_prefix("") == ""
    assert get_api_prefix("/") == ""


def test_api_endpoints_work_with_default_prefix():
    app = create_app(api_prefix="/api")
    client = TestClient(app)

    response = client.get("/api/config")
    assert response.status_code == 200
    assert "external_auth_enabled" in response.json()

    # Without prefix, it should return 404
    assert client.get("/config").status_code == 404


def test_api_endpoints_work_with_custom_prefix():
    app = create_app(api_prefix="/v2")
    client = TestClient(app)

    response = client.get("/v2/config")
    assert response.status_code == 200

    assert client.get("/api/config").status_code == 404


def test_api_endpoints_work_with_root_prefix():
    app = create_app(api_prefix="")
    client = TestClient(app)

    response = client.get("/config")
    assert response.status_code == 200


def test_cors_middleware_headers():
    app = create_app(api_prefix="/api", cors_origins=["http://localhost:5173"])
    client = TestClient(app)

    # Allowed origin
    response = client.get(
        "/api/config",
        headers={"Origin": "http://localhost:5173"}
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Preflight request
    options_response = client.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    assert options_response.status_code == 200
    assert options_response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_docs_endpoints_and_redirects():
    app = create_app(api_prefix="/api")
    client = TestClient(app)

    # OpenAPI spec and docs should be available under /api
    docs_resp = client.get("/api/docs")
    assert docs_resp.status_code == 200

    openapi_resp = client.get("/api/openapi.json")
    assert openapi_resp.status_code == 200

    # Root /docs should redirect to /api/docs
    redirect_resp = client.get("/docs", follow_redirects=False)
    assert redirect_resp.status_code in (307, 302, 301)
    assert redirect_resp.headers["location"] == "/api/docs"
