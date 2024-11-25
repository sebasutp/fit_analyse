"""API methods."""

import os
import json
from datetime import timedelta, datetime
from typing import Annotated

import fitparse
import msgpack

from fastapi import Body, Depends, FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.auth import auth_handler
from app.auth import crypto
from app import model, model_helpers

app_obj = FastAPI()
app_obj.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,  # Set to True if cookies are needed
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


@app_obj.on_event("startup")
def on_startup():
    model.create_db_and_tables()

# route handlers


@app_obj.post("/token")
async def login(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        session: Session = Depends(model.get_db_session)):
    """
    Login API to authenticate a user and generate an access token.

    This function takes user credentials from the request body
    and validates them against the database.
    If the credentials are valid, it generates an access token
    with a specific expiration time 
    and returns it along with the token type.

    Args:
        form_data: An instance of `OAuth2PasswordRequestForm` containing
            user credentials.
            Retrieved from the request body using Depends.
        session: A SQLAlchemy database session object. Obtained using
            Depends from `model.get_db_session`.

    Raises:
        HTTPException: If the username or password is incorrect (400 Bad Request).

    Returns:
        A `model.Token` object containing the access token and token type.
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



@app_obj.post("/upload_activity", response_model=model.ActivityBase)
async def upload_activity(
    *,
    session: Session = Depends(model.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    file: Annotated[bytes, File()]):
    ride_df = model_helpers.extract_data_to_dataframe(fitparse.FitFile(file))
    activity_db = model.ActivityTable(
        activity_id=crypto.generate_random_base64_string(16),
        name="Ride",
        owner_id=current_user_id.id,
        date=ride_df.timestamp.iloc[0],
        last_modified=datetime.now(),
        data=model_helpers.serialize_dataframe(ride_df)
    )
    session.add(activity_db)
    session.commit()
    session.refresh(activity_db)
    return activity_db

@app_obj.get("/activity/{activity_id}", response_model=model.ActivityResponse)
async def get_activity(
    *,
    session: Session = Depends(model.get_db_session),
    activity_id: str):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    activity_response = model_helpers.get_activity_response(activity, include_raw_data=False)
    return activity_response

@app_obj.get("/activity/{activity_id}/raw")
async def get_activity_raw_columns(
    *,
    session: Session = Depends(model.get_db_session),
    activity_id: str,
    columns: str = None):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    activity_df = model_helpers.get_activity_raw_df(activity)
    activity_df.timestamp = activity_df.timestamp.apply(lambda x: x.timestamp() if x else None)
    activity_dict = activity_df.to_dict(orient="list")
    if columns:
        column_list = columns.split(",")
    else:
        column_list = [
            "timestamp", "power", "distance", "speed", "altitude",
            "position_lat", "position_long"]
    available_cols = set(activity_df.columns)
    activity_dict = {col: activity_dict[col] for col in column_list if col in available_cols}
    serialized_data = msgpack.packb(activity_dict)
    
    # Create a streaming response
    def generate_data():
        yield serialized_data

    return StreamingResponse(generate_data(), media_type="application/x-msgpack")

@app_obj.get("/activities", response_model=list[model.ActivityBase])
async def get_activities(
    *,
    session: Session = Depends(model.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    from_timestamp: datetime = None):
    q = select(model.ActivityTable).where(
        model.ActivityTable.owner_id == current_user_id.id)
    if from_timestamp:
        q = q.where(model.ActivityTable.last_modified > from_timestamp)
    return session.exec(q)

@app_obj.patch("/activity/{activity_id}", response_model=model.ActivityBase)
async def update_activity(
    *,
    session: Session = Depends(model.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_id: str,
    activity_update: model.ActivityUpdate):
    q = select(model.ActivityTable).where(model.ActivityTable.activity_id == activity_id)
    activity_db = session.exec(q).one()
    if activity_db.owner_id != current_user_id.id:
        return HTTPException(status_code=401, detail="Not authorized: User doesn't own activity")
    activity_db.sqlmodel_update(activity_update.model_dump(exclude_unset=True))
    session.add(activity_db)
    session.commit()
    session.refresh(activity_db)
    return activity_db

@app_obj.post("/user/signup", tags=["user"])
async def create_user(
    *,
    session: Session = Depends(model.get_db_session),
    user: model.UserCreate = Body(...)):
    """
    Creates a new user account.

    This API endpoint allows users to register and create new accounts. The
    provided `user` data is validated against the `model.UserCreate` schema. 
    The password is hashed before saving it to the database for security 
    reasons.

    Args:
        session: A SQLAlchemy database session object (Obtained using Depends).
        user: An instance of `model.UserCreate` containing the new 
          user's information.

    Returns:
        A `model.Token` object containing the access token and token type
        upon successful registration.
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
