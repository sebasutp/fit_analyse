import re
import pandas as pd
import numpy as np
import os
from datetime import datetime
from typing import Sequence, Optional
from app import model
from app.services import utils, data_processing, maps, power, elevation
from rapidfuzz import fuzz

# Re-exporting for compatibility if needed, but we should update callers
from app.services.power import (
    calculate_power_curve,
    merge_power_curves,
    update_user_curves_incremental,
    calculate_time_in_zones,
    compute_power_summary,
    POWER_CURVE_PERIODS
)
from app.services.elevation import (
    compute_elevation_gain_intervals,
    compute_elevation_gain,
    elev_summary
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

    power_summary_for_lap = power.compute_power_summary(lap_segment_df)

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

    elevation_gain_val = elevation.compute_elevation_gain(ride_df, tolerance=2, min_elev=4.0) if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty else 0.0

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
        elevation_gain=elevation_gain_val,
        average_speed=avg_speed_kmh
    )

    summary.power_summary = power.compute_power_summary(ride_df)

    if user_zones:
        summary.time_in_zones = power.calculate_time_in_zones(ride_df, user_zones)

    if 'altitude' in ride_df.columns and not ride_df['altitude'].dropna().empty:
        summary.elev_summary = elevation.elev_summary(ride_df, num_samples)
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


# Fuzzy match threshold
def calculate_term_match(term: str, text: str, threshold: int = 75) -> int:
    """
    Calculates the fuzzy match score of a term against a text.
    Returns 0 if score is below threshold.
    """
    if not text:
        return 0
    
    score = fuzz.partial_ratio(term.lower(), text.lower())
    if score >= threshold:
        return score
    return 0


def score_activity(
    activity: model.ActivityTable, 
    search_terms: list[str],
    threshold: int = 75
) -> int:
    """
    Calculates the total score for an activity against a list of search terms.
    Returns 0 if any term does not match.
    """
    total_score = 0
    
    # Prepare text to search against
    name_str = activity.name if activity.name else ""
    tags_list = activity.tags if activity.tags else []
    
    for term in search_terms:
        best_term_score = 0
        
        # Check Name
        score_name = calculate_term_match(term, name_str, threshold)
        best_term_score = max(best_term_score, score_name)
        
        # Check Tags
        for tag in tags_list:
            score_tag = calculate_term_match(term, tag, threshold)
            best_term_score = max(best_term_score, score_tag)
        
        if best_term_score == 0:
            return 0 # Term not found
        
        total_score += best_term_score
        
    return total_score


def search_and_rank_activities(
    activities: Sequence[model.ActivityTable],
    search_query: str
) -> list[model.ActivityTable]:
    if not search_query:
        return list(activities)

    # Split query into terms, remove empty strings
    search_terms = [term.strip() for term in re.split(r'\s+', search_query.strip()) if term.strip()]
    if not search_terms:
        return list(activities)
        
    try:
        threshold = int(os.getenv("SEARCH_MATCH_THRESHOLD", 75))
    except ValueError:
        threshold = 75

    scored_activities = []

    for activity in activities:
        score = score_activity(activity, search_terms, threshold)
        if score > 0:
            scored_activities.append({"activity": activity, "score": score})

    # Sort by score descending, then by date descending
    sorted_activities_with_scores = sorted(
        scored_activities,
        key=lambda x: (x["score"], x["activity"].date),
        reverse=True
    )

    return [item["activity"] for item in sorted_activities_with_scores]
