import os
from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app import model
from app.database import get_db_session
from app.auth import auth_handler

router = APIRouter()

@router.get("/config")
async def get_auth_config():
    """
    Returns the current authentication configuration.
    """
    return {
        "external_auth_enabled": bool(os.getenv("EXTERNAL_AUTH_ENDPOINT")),
    }


@router.post("/exchange-token")
async def exchange_token(
    request: Request,
    token_data: dict = None,
    session: Session = Depends(get_db_session)
):
    """
    Exchanges an external auth token or session cookies for a local session token.
    """
    import httpx
    import secrets
    
    external_auth_endpoint = os.getenv("EXTERNAL_AUTH_ENDPOINT")
    if not external_auth_endpoint:
        raise HTTPException(status_code=501, detail="External auth not configured")

    async with httpx.AsyncClient(cookies=request.cookies) as client:
        try:
            # We forward cookies from the browser to the external auth endpoint
            # If an external_token was also provided in the body, we can include it as well
            headers = {}
            if token_data and token_data.get("external_token"):
                headers["Authorization"] = f"Bearer {token_data.get('external_token')}"
            
            resp = await client.get(
                external_auth_endpoint,
                headers=headers
            )
            
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="External authentication failed")
            
            # The user provided the UserPublic format
            user_info = model.UserPublic(**resp.json())
        except HTTPException:
             raise
        except httpx.RequestError:
             raise HTTPException(status_code=503, detail="External auth service unavailable")
        except Exception as e:
             raise HTTPException(status_code=422, detail=f"Invalid response format from external auth: {str(e)}")

    # Verify scope
    required_scope = os.getenv("EXTERNAL_AUTH_REQ_SCOPE")
    if required_scope:
        if not user_info.scopes or required_scope not in user_info.scopes:
            raise HTTPException(status_code=403, detail="Missing required scope")

    email = user_info.email
    if not email:
        raise HTTPException(status_code=400, detail="External user has no email")

    # Find or create user
    q = select(model.User).where(model.User.email == email)
    db_user = session.exec(q).first()

    if not db_user:
        # Create new user with a random password
        random_password = secrets.token_urlsafe(32)
        hashed_password = auth_handler.crypto.get_password_hash(random_password)
        
        db_user = model.User(
            email=email,
            password=hashed_password,
            fullname=user_info.name or email.split("@")[0]
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
    user = model.UserLogin(email=form_data.username,
                        password=form_data.password)
    db_user = auth_handler.check_and_get_user(user, session)
    if not db_user:
        raise HTTPException(
            status_code=400, detail="Incorrect username or password")
    time_out = int(os.getenv("TOKEN_TIMEOUT") or 30)
    token = auth_handler.create_access_token(db_user, timedelta(minutes=time_out))
    return model.Token(access_token=token, token_type="bearer")
