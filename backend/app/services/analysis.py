import re
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from typing import Sequence, Optional
from app import model
from app.services import utils, data_processing, maps

# Configuration
POWER_CURVE_PERIODS = [int(p) for p in os.getenv("POWER_CURVE_PERIODS", "3,6,12").split(",")]

def calculate_power_curve(ride_df: pd.DataFrame) -> list[dict[str, int | float]]:
    if ride_df is None or ride_df.empty or 'power' not in ride_df.columns:
        return []

    # Ensure timestamp is datetime and sort
    df = ride_df.copy()
    if 'timestamp' not in df.columns:
        # If no timestamp, we can't reliably calculate time-based power curve
        # Fallback: assume 1s intervals if no timestamp? Or return empty?
        # Given the requirements, let's return empty if no timestamp.
        return []
    
    if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
        # Auto-detect if it's float/int (likely seconds) or string
        if pd.api.types.is_numeric_dtype(df['timestamp']):
             df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
        else:
             df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    df = df.sort_values('timestamp')
    
    # Set timestamp as index and resample to 1s to handle gaps/irregularities
    # We use 'max' for resampling in case of sub-second entries (unlikely for FIT)
    # or just 'mean'
    df = df.set_index('timestamp')
    
    # Resample to 1s. 
    # Important: If there are large gaps (e.g. paused), filling with 0 is essentially what "Elapsed Time" power curve does.
    # "Timer Time" power curve would concatenate moving segments. 
    # Standard practice is often "Elapsed Time" for critical power curve to capture fatigue, 
    # but some tools use "Timer Time". 
    # Given we track 'total_elapsed_time' vs 'active_time', let's stick to a continuous time grid (Elapsed).
    # Fill missing power with 0.
    df_resampled = df[['power']].resample('1s').mean().fillna(0)
    
    power_series = df_resampled['power']
    total_duration = len(power_series)
    
    durations = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 18000]
    
    curve = []
    
    for duration in durations:
        if duration > total_duration:
            break
            
        # Calculate rolling max mean
        # Since we are on a 1s grid, window=duration
        max_power = power_series.rolling(window=duration).mean().max()
        
        if pd.notna(max_power):
            curve.append({
                "duration": duration,
                "max_watts": float(max_power)
            })
            
    return curve

def merge_power_curves(curve1: list[dict[str, int | float]] | None, curve2: list[dict[str, int | float]] | None) -> list[dict[str, int | float]]:
    """
    Merges two power curves, keeping the maximum power for each duration.
    Assumes curve format is list of {'duration': int, 'max_watts': float}.
    """
    if not curve1:
        return curve2 or []
    if not curve2:
        return curve1 or []

    # Convert to dict for easier lookup {duration: max_watts}
    c1_map = {item['duration']: item['max_watts'] for item in curve1}
    c2_map = {item['duration']: item['max_watts'] for item in curve2}
    
    all_durations = sorted(list(set(c1_map.keys()) | set(c2_map.keys())))
    
    merged_curve = []
    for duration in all_durations:
        p1 = c1_map.get(duration, 0)
        p2 = c2_map.get(duration, 0)
        merged_curve.append({
            "duration": duration,
            "max_watts": max(p1, p2)
        })
        
    return merged_curve

def update_user_curves_incremental(
    user_curves: dict | None,
    new_curve: list[dict[str, int | float]],
    activity_date: datetime
) -> dict:
    """
    Updates the user's power curves incrementally with a new activity's curve.
    """
    if user_curves is None:
        user_curves = {}
    
    # helper to ensure curve exists
    def ensure_curve(key):
        if key not in user_curves:
            user_curves[key] = []
            
    # Always update 'all'
    ensure_curve('all')
    user_curves['all'] = merge_power_curves(user_curves['all'], new_curve)
    
    now = datetime.now(activity_date.tzinfo) # Use same timezone as activity if possible, or naive
    
    # Handle timezone naivety mixing
    if activity_date.tzinfo is None and now.tzinfo is not None:
        activity_date = activity_date.replace(tzinfo=now.tzinfo)
    elif activity_date.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=activity_date.tzinfo)

    for period_months in POWER_CURVE_PERIODS:
        key = f"{period_months}m"
        ensure_curve(key)
        
        # Approximate month as 30 days
        cutoff = now - timedelta(days=period_months * 30)
        
        if activity_date >= cutoff:
            user_curves[key] = merge_power_curves(user_curves[key], new_curve)
            
    return user_curves

def calculate_time_in_zones(ride_df: pd.DataFrame, zones: Sequence[int]) -> list[float]:
    """
    Calculates the time spent in each power zone.
    zones: a list of upper bounds for the zones.
           e.g. [150, 200, 250, 300, 350, 400] means:
           Zone 1: 0-150
           Zone 2: 151-200
           ...
           Zone 7: > 400
    Returns a list of seconds spent in each zone.
    """
    if ride_df is None or ride_df.empty or 'power' not in ride_df.columns or not zones:
        return []

    # Use a copy to avoid side effects if we modify
    # However we only read columns, so minimal risk.
    
    # Prepare power series
    power_series = pd.to_numeric(ride_df['power'], errors='coerce').fillna(0)

    # Prepare duration weights
    # Currently assuming 1Hz data (1 second per row)
    # If we wanted to be more precise with timestamps:
    # if 'timestamp' in ride_df.columns and pd.api.types.is_datetime64_any_dtype(ride_df['timestamp']):
    #     durations = ride_df['timestamp'].diff().shift(-1).dt.total_seconds().fillna(1.0).values
    # else:
    #     durations = np.ones(len(power_series))
    durations = np.ones(len(power_series))

    # Create bins: [0, z1, z2, ..., zN, infinity]
    bins = [0] + sorted(list(zones)) + [float('inf')]

    # Bin the power data
    # include_lowest=True ensures 0 is included in the first bin
    # right=True ensures bins are (a, b], so a limit of 150 includes 150 in the lower zone.
    cuts = pd.cut(power_series, bins=bins, include_lowest=True, right=True)

    # Group durations by the cuts and sum them
    # observed=False ensures we get 0 for empty bins
    zone_sums = pd.Series(durations).groupby(cuts.values, observed=False).sum()

    return zone_sums.tolist()

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

def compute_power_summary(df: pd.DataFrame) -> model.PowerSummary | None:
    if df is None or df.empty or 'power' not in df.columns:
        return None

    df_power = df['power'].dropna()
    if df_power.empty:
        return None

    average_power = df_power.mean()
    median_power = df_power.median()

    total_work_joules = 0.0
    if 'timestamp' in df.columns and not df_power.empty:
        df_sorted = df.sort_values(by='timestamp').copy()
        if not pd.api.types.is_datetime64_any_dtype(df_sorted['timestamp']):
             df_sorted['timestamp'] = pd.to_datetime(df_sorted['timestamp'])

        df_sorted['time_diff'] = df_sorted['timestamp'].diff().dt.total_seconds()

        valid_work_calc = df_sorted.dropna(subset=['power', 'time_diff'])
        if not valid_work_calc.empty:
            numeric_power = pd.to_numeric(valid_work_calc['power'], errors='coerce').fillna(0)
            total_work_joules = (numeric_power * valid_work_calc['time_diff']).sum()

    power_quantiles = list(df_power.quantile([i/100.0 for i in range(101)]))

    return model.PowerSummary(
        average_power=float(average_power) if pd.notna(average_power) else 0.0,
        median_power=float(median_power) if pd.notna(median_power) else 0.0,
        total_work=float(total_work_joules / 1000.0),
        quantiles=power_quantiles
    )

def compute_lap_metrics(lap_data_row: pd.Series, activity_df: pd.DataFrame) -> model.LapMetrics:
    lap_start_time = pd.to_datetime(lap_data_row['start_time'])
    lap_end_time = pd.to_datetime(lap_data_row['timestamp'])

    activity_df_copy = activity_df.copy()
    if not pd.api.types.is_datetime64_any_dtype(activity_df_copy['timestamp']):
        activity_df_copy['timestamp'] = pd.to_datetime(activity_df_copy['timestamp'])

    lap_segment_df = activity_df_copy[
        (activity_df_copy['timestamp'] >= lap_start_time) & \
        (activity_df_copy['timestamp'] <= lap_end_time)
    ].copy()

    power_summary_for_lap = compute_power_summary(lap_segment_df)

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
        max_power=lap_data_row.get('max_power'),
        power_summary=power_summary_for_lap
    )
    return lap_metrics_obj

def compute_activity_summary(ride_df: pd.DataFrame, num_samples: int = 200, user_zones: Optional[list[int]] = None):
    total_time_seconds = len(ride_df)

    elevation_gain = compute_elevation_gain(ride_df, tolerance=2, min_elev=4.0) if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty else 0.0

    distance_km = (ride_df['distance'].iloc[-1] / 1000.0) if 'distance' in ride_df.columns and not ride_df['distance'].empty else 0.0

    avg_speed_kmh = (ride_df['speed'].mean() * 3.6) if 'speed' in ride_df.columns and not ride_df['speed'].dropna().empty else 0.0

    actual_elapsed_time_seconds = 0.0
    if 'timestamp' in ride_df.columns and not ride_df['timestamp'].dropna().empty:
        if not pd.api.types.is_datetime64_any_dtype(ride_df['timestamp']):
            ride_df['timestamp'] = pd.to_datetime(ride_df['timestamp'])
        sorted_timestamps = ride_df['timestamp'].dropna().sort_values()
        if not sorted_timestamps.empty:
            actual_elapsed_time_seconds = (sorted_timestamps.iloc[-1] - sorted_timestamps.iloc[0]).total_seconds()

    summary = model.ActivitySummary(
        distance=distance_km,
        total_elapsed_time=actual_elapsed_time_seconds,
        active_time=float(total_time_seconds),
        elevation_gain=elevation_gain,
        average_speed=avg_speed_kmh
    )

    summary.power_summary = compute_power_summary(ride_df)

    if user_zones:
        summary.time_in_zones = calculate_time_in_zones(ride_df, user_zones)

    if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty:
        summary.elev_summary = elev_summary(ride_df, num_samples)
    return summary

def get_activity_response(
        activity_db: model.ActivityTable,
        include_raw_data: bool = False,
        user_zones: Optional[list[int]] = None):

    activity_df = None
    if activity_db.data:
        activity_df = data_processing.deserialize_dataframe(activity_db.data)
        if activity_df is not None and not activity_df.empty and 'timestamp' in activity_df.columns and \
           not pd.api.types.is_datetime64_any_dtype(activity_df['timestamp']):
            activity_df['timestamp'] = pd.to_datetime(activity_df['timestamp'])

    if activity_df is not None and not activity_df.empty:
        activity_analysis_summary = compute_activity_summary(activity_df, user_zones=user_zones)
        has_gps = maps.has_gps_data(activity_df)
    else:
        activity_analysis_summary = model.ActivitySummary(total_elapsed_time=0, active_time=0)
        has_gps = False


    ans = model.ActivityResponse(
        activity_base=activity_db,
        activity_analysis=activity_analysis_summary,
        has_gps_data=has_gps
    )

    if include_raw_data and activity_df is not None and not activity_df.empty:
        ans.activity_data = activity_df.to_json()

    if activity_db.laps_data and activity_df is not None and not activity_df.empty:
        laps_df_raw = data_processing.deserialize_dataframe(activity_db.laps_data)
        if laps_df_raw is not None and not laps_df_raw.empty:
            processed_laps_list = []

            if 'start_time' in laps_df_raw.columns and \
               not pd.api.types.is_datetime64_any_dtype(laps_df_raw['start_time']):
                 laps_df_raw['start_time'] = pd.to_datetime(laps_df_raw['start_time'])
            if 'timestamp' in laps_df_raw.columns and \
               not pd.api.types.is_datetime64_any_dtype(laps_df_raw['timestamp']):
                 laps_df_raw['timestamp'] = pd.to_datetime(laps_df_raw['timestamp'])

            for index, lap_row_series in laps_df_raw.iterrows():
                if 'start_time' not in lap_row_series or pd.isna(lap_row_series['start_time']) or \
                   'timestamp' not in lap_row_series or pd.isna(lap_row_series['timestamp']):
                    continue

                lap_metrics_instance = compute_lap_metrics(lap_row_series, activity_df)
                processed_laps_list.append(lap_metrics_instance)

            if processed_laps_list:
                ans.laps = processed_laps_list
    return ans

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

        activity_title_words = set()
        if activity.name:
            activity_title_words = {word.lower() for word in re.split(r'\s+', activity.name.strip()) if word}
        score += len(search_terms.intersection(activity_title_words))

        if activity.tags:
            activity_tags_lower = {tag.lower() for tag in activity.tags}
            score += len(search_terms.intersection(activity_tags_lower))

        if score > 0:
            scored_activities.append({"activity": activity, "score": score})

    sorted_activities_with_scores = sorted(
        scored_activities,
        key=lambda x: (x["score"], x["activity"].date),
        reverse=True
    )

    return [item["activity"] for item in sorted_activities_with_scores]
