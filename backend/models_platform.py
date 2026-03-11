"""SQLAlchemy models for the ModevI *platform* database (PostgreSQL).

Tables: users, categories, hardware_tags, store_apps,
        store_app_hardware (M2M), app_ratings
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import PlatformBase


# ---------------------------------------------------------------------------
# Association table: store_apps <-> hardware_tags  (many-to-many)
# ---------------------------------------------------------------------------

store_app_hardware = Table(
    "store_app_hardware",
    PlatformBase.metadata,
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
# Users
# ---------------------------------------------------------------------------


class User(PlatformBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    store_apps: Mapped[List["StoreApp"]] = relationship("StoreApp", back_populates="developer")
    app_ratings: Mapped[List["AppRating"]] = relationship("AppRating", back_populates="user")


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


class Category(PlatformBase):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    store_apps: Mapped[List["StoreApp"]] = relationship("StoreApp", back_populates="category")


# ---------------------------------------------------------------------------
# Hardware tags
# ---------------------------------------------------------------------------


class HardwareTag(PlatformBase):
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

    store_apps: Mapped[List["StoreApp"]] = relationship(
        "StoreApp", secondary=store_app_hardware, back_populates="hardware_tags"
    )


# ---------------------------------------------------------------------------
# Store apps
# ---------------------------------------------------------------------------


class StoreApp(PlatformBase):
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
    package_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    downloads_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0)
    ratings_count: Mapped[int] = mapped_column(Integer, default=0)
    required_hardware: Mapped[list] = mapped_column(JSON, default=list)
    permissions: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    developer: Mapped["User"] = relationship("User", back_populates="store_apps")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="store_apps")
    hardware_tags: Mapped[List["HardwareTag"]] = relationship(
        "HardwareTag", secondary=store_app_hardware, back_populates="store_apps"
    )
    app_ratings: Mapped[List["AppRating"]] = relationship("AppRating", back_populates="store_app")


# ---------------------------------------------------------------------------
# App ratings
# ---------------------------------------------------------------------------


class AppRating(PlatformBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="app_ratings")
    store_app: Mapped["StoreApp"] = relationship("StoreApp", back_populates="app_ratings")
