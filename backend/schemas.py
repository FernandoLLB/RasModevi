"""Pydantic v2 schemas for the ModevI platform API."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    role: str = "user"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "developer", "admin"):
            raise ValueError("role must be 'user', 'developer', or 'admin'")
        return v


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Store schemas
# ---------------------------------------------------------------------------


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: int

    model_config = {"from_attributes": True}


class HardwareTagOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    interface: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreAppOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    icon_path: Optional[str] = None
    version: str
    avg_rating: float
    ratings_count: int
    downloads_count: int
    status: str
    required_hardware: list
    permissions: list
    category_id: Optional[int] = None
    developer_id: int
    created_at: datetime
    developer: Optional[UserOut] = None

    model_config = {"from_attributes": True}


class StoreAppDetail(StoreAppOut):
    long_description: Optional[str] = None
    hardware_tags: List[HardwareTagOut] = []
    rejection_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreAppCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=500)
    long_description: Optional[str] = None
    category_id: Optional[int] = None
    version: str = "1.0.0"
    required_permissions: List[str] = []


class StoreAppUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    long_description: Optional[str] = None
    category_id: Optional[int] = None
    version: Optional[str] = None


class AppRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class AppRatingOut(BaseModel):
    id: int
    user_id: int
    store_app_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Device schemas
# ---------------------------------------------------------------------------


class InstalledAppOut(BaseModel):
    id: int
    store_app_id: Optional[int] = None
    install_date: datetime
    is_active: bool
    last_launched: Optional[datetime] = None
    launch_count: int
    install_path: Optional[str] = None
    store_app: Optional[StoreAppOut] = None

    model_config = {"from_attributes": True}


class AppDataSet(BaseModel):
    value: str


class AppDataOut(BaseModel):
    key: str
    value: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Hardware schemas
# ---------------------------------------------------------------------------


class SensorRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sensor_type: str
    interface: str
    pin_or_address: str
    config_json: dict = {}
    hardware_tag_id: Optional[int] = None

    @field_validator("interface")
    @classmethod
    def validate_interface(cls, v: str) -> str:
        if v not in ("gpio", "i2c", "spi"):
            raise ValueError("interface must be 'gpio', 'i2c', or 'spi'")
        return v


class SensorUpdate(BaseModel):
    name: Optional[str] = None
    sensor_type: Optional[str] = None
    interface: Optional[str] = None
    pin_or_address: Optional[str] = None
    config_json: Optional[dict] = None
    hardware_tag_id: Optional[int] = None
    is_active: Optional[bool] = None


class SensorOut(BaseModel):
    id: int
    name: str
    sensor_type: str
    interface: str
    pin_or_address: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class GPIOReadOut(BaseModel):
    pin: int
    value: int


class GPIOWriteIn(BaseModel):
    value: int = Field(..., ge=0, le=1)


# ---------------------------------------------------------------------------
# System schemas
# ---------------------------------------------------------------------------


class SystemInfo(BaseModel):
    hostname: str
    platform: str
    cpu_percent: float
    cpu_count: int
    ram_percent: float
    ram_total: int
    ram_used: int
    disk_percent: float
    disk_total: int
    disk_used: int
    temperature: Optional[float] = None
    uptime_seconds: int


# ---------------------------------------------------------------------------
# Admin schemas
# ---------------------------------------------------------------------------


class RejectAppBody(BaseModel):
    reason: str
