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
    activity_df.timestamp = activity_df.timestamp.apply(lambda x: x.timestamp() if x else None)
    return activity_df

def fetch_activity_df(activity_id: str, session):
    # This creates a circular dependency if we import fetch_activity from somewhere else that uses this.
    # Ideally, the router fetches the activity and passes it to the service.
    # For now, I'll duplicate the fetch logic or import it.
    # Actually, fetch_activity was in model_helpers. I should probably move DB fetch logic to a CRUD service or keep it simple.
    # Let's put a TODO or import it from a new crud location if needed.
    # For now, I will NOT include fetch_activity_df here to avoid circular imports if I can help it.
    # But wait, api.py uses fetch_activity_df.
    # Let's see... `fetch_activity` uses `session`.
    # I'll move `fetch_activity` to a `crud.py` or just `activities.py` router? No, reusable.
    # I'll put `fetch_activity` in `backend/app/services/activity_crud.py` or similar.
    pass
