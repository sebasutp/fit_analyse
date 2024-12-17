import os
import io
import numpy as np
import pandas
from app import model
import pyarrow.feather as feather

from typing import Sequence
from sqlmodel import create_engine, Session, select
from fastapi import HTTPException
from staticmap import StaticMap, Line

connect_args = {"check_same_thread": False}
engine = create_engine(
    os.getenv("DB_URL"),
    echo=True,
    connect_args=connect_args)

def get_db_session():
    """Returns DB session."""
    with Session(engine) as session:
        yield session

def extract_data_to_dataframe(fitfile):
    data = []

    for record in fitfile.messages:
        if record.name == 'record':
            row_data = {}
            for field in record.fields:
                row_data[field.name] = field.value
            data.append(row_data)

    df = pandas.DataFrame(data)
    position_scale = (1 << 32) / 360.0
    df['position_lat'] = df['position_lat'] / position_scale
    df['position_long'] = df['position_long'] / position_scale
    return df

def remove_columns(df: pandas.DataFrame, cols: Sequence[str]):
    keep_cols = [x for x in df.columns if not x in set(cols)]
    return df[keep_cols]

def serialize_dataframe(df: pandas.DataFrame):
    rem_cols = ['left_right_balance']
    with io.BytesIO() as buffer:
        remove_columns(df, rem_cols).to_feather(buffer)
        serialized = buffer.getvalue()
    return serialized

def deserialize_dataframe(serialized: bytes):
    return feather.read_feather(io.BytesIO(serialized))

def compute_elevation_gain_intervals(df: pandas.DataFrame, tolerance=1.0, min_elev=1.0):
    altitude_series = df.altitude.dropna()
    altitude = altitude_series.to_list()
    original_ix = altitude_series.index
    #print(len(original_ix), len(altitude))
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
            #print(low_ix, high_ix, climb)
            if climb.from_ix < climb.to_ix and climb.elevation > min_elev:
                climbs.append(climb)
            low_ix = i
            high_ix = i
    return climbs

def compute_elevation_gain(df: pandas.DataFrame, tolerance: float, min_elev: float):
    segments = compute_elevation_gain_intervals(df, tolerance, min_elev)
    return sum(map(lambda x: x.elevation, segments))

def subsample_timeseries(time_series: pandas.Series, num_samples: int):
    indices = np.linspace(0, len(time_series) - 1, num_samples, dtype=int)
    return time_series.to_numpy()[indices].tolist()

def get_activity_map(ride_df: pandas.DataFrame, num_samples: int):
    df = ride_df.dropna(subset=['position_lat', 'position_long'])
    w = int(os.getenv("STATIC_MAP_W", "400"))
    h = int(os.getenv("STATIC_MAP_H", "300"))
    m = StaticMap(w, h, 10)
    lat = subsample_timeseries(df.position_lat, num_samples=num_samples)
    long = subsample_timeseries(df.position_long, num_samples=num_samples)
    line = list(zip(long, lat))
    m.add_line(Line(line, 'blue', 3))
    image = m.render()
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

def elev_summary(ride_df: pandas.DataFrame, num_samples: int):
    n = min(len(ride_df.altitude), num_samples)
    summary = model.ElevationSummary(
        lowest=ride_df.altitude.min(),
        highest=ride_df.altitude.max(),
        elev_series=subsample_timeseries(ride_df.altitude, n),
        dist_series=subsample_timeseries(ride_df.distance / 1000.0, n)
    )
    return summary

def compute_activity_summary(ride_df: pandas.DataFrame, num_samples: int = 200):
    total_time = len(ride_df)
    elevation_gain = compute_elevation_gain(ride_df, tolerance=2, min_elev=4.0) if 'altitude' in ride_df.columns else 0

    summary = model.ActivitySummary(
        distance=ride_df['distance'].iloc[-1] / 1000,
        total_elapsed_time=(ride_df['timestamp'].iloc[-1] - ride_df['timestamp'][0]).seconds,
        active_time=total_time,
        elevation_gain=elevation_gain,
        average_speed=ride_df['speed'].mean() * 3.6  # From m/s to km/h
    )
    if 'power' in ride_df.columns:
        work = ride_df.power.sum()
        quantiles = ride_df.power.quantile(np.arange(0, 101)/100)
        summary.power_summary = model.PowerSummary(
            average_power = work / total_time,
            median_power = quantiles.iloc[50],
            total_work = work / 1000,  # to KJ instad of Joules
            quantiles = quantiles.to_list()
        )
    if 'altitude' in ride_df.columns:
        summary.elev_summary = elev_summary(ride_df, num_samples)
    return summary

def get_activity_raw_df(activity_db: model.ActivityTable):
    return deserialize_dataframe(activity_db.data)

def get_activity_response(
        activity_db: model.ActivityTable,
        include_raw_data: bool = False):
    activity_df = get_activity_raw_df(activity_db)
    ans = model.ActivityResponse(
        activity_base=activity_db,
        activity_analysis=compute_activity_summary(activity_df),
    )
    if include_raw_data:
        ans.activity_data = activity_df.to_json()
    return ans

def fetch_activity(activity_id: str, session: Session):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

def get_activity_df(activity: model.ActivityTable):
    activity_df = get_activity_raw_df(activity)
    activity_df.timestamp = activity_df.timestamp.apply(lambda x: x.timestamp() if x else None)
    return activity_df

def fetch_activity_df(activity_id: str, session: Session):
    activity = fetch_activity(activity_id, session)
    return get_activity_df(activity)
