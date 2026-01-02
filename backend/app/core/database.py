"""
Database Connection and Session Management
SQLAlchemy setup for PostgreSQL + PostGIS
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,
    max_overflow=20
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Dependency for FastAPI routes
def get_db():
    """
    Database session dependency for FastAPI routes.

    Usage:
        @app.get("/endpoint")
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_rls_context(db: Session, user_id: str, user_role: str, deo_id: int = None, region: str = None):
    """
    Set PostgreSQL session variables for Row Level Security.

    Args:
        db: Database session
        user_id: UUID of current user
        user_role: Role of current user
        deo_id: DEO ID (for deo_user role)
        region: Region (for regional_admin role)
    """
    try:
        db.execute(
            "SELECT set_session_user(:user_id, :user_role, :user_deo_id, :user_region)",
            {
                "user_id": user_id,
                "user_role": user_role,
                "user_deo_id": deo_id,
                "user_region": region
            }
        )
        db.commit()
    except Exception as e:
        logger.error(f"Failed to set RLS context: {e}")
        db.rollback()


# Event listener to set search_path for PostGIS
@event.listens_for(engine, "connect")
def set_search_path(dbapi_connection, connection_record):
    """Ensure PostGIS functions are available"""
    cursor = dbapi_connection.cursor()
    cursor.execute("SET search_path TO public, postgis")
    cursor.close()
