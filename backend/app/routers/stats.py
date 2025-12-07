from datetime import datetime, timedelta, date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, func
from app import model
from app.auth import auth_handler
from app.database import get_db_session
from app.services import stats

router = APIRouter(prefix="/users/me/stats", tags=["stats"])

@router.get("", response_model=List[model.HistoricalStats])
async def get_user_stats(
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    periods: Optional[str] = Query(None, description="Comma separated periods (e.g. ALL,2025)")
):
    """
    Returns historical stats.
    By default returns ALL time and current YEAR.
    """
    period_types = ["ALL", "YEAR"]
    # If we wanted to parse "periods" arg to filter by specific period_id or type, we could.
    # For now, let's stick to simple logic: return ALL and ALL YEARS.
    
    query = select(model.HistoricalStats).where(model.HistoricalStats.user_id == current_user_id.id)
    
    # Filter by period types if needed, or just return relevant ones.
    # Let's return ALL and YEARs to be safe.
    query = query.where(model.HistoricalStats.period_type.in_(["ALL", "YEAR"]))
    
    return session.exec(query).all()

@router.post("/recalculate")
async def recalculate_stats(
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id)
):
    """
    Triggers a full rebuild of the user's historical stats.
    """
    stats.rebuild_user_stats(session, current_user_id.id)
    return {"status": "ok", "message": "Stats rebuilt successfully"}


@router.get("/summary")
async def get_stats_summary(
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    """
    Returns aggregated stats for a custom date range.
    If no dates provided, defaults to ALL time.
    """
    query = select(
        func.sum(model.ActivityTable.distance).label("distance"),
        func.sum(model.ActivityTable.active_time).label("moving_time"),
        func.sum(model.ActivityTable.elevation_gain).label("elevation_gain"),
        func.count(model.ActivityTable.activity_id).label("activity_count"),
        func.sum(model.ActivityTable.total_work).label("total_work"),
        func.max(model.ActivityTable.distance).label("max_distance"),
        func.max(model.ActivityTable.active_time).label("max_moving_time"),
        func.max(model.ActivityTable.elevation_gain).label("max_elevation_gain"),
        # For max speed (distance/time), we need to handle potential division by zero
        # SQLite handles division by zero by returning NULL, which is fine for max
        func.max(model.ActivityTable.distance / model.ActivityTable.active_time).label("max_speed")
    ).where(
        model.ActivityTable.owner_id == current_user_id.id
    ).where(
        model.ActivityTable.activity_type != "route"
    )
    
    if start_date:
        # Convert date to datetime for comparison if needed, or rely on SQLModel/SQLAlchemy handling
        # ActivityTable.date is DateTime (with timezone usually)
        # We'll assume start of day UTC for simplicity or use date comparison
        query = query.where(func.date(model.ActivityTable.date) >= start_date)
        
    if end_date:
        query = query.where(func.date(model.ActivityTable.date) <= end_date)
        
    result = session.exec(query).first()
    
    # helper to safely get int/float or 0
    def val(v): return v if v is not None else 0
    
    return {
        "distance": val(result.distance),
        "moving_time": val(result.moving_time),
        "elevation_gain": val(result.elevation_gain),
        "activity_count": val(result.activity_count),
        "total_work": val(result.total_work),
        "max_distance": val(result.max_distance),
        "max_moving_time": val(result.max_moving_time),
        "max_elevation_gain": val(result.max_elevation_gain),
        "max_speed": val(result.max_speed) # This will be in m/s
    }

@router.get("/volume")
async def get_training_volume(
    session: Session = Depends(get_db_session),
    current_user_id: model.UserId = Depends(auth_handler.get_current_user_id),
    period: str = Query("3m", regex="^(3m|6m|1y|all)$")
):
    """
    Returns weekly training volume data for the specified period.
    """
    # Calculate start date
    now = datetime.utcnow()
    start_date = now
    if period == "3m":
        start_date = now - timedelta(weeks=12)
    elif period == "6m":
        start_date = now - timedelta(weeks=26)
    elif period == "1y":
        start_date = now - timedelta(weeks=52)
    else: # all
        start_date = datetime.min
        
    # We use "WEEK" period_type in HistoricalStats.
    # period_id is "YYYY-Www"
    # We can fetch all "WEEK" stats and filter python side or convert period_id to date.
    # Converting ISO week to date in SQL is hard.
    # Simpler: fetch all "WEEK" stats for user, parse locally, filter.
    
    weeks_stats = session.exec(
        select(model.HistoricalStats)
        .where(model.HistoricalStats.user_id == current_user_id.id)
        .where(model.HistoricalStats.period_type == "WEEK")
    ).all()
    
    # Process
    data = []
    
    for stat in weeks_stats:
        # stat.period_id like "2025-W01"
        try:
            year, week_str = stat.period_id.split("-W")
            week = int(week_str)
            # ISO week date to datetime
            # Monday of the week
            iso_date = datetime.strptime(f"{year}-W{week}-1", "%G-W%V-%u")
        except ValueError:
            continue
            
        if iso_date >= start_date.replace(hour=0, minute=0, second=0, microsecond=0) or period == "all": # Rough filter
             data.append({
                 "date": iso_date.isoformat(),
                 "week": stat.period_id,
                 "distance": stat.distance,
                 "time": stat.moving_time / 3600.0, # hours
                 "total_work": stat.total_work,
                 "elevation": stat.elevation_gain
             })
             
    # Sort by date
    data.sort(key=lambda x: x["date"])
    
    return data

