"""Application configuration loaded from environment variables."""

import json
import os
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def get_cors_origins(origins_str: Optional[str] = None) -> List[str]:
    """Parse CORS allowed origins from an environment variable string or parameter.

    Supports comma-separated values, JSON arrays, and wildcard '*'.
    Defaults to ['*'] if empty or unset.
    """
    if origins_str is None:
        origins_str = os.getenv("CORS_ORIGINS", "*")

    origins_str = origins_str.strip()
    if not origins_str or origins_str == "*":
        return ["*"]

    # Support JSON array format, e.g. ["http://localhost:5173"]
    if origins_str.startswith("[") and origins_str.endswith("]"):
        try:
            parsed = json.loads(origins_str)
            if isinstance(parsed, list):
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
        except json.JSONDecodeError:
            pass

    # Support comma-separated format, e.g. http://localhost:5173, http://localhost:3000
    return [origin.strip() for origin in origins_str.split(",") if origin.strip()]


def get_api_prefix(prefix_str: Optional[str] = None) -> str:
    """Normalize and return the API folder/path prefix.

    Reads from API_PREFIX or fallback API_FOLDER environment variable.
    Defaults to '/api'. An empty string or '/' represents the root path.
    """
    if prefix_str is None:
        prefix_str = os.getenv("API_PREFIX", os.getenv("API_FOLDER", "/api"))

    prefix = prefix_str.strip()
    if not prefix or prefix == "/":
        return ""

    if not prefix.startswith("/"):
        prefix = f"/{prefix}"

    if prefix.endswith("/"):
        prefix = prefix.rstrip("/")

    return prefix
