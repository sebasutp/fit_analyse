from sqlmodel import Session, select
from fastapi import HTTPException
from app import model
from app.services import data_processing

def fetch_activity(activity_id: str, session: Session):
    q = select(model.ActivityTable).where(
        model.ActivityTable.activity_id == activity_id)
    activity = session.exec(q).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

def fetch_activity_df(activity_id: str, session: Session):
    activity = fetch_activity(activity_id, session)
    return data_processing.get_activity_df(activity)
