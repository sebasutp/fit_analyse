import os
import io
import numpy as np
import pandas as pd
from app import model
import pyarrow.feather as feather
import gpxpy
import gpxpy.gpx

from typing import Sequence
from sqlmodel import create_engine, Session, select
from fastapi import HTTPException
from staticmap import StaticMap, Line
from fastapi.responses import Response

connect_args = {"check_same_thread": False}
engine = create_engine(
    os.getenv("DB_URL"),
    echo=True,
    connect_args=connect_args)

def get_db_session():
    """Returns DB session."""
    with Session(engine) as session:
        yield session

def remove_columns(df: pd.DataFrame, cols: Sequence[str]):
    keep_cols = [x for x in df.columns if not x in set(cols)]
    return df[keep_cols]

def serialize_dataframe(df: pd.DataFrame):
    rem_cols = ['left_right_balance']
    with io.BytesIO() as buffer:
        remove_columns(df, rem_cols).to_feather(buffer)
        serialized = buffer.getvalue()
    return serialized

def deserialize_dataframe(serialized: bytes):
    return feather.read_feather(io.BytesIO(serialized))

def compute_elevation_gain_intervals(df: pd.DataFrame, tolerance=1.0, min_elev=1.0):
    altitude_series = df.altitude.dropna()
    altitude = altitude_series.to_list()
    original_ix = altitude_series.index
    #print(len(original_ix), len(altitude))
    climbs = []
    high_ix = low_ix = 0
    for i, h in enumerate(altitude):
        if h < altitude[low_ix]:
            low_ix = i
        if h > altitude[high_ix]:
            high_ix = i
        if h < (altitude[high_ix] - tolerance):
            # It means we are going down again
            climb = model.Climb(
                from_ix=original_ix[low_ix],
                to_ix=original_ix[high_ix],
                elevation=altitude[high_ix] - altitude[low_ix]
            )
            #print(low_ix, high_ix, climb)
            if climb.from_ix < climb.to_ix and climb.elevation > min_elev:
                climbs.append(climb)
            low_ix = i
            high_ix = i
    return climbs

def compute_elevation_gain(df: pd.DataFrame, tolerance: float, min_elev: float):
    segments = compute_elevation_gain_intervals(df, tolerance, min_elev)
    return sum(map(lambda x: x.elevation, segments))

def subsample_timeseries(time_series: pd.Series, num_samples: int):
    indices = np.linspace(0, len(time_series) - 1, num_samples, dtype=int)
    return time_series.to_numpy()[indices].tolist()

def get_activity_map(ride_df: pd.DataFrame, num_samples: int):
    """ Creates a static map of an activity.
    """
    if not 'position_lat' in ride_df.columns or not 'position_long' in ride_df.columns:
        return None
    df = ride_df.dropna(subset=['position_lat', 'position_long'])
    w = int(os.getenv("STATIC_MAP_W", "400"))
    h = int(os.getenv("STATIC_MAP_H", "300"))
    m = StaticMap(w, h, 10)
    lat = subsample_timeseries(df.position_lat, num_samples=num_samples)
    long = subsample_timeseries(df.position_long, num_samples=num_samples)
    line = list(zip(long, lat))
    m.add_line(Line(line, 'blue', 3))
    image = m.render()
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

def elev_summary(ride_df: pd.DataFrame, num_samples: int):
    n = min(len(ride_df.altitude), num_samples)
    summary = model.ElevationSummary(
        lowest=ride_df.altitude.min(),
        highest=ride_df.altitude.max(),
        elev_series=subsample_timeseries(ride_df.altitude, n),
        dist_series=subsample_timeseries(ride_df.distance / 1000.0, n)
    )
    return summary

def compute_activity_summary(ride_df: pd.DataFrame, num_samples: int = 200):
    total_time = len(ride_df)
    elevation_gain = compute_elevation_gain(ride_df, tolerance=2, min_elev=4.0) if 'altitude' in ride_df.columns else 0

    summary = model.ActivitySummary(
        distance=ride_df['distance'].iloc[-1] / 1000,
        total_elapsed_time=(ride_df['timestamp'].iloc[-1] - ride_df['timestamp'][0]).seconds,
        active_time=total_time,
        elevation_gain=elevation_gain,
        average_speed=ride_df['speed'].mean() * 3.6  # From m/s to km/h
    )
    if 'power' in ride_df.columns:
        work = ride_df.power.sum()
        quantiles = ride_df.power.quantile(np.arange(0, 101)/100)
        summary.power_summary = model.PowerSummary(
            average_power = work / total_time,
            median_power = quantiles.iloc[50],
            total_work = work / 1000,  # to KJ instad of Joules
            quantiles = quantiles.to_list()
        )
    if 'altitude' in ride_df.columns:
        summary.elev_summary = elev_summary(ride_df, num_samples)
    return summary

def get_activity_raw_df(activity_db: model.ActivityTable):
    return deserialize_dataframe(activity_db.data)

def has_gps_data(activity_df):
    return 'position_lat' in activity_df.columns and \
        'position_long' in activity_df.columns

def get_activity_response(
        activity_db: model.ActivityTable,
        include_raw_data: bool = False):
    activity_df = get_activity_raw_df(activity_db)
    ans = model.ActivityResponse(
        activity_base=activity_db,
        activity_analysis=compute_activity_summary(activity_df),
        has_gps_data=has_gps_data(activity_df)
    )
    if include_raw_data:
        ans.activity_data = activity_df.to_json()
    return ans

def fetch_activity(activity_id: str, session: Session):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

def get_activity_df(activity: model.ActivityTable):
    activity_df = get_activity_raw_df(activity)
    activity_df.timestamp = activity_df.timestamp.apply(lambda x: x.timestamp() if x else None)
    return activity_df

def fetch_activity_df(activity_id: str, session: Session):
    activity = fetch_activity(activity_id, session)
    return get_activity_df(activity)

def get_activity_gpx(ride_df: pd.DataFrame):
    """
    Generates a GPX file content from a DataFrame containing ride data using gpxpy.

    Args:
        ride_df: DataFrame with 'timestamp', 'position_lat', and 'position_long' columns.

    Returns:
        GPX file content as a string.
    """
    if not has_gps_data(ride_df):
        raise HTTPException(status_code=404, detail="GPS data not available")

    # Filter out rows with missing lat/long
    valid_rows = ride_df.dropna(subset=['position_lat', 'position_long'])

    if valid_rows.empty:
        gpx = gpxpy.gpx.GPX()
        return gpx.to_xml()

    gpx = gpxpy.gpx.GPX()
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx.tracks.append(gpx_track)
    gpx_segment = gpxpy.gpx.GPXTrackSegment()
    gpx_track.segments.append(gpx_segment)

    lat = valid_rows['position_lat'].to_numpy()
    long = valid_rows['position_long'].to_numpy()
    # if 'altitude' in valid_rows.columns:
    #     alt = valid_rows['altitude'].to_numpy()
    #     has_alt = ~np.isnan(alt)
    #     print(has_alt.shape)
    # else:
    #     alt = None

    for index in range(len(valid_rows)):
        gpx_point = gpxpy.gpx.GPXTrackPoint(
            latitude=lat[index],
            longitude=long[index]
        )
        # if alt and has_alt[index]:
        #     gpx_point.elevation = alt[index]
        gpx_segment.points.append(gpx_point)

    return gpx.to_xml()
