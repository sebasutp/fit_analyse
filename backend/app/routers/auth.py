import os
from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app import model
from app.database import get_db_session
from app.auth import auth_handler

router = APIRouter()

@router.get("/config")
async def get_auth_config():
    """
    Returns the current authentication provider configuration.
    """
    auth_provider = os.getenv("AUTH_PROVIDER", "local")
    return {"auth_provider": auth_provider}


@router.post("/exchange-token")
async def exchange_token(
    token_data: dict,
    session: Session = Depends(get_db_session)
):
    """
    Exchanges an external auth token for a local session token.
    """
    import httpx
    
    external_token = token_data.get("external_token")
    if not external_token:
        raise HTTPException(status_code=400, detail="Missing external_token")

    # Call auth_service to validate token and get user info
    auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://localhost:8000")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{auth_service_url}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {external_token}"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid external token")
            user_info = resp.json()
        except httpx.RequestError:
             raise HTTPException(status_code=503, detail="Auth service unavailable")

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="External user has no email")

    # Find or create user
    # Note: We need to access the User model from app.model
    # The existing code imports 'app.model' as 'model'
    q = select(model.User).where(model.User.email == email)
    db_user = session.exec(q).first()

    if not db_user:
        # Create new user
        # Password is not used for external auth, but we might need a dummy one if the model requires it
        # Model UserLogin requires password. UserCreate inherits from UserLogin.
        # We'll set a random unusable password.
        import secrets
        random_password = secrets.token_urlsafe(32)
        hashed_password = auth_handler.crypto.get_password_hash(random_password)
        
        db_user = model.User(
            email=email,
            password=hashed_password,
            fullname=user_info.get("name") or email.split("@")[0]
        )
        session.add(db_user)
        session.commit()
        session.refresh(db_user)

    # Issue local token
    time_out = int(os.getenv("TOKEN_TIMEOUT", "30"))
    token = auth_handler.create_access_token(db_user, timedelta(minutes=time_out))
    return model.Token(access_token=token, token_type="bearer")


@router.post("/token")
async def login(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        session: Session = Depends(get_db_session)):
    """
    Login API to authenticate a user and generate an access token.
    """
    # ... existing login implementation ...
    if os.getenv("AUTH_PROVIDER") == "external":
         raise HTTPException(status_code=403, detail="Local login disabled")

    user = model.UserLogin(email=form_data.username,
                        password=form_data.password)
    db_user = auth_handler.check_and_get_user(user, session)
    if not db_user:
        raise HTTPException(
            status_code=400, detail="Incorrect username or password")
    time_out = int(os.getenv("TOKEN_TIMEOUT") or 30)
    token = auth_handler.create_access_token(db_user, timedelta(minutes=time_out))
    return model.Token(access_token=token, token_type="bearer")
