"""SQLAlchemy 2.0 models for the ModevI platform."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
    Column,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ---------------------------------------------------------------------------
# Association table: store_apps <-> hardware_tags  (many-to-many)
# ---------------------------------------------------------------------------

store_app_hardware = Table(
    "store_app_hardware",
    Base.metadata,
    Column(
        "store_app_id",
        Integer,
        ForeignKey("store_apps.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "hardware_tag_id",
        Integer,
        ForeignKey("hardware_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


# ---------------------------------------------------------------------------
# Platform domain
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'developer', 'admin')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    store_apps: Mapped[List["StoreApp"]] = relationship(
        "StoreApp", back_populates="developer"
    )
    app_ratings: Mapped[List["AppRating"]] = relationship(
        "AppRating", back_populates="user"
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    store_apps: Mapped[List["StoreApp"]] = relationship(
        "StoreApp", back_populates="category"
    )


class HardwareTag(Base):
    __tablename__ = "hardware_tags"
    __table_args__ = (
        CheckConstraint(
            "interface IN ('gpio', 'i2c', 'spi', 'usb', 'other')",
            name="ck_hardware_tags_interface",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    interface: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Relationships
    store_apps: Mapped[List["StoreApp"]] = relationship(
        "StoreApp", secondary=store_app_hardware, back_populates="hardware_tags"
    )
    registered_sensors: Mapped[List["RegisteredSensor"]] = relationship(
        "RegisteredSensor", back_populates="hardware_tag"
    )


class StoreApp(Base):
    __tablename__ = "store_apps"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')",
            name="ck_store_apps_status",
        ),
        Index("ix_store_apps_status", "status"),
        Index("ix_store_apps_category", "category_id"),
        Index("ix_store_apps_developer", "developer_id"),
        Index("ix_store_apps_downloads", "downloads_count"),
        Index("ix_store_apps_rating", "avg_rating"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    developer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    long_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    package_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    downloads_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0)
    ratings_count: Mapped[int] = mapped_column(Integer, default=0)
    required_hardware: Mapped[list] = mapped_column(JSON, default=list)
    permissions: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    developer: Mapped["User"] = relationship("User", back_populates="store_apps")
    category: Mapped[Optional["Category"]] = relationship(
        "Category", back_populates="store_apps"
    )
    hardware_tags: Mapped[List["HardwareTag"]] = relationship(
        "HardwareTag", secondary=store_app_hardware, back_populates="store_apps"
    )
    app_ratings: Mapped[List["AppRating"]] = relationship(
        "AppRating", back_populates="store_app"
    )
    installed_app: Mapped[Optional["InstalledApp"]] = relationship(
        "InstalledApp", back_populates="store_app", uselist=False
    )


class AppRating(Base):
    __tablename__ = "app_ratings"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_app_ratings_rating"),
        UniqueConstraint("user_id", "store_app_id", name="uq_app_ratings_user_app"),
        Index("ix_app_ratings_store_app", "store_app_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    store_app_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("store_apps.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="app_ratings")
    store_app: Mapped["StoreApp"] = relationship("StoreApp", back_populates="app_ratings")


# ---------------------------------------------------------------------------
# Device domain
# ---------------------------------------------------------------------------


class InstalledApp(Base):
    __tablename__ = "installed_apps"
    __table_args__ = (
        Index("ix_installed_apps_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_app_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("store_apps.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    install_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    last_launched: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    launch_count: Mapped[int] = mapped_column(Integer, default=0)
    install_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    store_app: Mapped[Optional["StoreApp"]] = relationship(
        "StoreApp", back_populates="installed_app"
    )
    app_data: Mapped[List["AppData"]] = relationship(
        "AppData", back_populates="installed_app", cascade="all, delete-orphan"
    )
    activity_log: Mapped[List["ActivityLog"]] = relationship(
        "ActivityLog", back_populates="installed_app"
    )


class AppData(Base):
    __tablename__ = "app_data"
    __table_args__ = (
        UniqueConstraint(
            "installed_app_id", "key", name="uq_app_data_app_key"
        ),
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

    # Relationships
    installed_app: Mapped["InstalledApp"] = relationship(
        "InstalledApp", back_populates="app_data"
    )


class ActivityLog(Base):
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

    # Relationships
    installed_app: Mapped[Optional["InstalledApp"]] = relationship(
        "InstalledApp", back_populates="activity_log"
    )


class Note(Base):
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


class DeviceSetting(Base):
    __tablename__ = "device_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class RegisteredSensor(Base):
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
    hardware_tag_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("hardware_tags.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    hardware_tag: Mapped[Optional["HardwareTag"]] = relationship(
        "HardwareTag", back_populates="registered_sensors"
    )
