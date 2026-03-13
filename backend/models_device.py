"""SQLAlchemy models for the ModevI *device* database (SQLite on the Pi).

Tables: installed_apps, app_data, activity_log, notes,
        device_settings, registered_sensors

NOTE: store_app_id in InstalledApp is a plain integer — no cross-DB foreign key.
      Store app details are fetched at runtime from the platform DB via the API.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey

from database import DeviceBase


# ---------------------------------------------------------------------------
# Installed apps
# ---------------------------------------------------------------------------


class InstalledApp(DeviceBase):
    __tablename__ = "installed_apps"
    __table_args__ = (Index("ix_installed_apps_active", "is_active"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Plain integer — no FK because StoreApp lives in the platform DB (PostgreSQL)
    store_app_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, unique=True)
    install_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    last_launched: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    launch_count: Mapped[int] = mapped_column(Integer, default=0)
    install_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Metadata for locally-created apps (store_app_id is None)
    local_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    local_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    local_icon_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    app_data: Mapped[List["AppData"]] = relationship(
        "AppData", back_populates="installed_app", cascade="all, delete-orphan"
    )
    activity_log: Mapped[List["ActivityLog"]] = relationship(
        "ActivityLog", back_populates="installed_app"
    )


# ---------------------------------------------------------------------------
# App key-value data store
# ---------------------------------------------------------------------------


class AppData(DeviceBase):
    __tablename__ = "app_data"
    __table_args__ = (
        UniqueConstraint("installed_app_id", "key", name="uq_app_data_app_key"),
        Index("ix_app_data_app_key", "installed_app_id", "key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    installed_app_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("installed_apps.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    installed_app: Mapped["InstalledApp"] = relationship("InstalledApp", back_populates="app_data")


# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------


class ActivityLog(DeviceBase):
    __tablename__ = "activity_log"
    __table_args__ = (
        Index("ix_activity_log_app", "installed_app_id"),
        Index("ix_activity_log_timestamp", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    installed_app_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("installed_apps.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    installed_app: Mapped[Optional["InstalledApp"]] = relationship(
        "InstalledApp", back_populates="activity_log"
    )


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


class Note(DeviceBase):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="default")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


# ---------------------------------------------------------------------------
# Device settings
# ---------------------------------------------------------------------------


class DeviceSetting(DeviceBase):
    __tablename__ = "device_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


# ---------------------------------------------------------------------------
# Registered sensors
# (hardware_tag_id is a plain integer — HardwareTag lives in the platform DB)
# ---------------------------------------------------------------------------


class RegisteredSensor(DeviceBase):
    __tablename__ = "registered_sensors"
    __table_args__ = (
        CheckConstraint(
            "interface IN ('gpio', 'i2c', 'spi')",
            name="ck_registered_sensors_interface",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sensor_type: Mapped[str] = mapped_column(String(100), nullable=False)
    interface: Mapped[str] = mapped_column(String(20), nullable=False)
    pin_or_address: Mapped[str] = mapped_column(String(50), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # Plain integer — no cross-DB FK to hardware_tags
    hardware_tag_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
