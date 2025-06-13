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

# Refactored compute_power_summary
def compute_power_summary(df: pd.DataFrame) -> model.PowerSummary | None: # Using | None for Python 3.9+
    if df is None or df.empty or 'power' not in df.columns:
        return None

    df_power = df['power'].dropna()
    if df_power.empty:
        return None

    average_power = df_power.mean()
    median_power = df_power.median()

    total_work_joules = 0.0
    # Calculate total work (Joules) if timestamp and power are available
    # This requires time difference, so needs 'timestamp' column properly formatted
    if 'timestamp' in df.columns and not df_power.empty:
        # Ensure 'timestamp' is datetime and DataFrame is sorted by it for diff() to be meaningful
        df_sorted = df.sort_values(by='timestamp').copy() # Use .copy() to avoid SettingWithCopyWarning
        if not pd.api.types.is_datetime64_any_dtype(df_sorted['timestamp']):
             df_sorted['timestamp'] = pd.to_datetime(df_sorted['timestamp'])

        df_sorted['time_diff'] = df_sorted['timestamp'].diff().dt.total_seconds()

        # Power (Watts = J/s) * time_diff (s) = Work (J)
        # Only consider time diffs where power is not NaN for that interval
        # Summing product of power and time_diff for each interval
        # Ensure power used is from the same row as time_diff (or the start of the interval)
        # A common approach is to use power at the start of the interval or average power over the interval
        # Here, using power of the current record with time_diff from previous.
        valid_work_calc = df_sorted.dropna(subset=['power', 'time_diff'])
        if not valid_work_calc.empty:
            # Make sure power is numeric after potential NA drops
            numeric_power = pd.to_numeric(valid_work_calc['power'], errors='coerce').fillna(0)
            total_work_joules = (numeric_power * valid_work_calc['time_diff']).sum()

    power_quantiles = list(df_power.quantile([i/100.0 for i in range(101)]))

    return model.PowerSummary(
        average_power=float(average_power) if pd.notna(average_power) else 0.0,
        median_power=float(median_power) if pd.notna(median_power) else 0.0,
        total_work=float(total_work_joules / 1000.0), # Convert to kJ
        quantiles=power_quantiles
    )

def compute_lap_metrics(lap_data_row: pd.Series, activity_df: pd.DataFrame) -> model.LapMetrics:
    lap_start_time = pd.to_datetime(lap_data_row['start_time'])
    lap_end_time = pd.to_datetime(lap_data_row['timestamp'])

    # Filter the main activity DataFrame for the lap duration
    # Ensure activity_df['timestamp'] is datetime objects
    activity_df_copy = activity_df.copy() # Work on a copy
    if not pd.api.types.is_datetime64_any_dtype(activity_df_copy['timestamp']):
        activity_df_copy['timestamp'] = pd.to_datetime(activity_df_copy['timestamp'])

    lap_segment_df = activity_df_copy[
        (activity_df_copy['timestamp'] >= lap_start_time) & \
        (activity_df_copy['timestamp'] <= lap_end_time)
    ].copy() # Use .copy() to avoid SettingWithCopyWarning further

    # Calculate PowerSummary for the lap segment
    power_summary_for_lap = compute_power_summary(lap_segment_df)

    # Populate LapMetrics
    lap_metrics_obj = model.LapMetrics(
        start_time=str(lap_start_time),
        timestamp=str(lap_end_time),
        total_distance=lap_data_row.get('total_distance'),
        total_elapsed_time=lap_data_row.get('total_elapsed_time'),
        total_timer_time=lap_data_row.get('total_timer_time'),
        avg_speed=lap_data_row.get('avg_speed'),
        max_speed=lap_data_row.get('max_speed'),
        total_ascent=lap_data_row.get('total_ascent'),
        total_descent=lap_data_row.get('total_descent'),
        max_power=lap_data_row.get('max_power'), # Get from Go data
        power_summary=power_summary_for_lap
    )
    return lap_metrics_obj

def compute_activity_summary(ride_df: pd.DataFrame, num_samples: int = 200):
    # total_time here refers to number of records, which is 1Hz for FIT usually.
    # For GPX or other sources, this might need adjustment if it's not 1 sample per second.
    total_time_seconds = len(ride_df) # Assuming 1 record per second for active_time calculation

    elevation_gain = compute_elevation_gain(ride_df, tolerance=2, min_elev=4.0) if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty else 0.0

    distance_km = (ride_df['distance'].iloc[-1] / 1000.0) if 'distance' in ride_df.columns and not ride_df['distance'].empty else 0.0

    # Avg speed: prefer calculation from total distance and total elapsed time if available and reliable
    # The direct mean of speed sensors can be noisy or misleading if stops are not handled.
    # However, using ride_df['speed'].mean() is simpler if total_elapsed_time_proper is hard to get.
    avg_speed_kmh = (ride_df['speed'].mean() * 3.6) if 'speed' in ride_df.columns and not ride_df['speed'].dropna().empty else 0.0

    # Elapsed time: Difference between first and last timestamp.
    # Ensure timestamp column is datetime objects
    actual_elapsed_time_seconds = 0.0
    if 'timestamp' in ride_df.columns and not ride_df['timestamp'].dropna().empty:
        if not pd.api.types.is_datetime64_any_dtype(ride_df['timestamp']):
            ride_df['timestamp'] = pd.to_datetime(ride_df['timestamp']) # Ensure datetime objects
        # Sort by timestamp before taking first and last to ensure correctness
        sorted_timestamps = ride_df['timestamp'].dropna().sort_values()
        if not sorted_timestamps.empty:
            actual_elapsed_time_seconds = (sorted_timestamps.iloc[-1] - sorted_timestamps.iloc[0]).total_seconds()

    summary = model.ActivitySummary(
        distance=distance_km,
        total_elapsed_time=actual_elapsed_time_seconds, # This is wall clock time
        active_time=float(total_time_seconds), # This is recording duration (sum of 1s intervals)
        elevation_gain=elevation_gain,
        average_speed=avg_speed_kmh # Could also be distance_km / (actual_elapsed_time_seconds / 3600) if actual_elapsed_time is reliable
    )

    # Call the refactored power summary function
    summary.power_summary = compute_power_summary(ride_df)

    if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty:
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

    activity_df = None
    if activity_db.data: # Check if records data exists
        activity_df = deserialize_dataframe(activity_db.data)
        # Ensure activity_df's timestamp column is datetime for lap processing
        if activity_df is not None and not activity_df.empty and 'timestamp' in activity_df.columns and \
           not pd.api.types.is_datetime64_any_dtype(activity_df['timestamp']):
            activity_df['timestamp'] = pd.to_datetime(activity_df['timestamp'])

    # Initialize ActivityResponse, compute activity_analysis if activity_df is available
    if activity_df is not None and not activity_df.empty:
        activity_analysis_summary = compute_activity_summary(activity_df)
        has_gps = has_gps_data(activity_df)
    else:
        # Fallback if activity_df could not be loaded or is empty
        # Create a minimal ActivitySummary or handle as appropriate
        activity_analysis_summary = model.ActivitySummary(total_elapsed_time=0, active_time=0) # Example
        has_gps = False


    ans = model.ActivityResponse(
        activity_base=activity_db,
        activity_analysis=activity_analysis_summary,
        has_gps_data=has_gps
    )

    if include_raw_data and activity_df is not None and not activity_df.empty:
        ans.activity_data = activity_df.to_json() # For raw records data

    # Process laps if laps_data exists and activity_df (records) is available
    if activity_db.laps_data and activity_df is not None and not activity_df.empty:
        laps_df_raw = deserialize_dataframe(activity_db.laps_data)
        if laps_df_raw is not None and not laps_df_raw.empty:
            processed_laps_list = []

            # Ensure timestamp columns in laps_df_raw are datetime objects for comparison
            # These should already be datetime if Arrow parsing was correct
            if 'start_time' in laps_df_raw.columns and \
               not pd.api.types.is_datetime64_any_dtype(laps_df_raw['start_time']):
                 laps_df_raw['start_time'] = pd.to_datetime(laps_df_raw['start_time'])
            if 'timestamp' in laps_df_raw.columns and \
               not pd.api.types.is_datetime64_any_dtype(laps_df_raw['timestamp']):
                 laps_df_raw['timestamp'] = pd.to_datetime(laps_df_raw['timestamp'])

            for index, lap_row_series in laps_df_raw.iterrows():
                if 'start_time' not in lap_row_series or pd.isna(lap_row_series['start_time']) or \
                   'timestamp' not in lap_row_series or pd.isna(lap_row_series['timestamp']):
                    # Log or skip if essential time data is missing for a lap
                    # print(f"Skipping lap due to missing time data: {lap_row_series}") # Replace with logging
                    continue

                lap_metrics_instance = compute_lap_metrics(lap_row_series, activity_df)
                processed_laps_list.append(lap_metrics_instance)

            if processed_laps_list: # Only assign if we have successfully processed laps
                ans.laps = processed_laps_list
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
    if 'altitude' in valid_rows.columns:
        alt = valid_rows['altitude'].to_numpy()
        has_alt = ~np.isnan(alt)
        print(has_alt.shape)
    else:
        alt = None

    for index in range(len(valid_rows)):
        gpx_point = gpxpy.gpx.GPXTrackPoint(
            latitude=lat[index],
            longitude=long[index]
        )
        if alt is not None and has_alt[index]:
            gpx_point.elevation = alt[index]
        gpx_segment.points.append(gpx_point)

    return gpx.to_xml()


import re

# Assuming ActivityTable is already available via 'from app import model'
# and Sequence from 'from typing import Sequence'

def search_and_rank_activities(
    activities: Sequence[model.ActivityTable],
    search_query: str
) -> list[model.ActivityTable]:
    if not search_query:
        return list(activities)

    search_terms = {term.lower() for term in re.split(r'\s+', search_query.strip()) if term}
    if not search_terms:
        return list(activities)

    scored_activities = []

    for activity in activities:
        score = 0

        # Score based on title match
        activity_title_words = set()
        if activity.name: # Ensure name is not None
            activity_title_words = {word.lower() for word in re.split(r'\s+', activity.name.strip()) if word}
        score += len(search_terms.intersection(activity_title_words))

        # Score based on tag match
        if activity.tags:
            activity_tags_lower = {tag.lower() for tag in activity.tags}
            score += len(search_terms.intersection(activity_tags_lower))

        if score > 0:
            scored_activities.append({"activity": activity, "score": score})

    # Sort activities by score in descending order
    # If scores are equal, sort by date as secondary to maintain some stability
    sorted_activities_with_scores = sorted(
        scored_activities,
        key=lambda x: (x["score"], x["activity"].date),
        reverse=True
    )

    return [item["activity"] for item in sorted_activities_with_scores]
