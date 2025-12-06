import os
import io
import numpy as np
import pandas as pd
import gpxpy
import gpxpy.gpx
from staticmap import StaticMap, Line
from fastapi import HTTPException

# Helper from analysis/data_processing needed?
# subsample_timeseries is needed. It's a math helper.
# I'll duplicate it or put it in a common `utils.py`.
# For now, I'll allow duplication of simple helpers or put it here if only used here.
# `subsample_timeseries` is used in `elev_summary` (analysis) and `get_activity_map` (maps).
# I'll put it in `backend/app/services/utils.py`.

from app.services import utils

def get_activity_map(ride_df: pd.DataFrame, num_samples: int):
    """ Creates a static map of an activity.
    """
    if not 'position_lat' in ride_df.columns or not 'position_long' in ride_df.columns:
        return None
    df = ride_df.dropna(subset=['position_lat', 'position_long'])
    w = int(os.getenv("STATIC_MAP_W", "400"))
    h = int(os.getenv("STATIC_MAP_H", "300"))
    m = StaticMap(w, h, 10)
    lat = utils.subsample_timeseries(df.position_lat, num_samples=num_samples)
    long = utils.subsample_timeseries(df.position_long, num_samples=num_samples)
    line = list(zip(long, lat))
    m.add_line(Line(line, 'blue', 3))
    image = m.render()
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

def has_gps_data(activity_df):
    return 'position_lat' in activity_df.columns and \
        'position_long' in activity_df.columns

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
