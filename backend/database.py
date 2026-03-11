"""Database engines and session factories for ModevI.

- Platform DB (PostgreSQL): users, categories, store_apps, ratings, hardware_tags
- Device DB   (SQLite):     installed_apps, app_data, activity_log, notes,
                             device_settings, registered_sensors
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ---------------------------------------------------------------------------
# Connection URLs  (override via environment variables)
# ---------------------------------------------------------------------------

PLATFORM_DB_URL: str | None = os.getenv("PLATFORM_DB_URL")
if not PLATFORM_DB_URL:
    raise RuntimeError("PLATFORM_DB_URL environment variable is not set")

_device_db_path: str = os.getenv(
    "DEVICE_DB_PATH",
    os.path.join(os.path.dirname(__file__), "device.db"),
)
DEVICE_DB_URL: str = f"sqlite:///{_device_db_path}"

# ---------------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------------

platform_engine = create_engine(PLATFORM_DB_URL, pool_pre_ping=True, echo=False)
device_engine = create_engine(DEVICE_DB_URL, connect_args={"check_same_thread": False}, echo=False)

# ---------------------------------------------------------------------------
# Session factories
# ---------------------------------------------------------------------------

PlatformSession = sessionmaker(bind=platform_engine, autocommit=False, autoflush=False)
DeviceSession = sessionmaker(bind=device_engine, autocommit=False, autoflush=False)


# ---------------------------------------------------------------------------
# Declarative bases  (one per engine so metadata stays separate)
# ---------------------------------------------------------------------------


class PlatformBase(DeclarativeBase):
    pass


class DeviceBase(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency helpers
# ---------------------------------------------------------------------------


def get_platform_db():
    db = PlatformSession()
    try:
        yield db
    finally:
        db.close()


def get_device_db():
    db = DeviceSession()
    try:
        yield db
    finally:
        db.close()


# Legacy alias kept for any stray import
get_db = get_platform_db


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------


def init_db() -> None:
    # Import models so their metadata is registered before create_all
    import models_platform  # noqa: F401
    import models_device  # noqa: F401

    PlatformBase.metadata.create_all(bind=platform_engine)
    DeviceBase.metadata.create_all(bind=device_engine)
