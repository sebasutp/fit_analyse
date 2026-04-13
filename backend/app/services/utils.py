import numpy as np
import pandas as pd

def subsample_timeseries(time_series: pd.Series, num_samples: int):
    if len(time_series) == 0 or num_samples <= 0:
        return []
    indices = np.linspace(0, len(time_series) - 1, num_samples, dtype=int)
    return time_series.to_numpy()[indices].tolist()

def sanitize_nan(data):
    """
    Recursively replaces NaN and Inf float values in a dictionary or list
    with None. This is required for JSON serialization.
    """
    if isinstance(data, dict):
        return {k: sanitize_nan(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_nan(item) for item in data]
    elif isinstance(data, float):
        if np.isnan(data) or np.isinf(data):
            return None
        return data
    else:
        return data
