"""API entry point."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, users, activities

app_obj = FastAPI()

app_obj.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_obj.include_router(auth.router)
app_obj.include_router(users.router)
app_obj.include_router(activities.router)

logger = logging.getLogger('uvicorn.error')
