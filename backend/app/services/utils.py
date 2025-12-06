import numpy as np
import pandas as pd

def subsample_timeseries(time_series: pd.Series, num_samples: int):
    indices = np.linspace(0, len(time_series) - 1, num_samples, dtype=int)
    return time_series.to_numpy()[indices].tolist()
