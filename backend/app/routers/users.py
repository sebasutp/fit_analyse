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

@router.get("/user/me", response_model=model.UserProfile, tags=["user"])
async def get_user_me(
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    session: Session = Depends(get_db_session)
):
    user = session.get(model.User, current_user_id.id)
    return user

@router.put("/user/me", response_model=model.UserProfile, tags=["user"])
async def update_user_me(
    user_update: model.UserUpdate,
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    session: Session = Depends(get_db_session)
):
    user = session.get(model.User, current_user_id.id)
    if not user:
        # Should not happen as we have the token
        return None
    
    user_data = user_update.model_dump(exclude_unset=True)
    user.sqlmodel_update(user_data)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
