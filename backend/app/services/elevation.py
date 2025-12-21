import pandas as pd
from app import model
from app.services import utils

def compute_elevation_gain_intervals(df: pd.DataFrame, tolerance=1.0, min_elev=1.0):
    altitude_series = df.altitude.dropna()
    altitude = altitude_series.to_list()
    original_ix = altitude_series.index
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
            if climb.from_ix < climb.to_ix and climb.elevation > min_elev:
                climbs.append(climb)
            low_ix = i
            high_ix = i
    return climbs

def compute_elevation_gain(df: pd.DataFrame, tolerance: float, min_elev: float):
    segments = compute_elevation_gain_intervals(df, tolerance, min_elev)
    return sum(map(lambda x: x.elevation, segments))

def elev_summary(ride_df: pd.DataFrame, num_samples: int):
    n = min(len(ride_df.altitude), num_samples)
    summary = model.ElevationSummary(
        lowest=ride_df.altitude.min(),
        highest=ride_df.altitude.max(),
        elev_series=utils.subsample_timeseries(ride_df.altitude, n),
        dist_series=utils.subsample_timeseries(ride_df.distance / 1000.0, n)
    )
    return summary
