""" Model classes and data persistence.
"""

import os
from datetime import datetime
from typing import Optional, Union, Sequence

from pydantic import BaseModel, EmailStr
from sqlmodel import Field, SQLModel

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
    owner_id: int = Field(default=None, foreign_key="user.id")
    distance: Optional[float] = Field(...)
    active_time: Optional[float] = Field(...)
    elevation_gain: Optional[float] = Field(...)
    #gear_id: int = Field(default=None, foreign_key="gear.id")
    date: datetime = Field(...)
    last_modified: datetime = Field(...)

class ActivityResponse(BaseModel):
    activity_base: Optional[ActivityBase] = None
    activity_analysis: Optional[ActivitySummary] = None
    activity_data: Optional[str] = None

class ActivityTable(ActivityBase, table=True):
    activity_id: str = Field(default=None, primary_key=True)
    data: bytes = Field(...)

class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[datetime] = None
    #gear_id: Optional[int] = None
