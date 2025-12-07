import os
import logging
import msgpack
import pandas as pd
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Body, status
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session, select

from app import model, fit_parsing, gpx_parsing
from app.auth import auth_handler, crypto
from app.database import get_db_session
from app.services import analysis, maps, data_processing, activity_crud
from dateutil import parser as date_parser

logger = logging.getLogger('uvicorn.error')

router = APIRouter()

def _trigger_activity_recomputation_if_needed(activity: model.ActivityTable, session: Session) -> bool:
    """
    Checks if an activity's FIT data needs re-computation based on an environment variable
    and the last parsed timestamp. If so, performs the re-computation and updates the activity.
    """
    env_var_str = os.getenv("TRIGGER_FIT_RECOMPUTATION_BEFORE")
    logger.info(f"TRIGGER_FIT_RECOMPUTATION_BEFORE set to: {env_var_str}")
    if not env_var_str:
        logger.debug("TRIGGER_FIT_RECOMPUTATION_BEFORE not set. Proceeding without re-computation check.")
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
                logger.debug(f"No re-computation needed for activity {activity.activity_id}. Parsed at: {fit_parsed_at_aware}, Trigger date: {recomputation_trigger_datetime}")
            else:
                logger.debug(f"Conditions for re-computation not met for activity {activity.activity_id} (missing FIT file or parsed_at date).")
            return False

        logger.info(f"Triggering re-computation for activity {activity.activity_id} based on TRIGGER_FIT_RECOMPUTATION_BEFORE ({env_var_str}). Parsed at: {fit_parsed_at_aware}")

        recomputed_ride_df = fit_parsing.extract_data_to_dataframe(activity.fit_file)

        if recomputed_ride_df is None or recomputed_ride_df.empty:
            logger.warning(f"Re-computation of FIT file for activity {activity.activity_id} failed or resulted in empty data. Original data will be served.")
            return False

        activity.data = data_processing.serialize_dataframe(recomputed_ride_df)
        summary = analysis.compute_activity_summary(ride_df=recomputed_ride_df)

        activity.distance = summary.distance if summary.distance is not None else 0
        activity.active_time = summary.active_time if summary.active_time is not None else 0
        activity.elevation_gain = summary.elevation_gain if summary.elevation_gain is not None else 0

        activity.fit_file_parsed_at = datetime.now(datetime.now().astimezone().tzinfo)

        if activity.laps_data: # Check if laps_data was originally present
            go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
            if go_executable:
                laps_df = fit_parsing.go_extract_laps_data(go_executable, activity.fit_file)
                if laps_df is not None and not laps_df.empty:
                    activity.laps_data = data_processing.serialize_dataframe(laps_df)
                    logger.info(f"Successfully recomputed laps for activity {activity.activity_id}")
                elif laps_df is None:
                    logger.warning(f"Laps re-computation returned None for activity {activity.activity_id}")
                else: # laps_df is empty
                    logger.warning(f"Laps re-computation resulted in empty DataFrame for activity {activity.activity_id}")
            else:
                logger.warning(f"FIT_PARSE_GO_EXECUTABLE not set. Cannot re-extract lap data for activity {activity.activity_id}.")

        session.add(activity)
        session.commit()
        session.refresh(activity)
        logger.info(f"Successfully recomputed and updated activity {activity.activity_id}")
        return True

    except Exception as e:
        logging.warning(f"Failed to parse TRIGGER_FIT_RECOMPUTATION_BEFORE ('{env_var_str}') or error during re-computation check for activity {activity.activity_id}: {e}. Proceeding without re-computation.")
        return False

@router.post("/upload_activity", response_model=model.ActivityBase)
async def upload_activity(
    *,
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    file: UploadFile = File(...)):

    filename = file.filename
    file_bytes = await file.read()
    await file.close()

    ride_df = None
    activity_type = None
    default_name = "Activity"
    laps_df = None

    if filename.endswith('.fit'):
        ride_df = fit_parsing.extract_data_to_dataframe(file_bytes)
        activity_type = "recorded"
        default_name = "Ride"
        go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
        if go_executable:
            laps_df = fit_parsing.go_extract_laps_data(go_executable, file_bytes)
        else:
            logging.warning("FIT_PARSE_GO_EXECUTABLE not set. Cannot extract lap data.")
            pass
    elif filename.endswith('.gpx'):
        ride_df = gpx_parsing.parse_gpx_to_dataframe(file_bytes)
        activity_type = "route"
        default_name = "Route"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a .fit or .gpx file.")
    print(ride_df.head())

    if ride_df is None or ride_df.empty:
        raise HTTPException(status_code=400, detail="Failed to parse file or file is empty.")

    summary = analysis.compute_activity_summary(ride_df=ride_df)
    
    distance = summary.distance if summary.distance is not None else 0
    active_time = summary.active_time if summary.active_time is not None else 0
    elevation_gain = summary.elevation_gain if summary.elevation_gain is not None else 0
    
    activity_date = datetime.now()
    if not ride_df.empty and 'timestamp' in ride_df.columns and pd.api.types.is_datetime64_any_dtype(ride_df['timestamp']) and not ride_df['timestamp'].dropna().empty:
        activity_date = ride_df['timestamp'].dropna().iloc[0]
        if activity_date.tzinfo is None:
            activity_date = activity_date.tz_localize('UTC')
        else:
            activity_date = activity_date.tz_convert('UTC')
    
    activity_db = model.ActivityTable(
        activity_id=crypto.generate_random_base64_string(16),
        name=default_name,
        owner_id=current_user_id.id,
        activity_type=activity_type,
        distance=distance,
        active_time=active_time,
        elevation_gain=elevation_gain,
        date=activity_date,
        last_modified=datetime.now(datetime.now().astimezone().tzinfo),
        data=data_processing.serialize_dataframe(ride_df),
        tags=None
    )

    if filename.endswith('.fit'):
        activity_db.fit_file = file_bytes
        activity_db.fit_file_parsed_at = datetime.now(datetime.now().astimezone().tzinfo)

    if laps_df is not None and not laps_df.empty:
        activity_db.laps_data = data_processing.serialize_dataframe(laps_df)

    session.add(activity_db)

    # Update user power curve
    user = session.get(model.User, current_user_id.id)
    if user and ride_df is not None and not ride_df.empty:
        new_curve = analysis.calculate_power_curve(ride_df)
        user.power_curve = analysis.merge_power_curves(user.power_curve, new_curve)
        session.add(user)

    session.commit()
    session.refresh(activity_db)
    return activity_db

@router.get("/activity/{activity_id}", response_model=model.ActivityResponse)
async def get_activity_endpoint(
    *,
    session: Session = Depends(get_db_session),
    activity_id: str):
    
    # Using raw sqlmodel select instead of fetch_activity because we might want to check recomputation before fetching full response
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    if _trigger_activity_recomputation_if_needed(activity, session):
        logging.info(f"Activity {activity_id} data was recomputed based on trigger.")

    owner = session.get(model.User, activity.owner_id)
    user_zones = owner.power_zones if owner else None

    activity_response = analysis.get_activity_response(activity, include_raw_data=False, user_zones=user_zones)
    return activity_response

@router.get("/activity/{activity_id}/power-curve", response_model=list[dict[str, float]])
async def get_activity_power_curve(
    *,
    session: Session = Depends(get_db_session),
    activity_id: str):
    
    activity = activity_crud.fetch_activity(activity_id, session)
    # fetch_activity raises 404 if not found
    
    activity_df = data_processing.get_activity_df(activity)
    power_curve = analysis.calculate_power_curve(activity_df)
    
    return power_curve

@router.get("/activity_map/{activity_id}")
async def get_activity_map_endpoint(
    *,
    session: Session = Depends(get_db_session),
    activity_id: str):
    activity = activity_crud.fetch_activity(activity_id, session)
    if not activity.static_map:
        activity_df = data_processing.get_activity_df(activity)
        activity.static_map = maps.get_activity_map(ride_df=activity_df, num_samples=200)
        if not activity.static_map:
            raise HTTPException(status_code=404, detail="GPS data not available")
        session.add(activity)
        session.commit()
    return Response(activity.static_map, media_type="image/png")

@router.get("/activity/{activity_id}/gpx")
async def get_activity_gpx_route(
    *,
    session: Session = Depends(get_db_session),
    activity_id: str):
    activity = activity_crud.fetch_activity(activity_id, session)
    activity_df = data_processing.get_activity_df(activity)
    gpx_content = maps.get_activity_gpx(activity_df)

    def iterfile():
        yield gpx_content

    return StreamingResponse(
        iterfile(),
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f"attachment; filename={activity_id}.gpx"}
    )

@router.get("/activity/{activity_id}/raw")
async def get_activity_raw_columns(
    *,
    session: Session = Depends(get_db_session),
    activity_id: str,
    columns: str = None):
    activity_df = activity_crud.fetch_activity_df(activity_id, session)
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
    
    def generate_data():
        yield serialized_data

    return StreamingResponse(generate_data(), media_type="application/x-msgpack")

@router.get("/activities", response_model=list[model.ActivityBase])
async def get_activities(
    *,
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_type: Optional[str] = None,
    search_query: Optional[str] = None,
    limit: int = 10,
    cursor_date: Optional[datetime] = None,
    cursor_id: Optional[str] = None
):
    """
    Fetches a list of activities for the current user, sorted by date descending.
    """
    q = select(model.ActivityTable).where(
        model.ActivityTable.owner_id == current_user_id.id)

    if activity_type:
        q = q.where(model.ActivityTable.activity_type == activity_type)

    if search_query:
        all_matching_activities = session.exec(q.order_by(model.ActivityTable.date.desc())).all()
        ranked_activities = analysis.search_and_rank_activities(all_matching_activities, search_query)
        results = ranked_activities[:limit]
    else:
        if cursor_date is not None and cursor_id is not None:
            q = q.where(
                (model.ActivityTable.date < cursor_date) |
                ((model.ActivityTable.date == cursor_date) & (model.ActivityTable.activity_id < cursor_id))
            )
        q = q.order_by(model.ActivityTable.date.desc(), model.ActivityTable.activity_id.desc()).limit(limit)
        results = session.exec(q).all()

    return results

@router.patch("/activity/{activity_id}", response_model=model.ActivityBase)
async def update_activity(
    *,
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_id: str,
    activity_update: model.ActivityUpdate = Body(...)):

    q = select(model.ActivityTable).where(model.ActivityTable.activity_id == activity_id)
    activity_db = session.exec(q).one()
    if activity_db.owner_id != current_user_id.id:
        return Response(status_code=401)
    activity_db.sqlmodel_update(activity_update.model_dump(exclude_unset=True))
    session.add(activity_db)
    session.commit()
    session.refresh(activity_db)
    return activity_db

@router.delete("/activity/{activity_id}")
async def delete_activity(
    *,
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    activity_id: str):
    """Deletes an activity owned by the current user."""
    activity_db = session.exec(
        select(model.ActivityTable).where(model.ActivityTable.activity_id == activity_id)
    ).first()

    if not activity_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    if activity_db.owner_id != current_user_id.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized: User doesn't own activity")

    session.delete(activity_db)
    session.commit()

    return Response(status_code=200)
