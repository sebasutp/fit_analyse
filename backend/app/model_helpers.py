"""
This module is a facade for backward compatibility.
Refactored logic is now split into:
- app.database
- app.services.data_processing
- app.services.maps
- app.services.analysis
- app.services.utils
- app.services.activity_crud
"""

import pandas as pd
from typing import Sequence
from app import model
from fastapi import HTTPException
from staticmap import StaticMap, Line
from fastapi.responses import Response
from sqlmodel import Session

# Database
from app.database import engine, get_db_session

# Data Processing
from app.services.data_processing import (
    remove_columns,
    serialize_dataframe,
    deserialize_dataframe,
    get_activity_raw_df,
    get_activity_df
)

# Utils
from app.services.utils import subsample_timeseries

# Maps
from app.services.maps import (
    get_activity_map,
    get_activity_gpx,
    has_gps_data
)

# Analysis
from app.services.analysis import (
    compute_elevation_gain_intervals,
    compute_elevation_gain,
    elev_summary,
    compute_power_summary,
    compute_lap_metrics,
    compute_activity_summary,
    get_activity_response,
    search_and_rank_activities
)

# CRUD
from app.services.activity_crud import (
    fetch_activity,
    fetch_activity_df
)
