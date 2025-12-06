from fastapi import APIRouter, Depends, Body
from sqlmodel import Session

from app import model
from app.database import get_db_session
from app.auth import auth_handler, crypto

router = APIRouter()

@router.post("/user/signup", tags=["user"])
async def create_user(
    *,
    session: Session = Depends(get_db_session),
    user: model.UserCreate = Body(...)):
    """
    Creates a new user account.
    """
    db_user = model.User.model_validate(user)
    # Hash password before saving it
    db_user.password = crypto.get_password_hash(db_user.password)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return model.Token(
        access_token=auth_handler.create_access_token(db_user),
        token_type="bearer")
