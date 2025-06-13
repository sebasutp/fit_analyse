"""API methods."""

import os
import json
import logging
from datetime import timedelta, datetime, timezone
from typing import Annotated, Optional
import pandas as pd
from dateutil import parser as date_parser

import msgpack

from fastapi import Body, Depends, FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse, Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.auth import auth_handler
from app.auth import crypto
from app import model, model_helpers, fit_parsing, gpx_parsing
from app.fit_parsing import go_extract_laps_data # Ensure this is correctly placed if not covered by above

app_obj = FastAPI()
app_obj.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,  # Set to True if cookies are needed
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


# route handlers


@app_obj.post("/token")
async def login(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        session: Session = Depends(model_helpers.get_db_session)):
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
            Depends from `get_db_session`.

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
    session: Session = Depends(model_helpers.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    file: UploadFile = File(...)):

    filename = file.filename
    file_bytes = await file.read()
    await file.close() # Close the file after reading

    ride_df = None
    activity_type = None
    default_name = "Activity"
    laps_df = None # Initialize laps_df

    if filename.endswith('.fit'):
        ride_df = fit_parsing.extract_data_to_dataframe(file_bytes)
        activity_type = "recorded"
        default_name = "Ride"
        # Attempt to extract laps data for FIT files
        go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
        if go_executable:
            laps_df = fit_parsing.go_extract_laps_data(go_executable, file_bytes)
        else:
            logging.warning("FIT_PARSE_GO_EXECUTABLE not set. Cannot extract lap data.")
            pass # Or handle as preferred
    elif filename.endswith('.gpx'):
        ride_df = gpx_parsing.parse_gpx_to_dataframe(file_bytes)
        activity_type = "route"
        default_name = "Route"
        # For GPX, 'distance' and 'speed' might not be in ride_df initially.
        # compute_activity_summary might fail or return 0/None for these.
        # We need to ensure ActivityTable gets valid values.
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a .fit or .gpx file.")
    print(ride_df.head())

    if ride_df is None or ride_df.empty:
        raise HTTPException(status_code=400, detail="Failed to parse file or file is empty.")

    # Attempt to compute summary. Handle potential issues for GPX.
    summary = model_helpers.compute_activity_summary(ride_df=ride_df)
    
    # Ensure required fields for ActivityTable have fallbacks for GPX if summary didn't provide them
    distance = summary.distance if summary.distance is not None else 0
    active_time = summary.active_time if summary.active_time is not None else 0
    elevation_gain = summary.elevation_gain if summary.elevation_gain is not None else 0
    
    # Date handling
    activity_date = datetime.now() # Default to now
    if not ride_df.empty and 'timestamp' in ride_df.columns and pd.api.types.is_datetime64_any_dtype(ride_df['timestamp']) and not ride_df['timestamp'].dropna().empty:
        activity_date = ride_df['timestamp'].dropna().iloc[0]
        # Ensure timezone awareness (UTC)
        if activity_date.tzinfo is None:
            activity_date = activity_date.tz_localize('UTC')
        else:
            activity_date = activity_date.tz_convert('UTC')
    
    activity_db = model.ActivityTable(
        activity_id=crypto.generate_random_base64_string(16),
        name=default_name, # Use default_name based on file type
        owner_id=current_user_id.id,
        activity_type=activity_type, # Set the activity type
        distance=distance,
        active_time=active_time,
        elevation_gain=elevation_gain,
        date=activity_date,
        last_modified=datetime.now(datetime.now().astimezone().tzinfo), # Use timezone-aware datetime
        data=model_helpers.serialize_dataframe(ride_df)
    )

    # Add FIT file specific data if it's a FIT file
    if filename.endswith('.fit'):
        activity_db.fit_file = file_bytes
        activity_db.fit_file_parsed_at = datetime.now(datetime.now().astimezone().tzinfo)

    # Add laps_data if available
    if laps_df is not None and not laps_df.empty:
        activity_db.laps_data = model_helpers.serialize_dataframe(laps_df)

    session.add(activity_db)
    session.commit()
    session.refresh(activity_db)
    return activity_db


def _trigger_activity_recomputation_if_needed(activity: model.ActivityTable, session: Session) -> bool:
    """
    Checks if an activity's FIT data needs re-computation based on an environment variable
    and the last parsed timestamp. If so, performs the re-computation and updates the activity.
    """
    env_var_str = os.getenv("TRIGGER_FIT_RECOMPUTATION_AFTER")
    if not env_var_str:
        logging.debug("TRIGGER_FIT_RECOMPUTATION_AFTER not set. Proceeding without re-computation check.")
        return False

    try:
        parsed_date = date_parser.parse(env_var_str).date()
        recomputation_trigger_datetime = datetime.combine(parsed_date, datetime.min.time(), tzinfo=timezone.utc)

        fit_parsed_at_aware = None
        if activity.fit_file_parsed_at:
            if activity.fit_file_parsed_at.tzinfo is None:
                fit_parsed_at_aware = activity.fit_file_parsed_at.replace(tzinfo=timezone.utc)
            else:
                fit_parsed_at_aware = activity.fit_file_parsed_at

        if not (activity.fit_file and fit_parsed_at_aware and fit_parsed_at_aware < recomputation_trigger_datetime):
            if activity.fit_file and fit_parsed_at_aware:
                 logging.debug(f"No re-computation needed for activity {activity.activity_id}. Parsed at: {fit_parsed_at_aware}, Trigger date: {recomputation_trigger_datetime}")
            else:
                logging.debug(f"Conditions for re-computation not met for activity {activity.activity_id} (missing FIT file or parsed_at date).")
            return False

        logging.info(f"Triggering re-computation for activity {activity.activity_id} based on TRIGGER_FIT_RECOMPUTATION_AFTER ({env_var_str}). Parsed at: {fit_parsed_at_aware}")

        recomputed_ride_df = fit_parsing.extract_data_to_dataframe(activity.fit_file)

        if recomputed_ride_df is None or recomputed_ride_df.empty:
            logging.warning(f"Re-computation of FIT file for activity {activity.activity_id} failed or resulted in empty data. Original data will be served.")
            return False

        activity.data = model_helpers.serialize_dataframe(recomputed_ride_df)
        summary = model_helpers.compute_activity_summary(ride_df=recomputed_ride_df)

        activity.distance = summary.distance if summary.distance is not None else 0
        activity.active_time = summary.active_time if summary.active_time is not None else 0
        activity.elevation_gain = summary.elevation_gain if summary.elevation_gain is not None else 0

        activity.fit_file_parsed_at = datetime.now(datetime.now().astimezone().tzinfo)

        if activity.laps_data: # Check if laps_data was originally present
            go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
            if go_executable:
                laps_df = fit_parsing.go_extract_laps_data(go_executable, activity.fit_file)
                if laps_df is not None and not laps_df.empty:
                    activity.laps_data = model_helpers.serialize_dataframe(laps_df)
                    logging.info(f"Successfully recomputed laps for activity {activity.activity_id}")
                elif laps_df is None:
                    logging.warning(f"Laps re-computation returned None for activity {activity.activity_id}")
                else: # laps_df is empty
                    logging.warning(f"Laps re-computation resulted in empty DataFrame for activity {activity.activity_id}")
            else:
                logging.warning(f"FIT_PARSE_GO_EXECUTABLE not set. Cannot re-extract lap data for activity {activity.activity_id}.")

        session.add(activity)
        session.commit()
        session.refresh(activity)
        logging.info(f"Successfully recomputed and updated activity {activity.activity_id}")
        return True

    except Exception as e:
        logging.warning(f"Failed to parse TRIGGER_FIT_RECOMPUTATION_AFTER ('{env_var_str}') or error during re-computation check for activity {activity.activity_id}: {e}. Proceeding without re-computation.")
        return False


@app_obj.get("/activity/{activity_id}", response_model=model.ActivityResponse)
async def get_activity(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    activity_id: str):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    if _trigger_activity_recomputation_if_needed(activity, session):
        logging.info(f"Activity {activity_id} data was recomputed based on trigger.")

    activity_response = model_helpers.get_activity_response(activity, include_raw_data=False)
    return activity_response

@app_obj.get("/activity_map/{activity_id}")
async def get_activity_map(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    activity_id: str):
    activity = model_helpers.fetch_activity(activity_id, session)
    if not activity.static_map:
        activity_df = model_helpers.get_activity_df(activity)
        activity.static_map = model_helpers.get_activity_map(ride_df=activity_df, num_samples=200)
        if not activity.static_map:
            raise HTTPException(status_code=404, detail="GPS data not available")
        # Save the map for a future call
        session.add(activity)
        session.commit()
    return Response(activity.static_map, media_type="image/png")

@app_obj.get("/activity/{activity_id}/gpx")
async def get_activity_gpx_route(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    activity_id: str):
    activity = model_helpers.fetch_activity(activity_id, session)
    activity_df = model_helpers.get_activity_df(activity)
    gpx_content = model_helpers.get_activity_gpx(activity_df)

    def iterfile():
        yield gpx_content

    return StreamingResponse(
        iterfile(),
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f"attachment; filename={activity_id}.gpx"}
    )

@app_obj.get("/activity/{activity_id}/raw")
async def get_activity_raw_columns(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    activity_id: str,
    columns: str = None):
    activity_df = model_helpers.fetch_activity_df(activity_id, session)
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
    session: Session = Depends(model_helpers.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_type: Optional[str] = None, # New query parameter for filtering
    limit: int = 10, # Default limit
    cursor_date: Optional[datetime] = None, # The 'date' of the last item seen
    cursor_id: Optional[str] = None # The 'activity_id' of the last item seen
):
    """
    Fetches a list of activities for the current user, sorted by date descending.
    Uses keyset (cursor-based) pagination for efficient loading.
    """
    q = select(model.ActivityTable).where(
        model.ActivityTable.owner_id == current_user_id.id)

    # Apply activity_type filter if provided
    if activity_type:
        q = q.where(model.ActivityTable.activity_type == activity_type)

    # Apply cursor conditions if provided (for subsequent pages)
    if cursor_date is not None and cursor_id is not None:
        # Fetch items older than the cursor date, or same date but smaller ID (since ID is random string, comparison works)
        # Note: Adjust comparison (< or >) based on desired sort order (DESC vs ASC)
        q = q.where(
            (model.ActivityTable.date < cursor_date) |
            ((model.ActivityTable.date == cursor_date) & (model.ActivityTable.activity_id < cursor_id))
        )

    # Always apply sorting and limit
    q = q.order_by(model.ActivityTable.date.desc(), model.ActivityTable.activity_id.desc()).limit(limit)

    results = session.exec(q).all()
    return results

@app_obj.patch("/activity/{activity_id}", response_model=model.ActivityBase)
async def update_activity(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_id: str,
    activity_update: model.ActivityUpdate = Body(...)):

    q = select(model.ActivityTable).where(model.ActivityTable.activity_id == activity_id)
    activity_db = session.exec(q).one()
    if activity_db.owner_id != current_user_id.id:
        return HTTPException(status_code=401, detail="Not authorized: User doesn't own activity")
    activity_db.sqlmodel_update(activity_update.model_dump(exclude_unset=True))
    session.add(activity_db)
    session.commit()
    session.refresh(activity_db)
    return activity_db

@app_obj.delete("/activity/{activity_id}")
async def delete_activity(
    *,
    session: Session = Depends(model_helpers.get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_id: str):
    """Deletes an activity owned by the current user."""
    activity_db = session.exec(
        select(model.ActivityTable).where(model.ActivityTable.activity_id == activity_id)
    ).first()

    if not activity_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    if activity_db.owner_id != current_user_id.id:
        # Use 403 Forbidden as the user is authenticated but not authorized for this resource
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized: User doesn't own activity")

    session.delete(activity_db)
    session.commit()

    # Return No Content response explicitly for DELETE success
    return Response(status_code=200)

@app_obj.post("/user/signup", tags=["user"])
async def create_user(
    *,
    session: Session = Depends(model_helpers.get_db_session),
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
