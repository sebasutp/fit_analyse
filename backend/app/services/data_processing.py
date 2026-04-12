import io
import pandas as pd
import pyarrow.feather as feather
from typing import Sequence
from app import model

def remove_columns(df: pd.DataFrame, cols: Sequence[str]):
    keep_cols = [x for x in df.columns if x not in set(cols)]
    return df[keep_cols]

def serialize_dataframe(df: pd.DataFrame):
    rem_cols = ['left_right_balance']
    with io.BytesIO() as buffer:
        remove_columns(df, rem_cols).to_feather(buffer)
        serialized = buffer.getvalue()
    return serialized

def deserialize_dataframe(serialized: bytes):
    return feather.read_feather(io.BytesIO(serialized))

def get_activity_raw_df(activity_db: model.ActivityTable):
    return deserialize_dataframe(activity_db.data)

def get_activity_df(activity: model.ActivityTable):
    activity_df = get_activity_raw_df(activity)
    # Use pd.isna to handle NaT values gracefully
    activity_df.timestamp = activity_df.timestamp.apply(lambda x: x.timestamp() if not pd.isna(x) else None)
    return activity_df

def smooth_dataframe(df: pd.DataFrame, columns: list[str], window: int = 30):
    """
    Applies a rolling mean smoothing to the specified columns after 
    resampling to 1Hz to ensure time-based consistency.
    """
    if df is None or df.empty:
        return df
    
    # Ensure we have a datetime index for resampling
    df_work = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df_work['timestamp']):
        df_work['timestamp'] = pd.to_datetime(df_work['timestamp'], unit='s')
    
    df_work = df_work.set_index('timestamp').sort_index()
    
    # Resample to 1s frequency
    df_resampled = df_work.resample('1s').asfreq()
    
    for col in columns:
        if col in df_resampled.columns:
            series = df_resampled[col]
            if col == 'power':
                # Power silence usually means 0 (coasting/stopped)
                series = series.fillna(0)
            else:
                # HR and Temp transition smoothly
                series = series.interpolate(method='linear').ffill().bfill()
            
            # Update the original column and create smoothed version
            df_resampled[col] = series
            df_resampled[f"{col}_smoothed"] = series.rolling(window=window, min_periods=1, center=True).mean()
    
    # Reset index and return
    return df_resampled.reset_index()

def prepare_processed_series(df: pd.DataFrame, metrics_config: dict[str, int]):
    """
    Handles resampling and smoothing for multiple metrics with individual 
    window sizes. Ensures all results share the same 1Hz index.
    """
    if df is None or df.empty:
        return df
    
    # Filter for metrics actually present in the data
    available_metrics = {m: w for m, w in metrics_config.items() if m in df.columns}
    if not available_metrics:
        return df[['timestamp']] if 'timestamp' in df.columns else df

    # Prepare datetime index once
    df_work = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df_work['timestamp']):
        df_work['timestamp'] = pd.to_datetime(df_work['timestamp'], unit='s')
    df_work = df_work.set_index('timestamp').sort_index()

    # Resample to 1s freq once
    df_resampled = df_work.resample('1s').asfreq()

    # Process each metric
    for metric, window in available_metrics.items():
        series = df_resampled[metric]
        if metric == 'power':
            series = series.fillna(0)
        else:
            series = series.interpolate(method='linear').ffill().bfill()
        
        # Original and smoothed
        df_resampled[metric] = series
        df_resampled[f"{metric}_smoothed"] = series.rolling(window=window, min_periods=1, center=True).mean()

    return df_resampled.reset_index()

def downsample_dataframe(df: pd.DataFrame, target_points: int = 1000):
    """
    Downsamples the dataframe to approximately target_points using 
    time-based resampling.
    """
    if df is None or df.empty or len(df) <= target_points:
        return df

    # Ensure we have a datetime index
    df_work = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df_work['timestamp']):
        df_work['timestamp'] = pd.to_datetime(df_work['timestamp'], unit='s')
    
    df_work = df_work.set_index('timestamp').sort_index()
    
    # Calculate required frequency
    duration_secs = (df_work.index[-1] - df_work.index[0]).total_seconds()
    if duration_secs <= 0:
        return df
        
    freq_secs = max(1, round(duration_secs / target_points))
    
    # Resample using mean
    df_downsampled = df_work.resample(f'{freq_secs}s').mean()
    
    return df_downsampled.reset_index()
