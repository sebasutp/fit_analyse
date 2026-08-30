"""API entry point."""

import logging
from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import get_api_prefix, get_cors_origins
from app.routers import activities, auth, stats, users


def create_app(
    api_prefix: Optional[str] = None,
    cors_origins: Optional[List[str]] = None,
) -> FastAPI:
    """Factory function to build and configure the FastAPI application."""
    if api_prefix is None:
        api_prefix = get_api_prefix()

    if cors_origins is None:
        cors_origins = get_cors_origins()

    docs_url = f"{api_prefix}/docs" if api_prefix else "/docs"
    openapi_url = f"{api_prefix}/openapi.json" if api_prefix else "/openapi.json"
    redoc_url = f"{api_prefix}/redoc" if api_prefix else "/redoc"

    app = FastAPI(
        title="FIT File Analysis API",
        docs_url=docs_url,
        openapi_url=openapi_url,
        redoc_url=redoc_url,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(users.router, prefix=api_prefix)
    app.include_router(activities.router, prefix=api_prefix)
    app.include_router(stats.router, prefix=api_prefix)

    if api_prefix:
        @app.get("/docs", include_in_schema=False)
        async def redirect_docs():
            return RedirectResponse(url=docs_url)

        @app.get("/redoc", include_in_schema=False)
        async def redirect_redoc():
            return RedirectResponse(url=redoc_url)

    return app


app_obj = create_app()

logger = logging.getLogger("uvicorn.error")
