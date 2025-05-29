"""GPX file parsing utilities."""

import gpxpy
import gpxpy.gpx
import pandas as pd
from io import BytesIO
import numpy as np


def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points
    on the earth (specified in decimal degrees).
    Accepts scalar or array-like inputs.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    r = 6371000 # Radius of earth in meters
    return c * r

def parse_gpx_to_dataframe(gpx_bytes: bytes) -> pd.DataFrame:
    """Parses GPX data and returns a pandas DataFrame.

    Args:
        gpx_bytes: Bytes of the GPX file.

    Returns:
        A pandas DataFrame with columns: 'timestamp', 'position_lat', 
        'position_long', 'altitude'.

    Raises:
        ValueError: If the GPX data is invalid or cannot be parsed.
    """
    try:
        gpx_file = BytesIO(gpx_bytes)
        gpx = gpxpy.parse(gpx_file)
    except Exception as e:
        raise ValueError(f"Error parsing GPX data: {e}")

    data = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                data.append({
                    'timestamp': point.time,
                    'position_lat': point.latitude,
                    'position_long': point.longitude,
                    'altitude': point.elevation,
                })

    if not data:
        # Handle cases with no track points, e.g. a GPX file with only waypoints or routes
        # Return an empty DataFrame with the expected columns
        return pd.DataFrame(columns=['timestamp', 'position_lat', 'position_long', 'altitude'])

    df = pd.DataFrame(data)
    
    # Ensure timestamp is in UTC if it's timezone aware, or make it timezone aware (UTC)
    if df['timestamp'].dt.tz is not None:
        df['timestamp'] = df['timestamp'].dt.tz_convert('UTC')
    else:
        df['timestamp'] = df['timestamp'].dt.tz_localize('UTC')

    # Convert lat/long to semicircles if that's the expected format (like in FIT files)
    # GPX typically uses degrees, so this conversion might not be needed unless
    # consistency with FIT parsing output is strictly required.
    # For now, assuming degrees are fine.
    # df['position_lat'] = df['position_lat'] * (2**31 / 180)
    # df['position_long'] = df['position_long'] * (2**31 / 180)
    segments = haversine(
        df['position_lat'].shift(1),
        df['position_long'].shift(1),
        df['position_lat'],
        df['position_long'])
    segments[0] = 0
    df['distance'] = pd.Series(segments).cumsum()
    return df
