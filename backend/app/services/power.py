import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Sequence, Optional
from app import model
from app.services import utils

# Configuration
POWER_CURVE_PERIODS = [int(p) for p in os.getenv("POWER_CURVE_PERIODS", "3,6,12").split(",")]

def calculate_power_curve(ride_df: pd.DataFrame) -> list[dict[str, int | float]]:
    if ride_df is None or ride_df.empty or 'power' not in ride_df.columns:
        return []

    # Ensure timestamp is datetime and sort
    df = ride_df.copy()
    if 'timestamp' not in df.columns:
        return []
    
    if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
        if pd.api.types.is_numeric_dtype(df['timestamp']):
             df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
        else:
             df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    df = df.sort_values('timestamp')
    df = df.set_index('timestamp')
    
    # Resample to 1s. Fill missing power with 0.
    df_resampled = df[['power']].resample('1s').mean().fillna(0)
    
    power_series = df_resampled['power']
    total_duration = len(power_series)
    
    durations = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 18000]
    
    curve = []
    
    for duration in durations:
        if duration > total_duration:
            break
            
        max_power = power_series.rolling(window=duration).mean().max()
        
        if pd.notna(max_power):
            curve.append({
                "duration": duration,
                "max_watts": float(max_power)
            })
            
    return curve

def merge_power_curves(curve1: list[dict[str, int | float]] | None, curve2: list[dict[str, int | float]] | None) -> list[dict[str, int | float]]:
    if not curve1:
        return curve2 or []
    if not curve2:
        return curve1 or []

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
    if user_curves is None:
        user_curves = {}
    
    def ensure_curve(key):
        if key not in user_curves:
            user_curves[key] = []
            
    ensure_curve('all')
    user_curves['all'] = merge_power_curves(user_curves['all'], new_curve)
    
    now = datetime.now(activity_date.tzinfo) 
    
    if activity_date.tzinfo is None and now.tzinfo is not None:
        activity_date = activity_date.replace(tzinfo=now.tzinfo)
    elif activity_date.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=activity_date.tzinfo)

    for period_months in POWER_CURVE_PERIODS:
        key = f"{period_months}m"
        ensure_curve(key)
        
        cutoff = now - timedelta(days=period_months * 30)
        
        if activity_date >= cutoff:
            user_curves[key] = merge_power_curves(user_curves[key], new_curve)
            
    return user_curves

def calculate_time_in_zones(ride_df: pd.DataFrame, zones: Sequence[int]) -> list[float]:
    if ride_df is None or ride_df.empty or 'power' not in ride_df.columns or not zones:
        return []

    power_series = pd.to_numeric(ride_df['power'], errors='coerce').fillna(0)
    durations = np.ones(len(power_series))

    bins = [0] + sorted(list(zones)) + [float('inf')]

    cuts = pd.cut(power_series, bins=bins, include_lowest=True, right=True)

    zone_sums = pd.Series(durations).groupby(cuts.values, observed=False).sum()

    return zone_sums.tolist()

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
