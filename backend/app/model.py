""" Model classes and data persistence.
"""

import os
from datetime import datetime
from typing import Optional, Union, Sequence, List

from pydantic import BaseModel, EmailStr
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, LargeBinary, JSON

class UserLogin(SQLModel):
    email: EmailStr = Field(...)
    password: str = Field(...)

class UserId(SQLModel):
    id: int
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(UserLogin):
    fullname: Optional[str] = Field(...)

class User(UserCreate, table=True):
    id: int = Field(default=None, primary_key=True)


# class Gear(SQLModel, table=True):
#     id: int = Field(default=None, primary_key=True)
#     owner_id: int = Field(default=None, foreign_key="user.id")
#     name: str
#     weight: float
#     stats: Optional[str]

class PowerSummary(BaseModel):
    average_power: float
    median_power: float
    total_work: float
    # JSON encoded array of 101 position 0..100, with the power quantiles
    quantiles: Optional[Sequence[float]] = None

class LapMetrics(BaseModel):
    timestamp: str  # Lap end time, stringified
    start_time: str # Lap start time, stringified
    total_distance: Optional[float] = None
    total_elapsed_time: Optional[float] = None
    total_timer_time: Optional[float] = None
    avg_speed: Optional[float] = None # Will likely be recalculated or taken from Go
    max_speed: Optional[float] = None
    total_ascent: Optional[float] = None
    total_descent: Optional[float] = None
    max_power: Optional[float] = None # Value from Go data
    power_summary: Optional[PowerSummary] = None # Contains recalculated avg_power, median_power, etc.

class ElevationSummary(BaseModel):
    lowest: float
    highest: float
    elev_series: Sequence[float]
    dist_series: Sequence[float]

class Climb(BaseModel):
    from_ix: int
    to_ix: int
    elevation: float

# class RawData(BaseModel):
#     t: datetime
#     lat: Optional[float] = None
#     long: Optional[float] = None
#     power: Optional[float] = None
#     elevation: Optional[float] = None
#     speed: Optional[float] = None


class ActivitySummary(BaseModel):
    distance: Optional[float] = None
    total_elapsed_time: float
    active_time: float
    elevation_gain: Optional[float] = None
    average_speed: Optional[float] = None
    power_summary: Optional[PowerSummary] = None
    elev_summary: Optional[ElevationSummary] = None

class ActivityBase(SQLModel):
    activity_id: str = Field(...)
    name: Optional[str] = Field(...)
    activity_type: str = Field(...) # Added activity_type field
    owner_id: int = Field(default=None, foreign_key="user.id")
    distance: Optional[float] = Field(...)
    active_time: Optional[float] = Field(...)
    elevation_gain: Optional[float] = Field(...)
    #gear_id: int = Field(default=None, foreign_key="gear.id")
    date: datetime = Field(...)
    last_modified: datetime = Field(...)
    tags: Optional[List[str]] = Field(sa_column=Column(JSON))

class ActivityResponse(BaseModel):
    activity_base: Optional[ActivityBase] = None
    activity_analysis: Optional[ActivitySummary] = None
    activity_data: Optional[str] = None # This is for raw records string, not laps
    laps: Optional[list[LapMetrics]] = None # Changed from list[dict]
    has_gps_data: bool = False
    

class ActivityTable(ActivityBase, table=True):
    activity_id: str = Field(default=None, primary_key=True)
    # activity_type is inherited from ActivityBase
    data: bytes = Field(...)
    static_map: Optional[bytes] = Field(...)
    laps_data: Optional[bytes] = Field(default=None)
    fit_file: Optional[bytes] = Field(default=None, sa_column=Column(LargeBinary, nullable=True))
    fit_file_parsed_at: Optional[datetime] = Field(default=None, nullable=True)

class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[datetime] = None
    tags: Optional[list[str]] = None
    #gear_id: Optional[int] = None
