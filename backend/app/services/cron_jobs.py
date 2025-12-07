import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session, select
from app import model
from app.database import engine
from app.services import analysis, data_processing, stats

logger = logging.getLogger(__name__)

def recompute_all_users_curves():
    logger.info("Starting full recomputation of user power curves.")
    with Session(engine) as session:
        users = session.exec(select(model.User)).all()
        for user in users:
            try:
                logger.info(f"Recomputing curves for user {user.id}")
                recompute_user_curves(session, user)
            except Exception as e:
                logger.error(f"Error recomputing curves for user {user.id}: {e}")
        session.commit()
    logger.info("Finished full recomputation of user power curves.")

def recompute_user_curves(session: Session, user: model.User):
    # Reset curves
    user_curves = {}
    
    # Fetch all activities for user
    activities = session.exec(
        select(model.ActivityTable).where(model.ActivityTable.owner_id == user.id)
    ).all()
    
    for activity in activities:
        try:
            if not activity.data:
                continue
                
            df = data_processing.deserialize_dataframe(activity.data)
            if df is None or df.empty:
                continue
                
            curve = analysis.calculate_power_curve(df)
            user_curves = analysis.update_user_curves_incremental(user_curves, curve, activity.date)
        except Exception as e:
            logger.warning(f"Failed to process activity {activity.activity_id} for power curve: {e}")
            
    user.power_curve = user_curves
    user.power_curve = user_curves
    session.add(user)

def recompute_all_users_stats():
    logger.info("Starting full recomputation of user historical stats.")
    with Session(engine) as session:
        users = session.exec(select(model.User)).all()
        for user in users:
            try:
                logger.info(f"Recomputing stats for user {user.id}")
                stats.rebuild_user_stats(session, user.id)
            except Exception as e:
                logger.error(f"Error recomputing stats for user {user.id}: {e}")
    logger.info("Finished full recomputation of user historical stats.")

def start_scheduler():
    cron_frequency_hours = int(os.getenv("POWER_CURVE_CRON_FREQUENCY_HOURS", "24"))
    scheduler = BackgroundScheduler()
    scheduler.add_job(recompute_all_users_curves, 'interval', hours=cron_frequency_hours)
    scheduler.add_job(recompute_all_users_stats, 'interval', hours=cron_frequency_hours)
    scheduler.start()
    logger.info(f"Scheduler started with frequency {cron_frequency_hours} hours.")
    
    # Run once on startup if needed (optional)
    # recompute_all_users_curves() 
