import os
from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app import model
from app.database import get_db_session
from app.auth import auth_handler

router = APIRouter()

@router.post("/token")
async def login(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        session: Session = Depends(get_db_session)):
    """
    Login API to authenticate a user and generate an access token.
    """
    user = model.UserLogin(email=form_data.username,
                        password=form_data.password)
    db_user = auth_handler.check_and_get_user(user, session)
    if not db_user:
        raise HTTPException(
            status_code=400, detail="Incorrect username or password")
    time_out = int(os.getenv("TOKEN_TIMEOUT")) or 30
    token = auth_handler.create_access_token(db_user, timedelta(minutes=time_out))
    return model.Token(access_token=token, token_type="bearer")
