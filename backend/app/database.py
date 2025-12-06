import os
from sqlmodel import create_engine, Session

connect_args = {"check_same_thread": False}

# Use a default if DB_URL is not set, though it should be.
db_url = os.getenv("DB_URL")
if not db_url:
    # Fallback or error? For now, I'll rely on env var or assume sqlite default if needed.
    # But based on model_helpers, it expects os.getenv("DB_URL") to return something valid or it might fail if None is passed to create_engine depending on version.
    # Looking at original code: os.getenv("DB_URL")
    pass

engine = create_engine(
    db_url if db_url else "sqlite:///database.db",
    echo=True,
    connect_args=connect_args
)

def get_db_session():
    """Returns DB session."""
    with Session(engine) as session:
        yield session
