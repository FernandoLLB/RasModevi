# ModevI — Complete System Architecture

**Version**: 1.0
**Date**: 2026-03-10
**Stack**: FastAPI 0.115 + SQLAlchemy 2.0 + SQLite | React 19 + Vite 6 + TailwindCSS 4 + React Router v7
**Target**: Raspberry Pi 5, 16 GB RAM, 7" touch display, Chromium kiosk mode

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend Architecture](#3-backend-architecture)
   - 3.1 [Directory Structure](#31-directory-structure)
   - 3.2 [Database Models](#32-database-models)
   - 3.3 [Pydantic Schemas](#33-pydantic-schemas)
   - 3.4 [Service Layer](#34-service-layer)
   - 3.5 [API Routers — Full Endpoint Reference](#35-api-routers--full-endpoint-reference)
   - 3.6 [File Storage Layout](#36-file-storage-layout)
   - 3.7 [Security Design](#37-security-design)
   - 3.8 [WebSocket Design](#38-websocket-design)
   - 3.9 [main.py Bootstrap](#39-mainpy-bootstrap)
4. [Frontend Architecture](#4-frontend-architecture)
   - 4.1 [Directory Structure](#41-directory-structure)
   - 4.2 [Route Map](#42-route-map)
   - 4.3 [Component Hierarchy](#43-component-hierarchy)
   - 4.4 [Context / State Management](#44-context--state-management)
   - 4.5 [API Client Layer](#45-api-client-layer)
   - 4.6 [TypeScript Interfaces](#46-typescript-interfaces)
5. [ModevI.js SDK](#5-moveijs-sdk)
   - 5.1 [SDK Injection Mechanism](#51-sdk-injection-mechanism)
   - 5.2 [Full SDK API Reference](#52-full-sdk-api-reference)
   - 5.3 [postMessage Protocol](#53-postmessage-protocol)
   - 5.4 [SDK Bridge — Backend Endpoints](#54-sdk-bridge--backend-endpoints)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
   - 6.1 [Error Handling Contract](#61-error-handling-contract)
   - 6.2 [Loading States Strategy](#62-loading-states-strategy)
   - 6.3 [Touch Optimization Rules](#63-touch-optimization-rules)
   - 6.4 [Dark Theme Tokens](#64-dark-theme-tokens)
   - 6.5 [Offline Behavior](#65-offline-behavior)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Dependencies List](#8-dependencies-list)

---

## 1. Project Overview

ModevI is a modular application platform with two integrated experiences:

**Community Store** — A web-accessible portal where developers publish open-source app packages (ZIP files with a `manifest.json`). Community users browse, filter by hardware requirements, rate, and install apps onto their device.

**Device Experience** — A Raspberry Pi 5 boots directly into ModevI (Chromium kiosk mode). The device presents the store UI, manages installed apps, runs apps inside sandboxed iframes, and exposes hardware (GPIO, I2C sensors) to those apps through the ModevI.js SDK.

Both experiences are served by a single FastAPI process on port 8000. The frontend is a React SPA (built to `frontend/dist/`) that FastAPI serves as a catch-all.

---

## 2. Repository Layout

```
rasModevi/
├── backend/
│   ├── main.py                     # FastAPI app bootstrap
│   ├── database.py                 # SQLAlchemy engine + session
│   ├── models.py                   # SQLAlchemy ORM models (11 tables)
│   ├── schemas.py                  # Pydantic request/response schemas
│   ├── seed.py                     # DB seed for dev
│   ├── dependencies.py             # FastAPI dependency injections (auth guards)
│   ├── routers/
│   │   ├── auth.py                 # /api/auth
│   │   ├── store.py                # /api/store (public browse)
│   │   ├── store_dev.py            # /api/store/apps (developer CRUD)
│   │   ├── ratings.py              # /api/store/ratings
│   │   ├── device.py               # /api/device
│   │   ├── hardware.py             # /api/hardware (+ WebSocket)
│   │   ├── sdk.py                  # /api/sdk (iframe bridge)
│   │   ├── notes.py                # /api/notes
│   │   └── system.py               # /api/system
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── store_service.py
│   │   ├── package_service.py
│   │   ├── device_service.py
│   │   ├── hardware_service.py
│   │   └── sdk_service.py
│   ├── store/
│   │   ├── packages/{store_app_id}/app.zip
│   │   └── icons/{store_app_id}/icon.{ext}
│   ├── installed/
│   │   └── {installed_app_id}/
│   │       ├── manifest.json
│   │       ├── index.html
│   │       └── assets/
│   ├── static/                     # modevi.js SDK file
│   │   └── modevi.js
│   └── modevi.db
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                 # Router root
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── DeviceContext.jsx
│   │   │   └── StoreContext.jsx
│   │   ├── api/
│   │   │   └── client.js           # fetch wrapper + typed API functions
│   │   ├── layouts/
│   │   │   ├── DeviceLayout.jsx
│   │   │   └── PortalLayout.jsx
│   │   ├── pages/
│   │   │   ├── StorePage.jsx
│   │   │   ├── AppDetailPage.jsx
│   │   │   ├── LauncherPage.jsx
│   │   │   ├── AppRunnerPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── developer/
│   │   │       ├── DeveloperDashboard.jsx
│   │   │       ├── AppUploadWizard.jsx
│   │   │       └── AppEditPage.jsx
│   │   ├── components/
│   │   │   ├── ui/                 # primitives: Button, Badge, Card, Spinner, Toast
│   │   │   ├── store/
│   │   │   │   ├── AppCard.jsx
│   │   │   │   ├── StoreGrid.jsx
│   │   │   │   ├── CategoryBar.jsx
│   │   │   │   ├── HardwareFilterBar.jsx
│   │   │   │   └── RatingsSection.jsx
│   │   │   ├── device/
│   │   │   │   ├── InstalledAppGrid.jsx
│   │   │   │   ├── LauncherAppIcon.jsx
│   │   │   │   ├── SandboxedIframe.jsx
│   │   │   │   └── InstallButton.jsx
│   │   │   ├── hardware/
│   │   │   │   └── SensorCard.jsx
│   │   │   └── layout/
│   │   │       ├── TopBar.jsx
│   │   │       └── StatsBar.jsx
│   │   └── hooks/
│   │       ├── useAuth.js
│   │       ├── useInstall.js
│   │       └── useSensorStream.js
│   ├── public/
│   └── dist/                       # built output (served by FastAPI)
├── scripts/
│   ├── start.sh
│   └── kiosk.sh
└── docs/
    ├── database-schema.md
    ├── architecture.md             # this file
    └── Contexto.md
```

---

## 3. Backend Architecture

### 3.1 Directory Structure

The backend is a single Python package rooted at `backend/`. FastAPI uses `lifespan` context manager to run startup tasks (DB table creation, seeding). All routers are registered in `main.py`. SQLAlchemy uses a single `modevi.db` file.

### 3.2 Database Models

Full SQLAlchemy model definitions for all 11 tables. The `store_*` prefix denotes community-platform tables; un-prefixed tables are device-local.

```python
# backend/models.py  (complete replacement of existing file)

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, Float,
    ForeignKey, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ── Auth ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    username       = Column(String(50), nullable=False, unique=True, index=True)
    email          = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password= Column(String(255), nullable=False)
    role           = Column(String(20), nullable=False, default="user")
    # role values: "user" | "developer" | "admin"
    created_at     = Column(DateTime, server_default=func.now())
    is_active      = Column(Boolean, default=True)

    store_apps     = relationship("StoreApp", back_populates="developer")
    ratings        = relationship("AppRating", back_populates="user")


# ── Store / Community ────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    icon        = Column(String(50))          # lucide icon name
    description = Column(Text)
    sort_order  = Column(Integer, default=0)

    store_apps  = relationship("StoreApp", back_populates="category")


class HardwareTag(Base):
    __tablename__ = "hardware_tags"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text)

    store_apps  = relationship("StoreApp", secondary="store_app_hardware",
                               back_populates="hardware_tags")
    sensors     = relationship("RegisteredSensor", back_populates="hardware_tag")


class StoreAppHardware(Base):
    """Many-to-many join: store_apps ↔ hardware_tags."""
    __tablename__ = "store_app_hardware"
    store_app_id    = Column(Integer, ForeignKey("store_apps.id"), primary_key=True)
    hardware_tag_id = Column(Integer, ForeignKey("hardware_tags.id"), primary_key=True)


class StoreApp(Base):
    __tablename__ = "store_apps"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    developer_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    name             = Column(String(150), nullable=False)
    slug             = Column(String(150), nullable=False, unique=True, index=True)
    description      = Column(String(500))        # short summary
    long_description = Column(Text)
    icon_path        = Column(String(500))         # relative to backend/
    package_path     = Column(String(500))         # relative to backend/
    category_id      = Column(Integer, ForeignKey("categories.id"))
    version          = Column(String(30), default="1.0.0")
    downloads_count  = Column(Integer, default=0)
    avg_rating       = Column(Float, default=0.0)
    ratings_count    = Column(Integer, default=0)
    required_hardware= Column(JSON, default=list)  # list of hardware_tag slugs
    permissions      = Column(JSON, default=list)  # list of permission strings
    status           = Column(String(20), default="pending")
    # status values: "pending" | "approved" | "rejected"
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(),
                              onupdate=func.now())

    developer        = relationship("User", back_populates="store_apps")
    category         = relationship("Category", back_populates="store_apps")
    hardware_tags    = relationship("HardwareTag",
                                   secondary="store_app_hardware",
                                   back_populates="store_apps")
    ratings          = relationship("AppRating", back_populates="store_app")


class AppRating(Base):
    __tablename__ = "app_ratings"
    __table_args__ = (UniqueConstraint("user_id", "store_app_id"),)
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    store_app_id = Column(Integer, ForeignKey("store_apps.id"), nullable=False)
    rating       = Column(Integer, nullable=False)   # 1–5
    comment      = Column(Text)
    created_at   = Column(DateTime, server_default=func.now())

    user         = relationship("User", back_populates="ratings")
    store_app    = relationship("StoreApp", back_populates="ratings")


# ── Device / Local ───────────────────────────────────────────────────────────

class InstalledApp(Base):
    __tablename__ = "installed_apps"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    store_app_id   = Column(Integer, ForeignKey("store_apps.id"),
                            nullable=False, unique=True)
    install_date   = Column(DateTime, server_default=func.now())
    is_active      = Column(Boolean, default=False)
    last_launched  = Column(DateTime)
    launch_count   = Column(Integer, default=0)

    store_app      = relationship("StoreApp")
    app_data       = relationship("AppData", back_populates="installed_app",
                                  cascade="all, delete-orphan")


class AppData(Base):
    """Per-app key-value store used by ModevI.js SDK."""
    __tablename__ = "app_data"
    __table_args__ = (UniqueConstraint("installed_app_id", "key"),)
    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(Integer, ForeignKey("installed_apps.id"),
                               nullable=False)
    key              = Column(String(255), nullable=False)
    value            = Column(Text)
    updated_at       = Column(DateTime, server_default=func.now(),
                              onupdate=func.now())

    installed_app    = relationship("InstalledApp", back_populates="app_data")


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(Integer, ForeignKey("installed_apps.id"),
                               nullable=True)
    action           = Column(String(50), nullable=False)
    # action values: installed | uninstalled | launched | activated | deactivated
    timestamp        = Column(DateTime, server_default=func.now())
    details          = Column(JSON)


class Note(Base):
    __tablename__ = "notes"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    title      = Column(String(200), nullable=False)
    content    = Column(Text, default="")
    color      = Column(String(20), default="#fef08a")
    pinned     = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DeviceSetting(Base):
    __tablename__ = "device_settings"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    key         = Column(String(100), nullable=False, unique=True)
    value       = Column(Text)
    description = Column(Text)


class RegisteredSensor(Base):
    __tablename__ = "registered_sensors"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String(100), nullable=False)
    type            = Column(String(50), nullable=False)
    # type: temperature | humidity | pressure | distance | light | custom
    interface       = Column(String(20), nullable=False)
    # interface: gpio | i2c | spi
    pin_or_address  = Column(String(50), nullable=False)
    config_json     = Column(JSON, default=dict)
    hardware_tag_id = Column(Integer, ForeignKey("hardware_tags.id"),
                              nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())

    hardware_tag    = relationship("HardwareTag", back_populates="sensors")
```

### 3.3 Pydantic Schemas

```python
# backend/schemas.py  — all request/response shapes

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, conint, field_validator


# ── Auth ────────────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "user"           # "user" | "developer"

class UserLoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime
    is_active: bool
    model_config = {"from_attributes": True}

class RefreshRequest(BaseModel):
    refresh_token: str


# ── Categories & Hardware Tags ───────────────────────────────────────────────

class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    icon: Optional[str]
    description: Optional[str]
    sort_order: int
    model_config = {"from_attributes": True}

class HardwareTagResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    model_config = {"from_attributes": True}


# ── Store Apps ───────────────────────────────────────────────────────────────

class StoreAppSummary(BaseModel):
    """Used in list/grid views."""
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon_path: Optional[str]
    category_id: Optional[int]
    version: str
    downloads_count: int
    avg_rating: float
    ratings_count: int
    required_hardware: list[str]
    permissions: list[str]
    status: str
    created_at: datetime
    developer_username: str
    model_config = {"from_attributes": True}

class StoreAppDetail(StoreAppSummary):
    """Used in detail/single-app views."""
    long_description: Optional[str]
    updated_at: datetime
    hardware_tags: list[HardwareTagResponse]

class CreateAppRequest(BaseModel):
    name: str
    description: str
    long_description: Optional[str] = None
    category_id: Optional[int] = None
    version: str = "1.0.0"
    required_hardware: list[str] = []
    permissions: list[str] = []

class UpdateAppRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    category_id: Optional[int] = None
    version: Optional[str] = None
    required_hardware: Optional[list[str]] = None
    permissions: Optional[list[str]] = None


# ── Ratings ──────────────────────────────────────────────────────────────────

class RatingRequest(BaseModel):
    rating: conint(ge=1, le=5)
    comment: Optional[str] = None

class RatingResponse(BaseModel):
    id: int
    user_id: int
    store_app_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    username: str
    model_config = {"from_attributes": True}


# ── Installed Apps ───────────────────────────────────────────────────────────

class InstalledAppResponse(BaseModel):
    id: int
    store_app_id: int
    install_date: datetime
    is_active: bool
    last_launched: Optional[datetime]
    launch_count: int
    app_name: str
    app_slug: str
    app_icon_path: Optional[str]
    app_version: str
    model_config = {"from_attributes": True}


# ── Hardware ─────────────────────────────────────────────────────────────────

class SensorRegisterRequest(BaseModel):
    name: str
    type: str
    interface: str
    pin_or_address: str
    config_json: dict = {}
    hardware_tag_id: Optional[int] = None

class SensorResponse(BaseModel):
    id: int
    name: str
    type: str
    interface: str
    pin_or_address: str
    config_json: dict
    hardware_tag_id: Optional[int]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class GPIOReadResponse(BaseModel):
    pin: int
    value: int          # 0 or 1

class GPIOWriteRequest(BaseModel):
    value: int          # 0 or 1

class SensorReadingResponse(BaseModel):
    sensor_id: int
    value: float
    unit: str
    timestamp: datetime


# ── SDK Bridge ───────────────────────────────────────────────────────────────

class SDKGetRequest(BaseModel):
    app_id: int
    key: str

class SDKSetRequest(BaseModel):
    app_id: int
    key: str
    value: Any

class SDKDeleteRequest(BaseModel):
    app_id: int
    key: str

class SDKListRequest(BaseModel):
    app_id: int
    prefix: Optional[str] = None

class SDKDataItem(BaseModel):
    key: str
    value: Any

class SDKListResponse(BaseModel):
    items: list[SDKDataItem]


# ── Notes ────────────────────────────────────────────────────────────────────

class NoteCreateRequest(BaseModel):
    title: str
    content: str = ""
    color: str = "#fef08a"
    pinned: bool = False

class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    pinned: Optional[bool] = None

class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    color: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── System ───────────────────────────────────────────────────────────────────

class SystemInfoResponse(BaseModel):
    hostname: str
    cpu_percent: float
    cpu_temp: Optional[float]
    memory_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    uptime_seconds: int
    os: str
    python_version: str

class SystemStatsResponse(BaseModel):
    installed_apps: int
    total_store_apps: int
    active_app: Optional[str]     # installed_app_id as string, or null
    activity_today: int


# ── Device Settings ──────────────────────────────────────────────────────────

class DeviceSettingResponse(BaseModel):
    key: str
    value: Optional[str]
    description: Optional[str]
    model_config = {"from_attributes": True}

class DeviceSettingUpdateRequest(BaseModel):
    value: str


# ── Package Manifest (not a DB schema, parsed from ZIP) ─────────────────────

class ManifestSchema(BaseModel):
    name: str
    version: str
    description: str
    category: Optional[str] = None
    required_hardware: list[str] = []
    permissions: list[str] = []
    entry_point: str = "index.html"

    @field_validator("entry_point")
    @classmethod
    def entry_point_must_be_html(cls, v: str) -> str:
        if not v.endswith(".html"):
            raise ValueError("entry_point must end in .html")
        return v
```

### 3.4 Service Layer

#### `AuthService` — `backend/services/auth_service.py`

Responsibilities: password hashing, JWT creation/validation, user CRUD.

```python
# Key public interface:

class AuthService:
    SECRET_KEY: str       # from env var MODEVI_SECRET or generated on first run
    ALGORITHM = "HS256"
    ACCESS_EXPIRE_MINUTES = 30
    REFRESH_EXPIRE_DAYS = 7

    def hash_password(plain: str) -> str
    def verify_password(plain: str, hashed: str) -> bool
    def create_access_token(data: dict) -> str
    def create_refresh_token(data: dict) -> str
    def decode_token(token: str) -> dict      # raises HTTPException 401 on invalid
    def create_user(db, req: UserRegisterRequest) -> User
    def get_user_by_username(db, username: str) -> User | None
    def get_user_by_id(db, user_id: int) -> User | None
    def authenticate(db, username: str, password: str) -> User  # raises 401
```

Dependency functions in `backend/dependencies.py`:

```python
def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User
def require_developer(user: User = Depends(get_current_user)) -> User   # raises 403
def require_admin(user: User = Depends(get_current_user)) -> User       # raises 403
def get_current_user_optional(...) -> User | None   # for endpoints that work both auth'd and not
```

#### `StoreService` — `backend/services/store_service.py`

Responsibilities: paginated/filtered app queries, download count updates, rating aggregation.

```python
class StoreService:
    def list_apps(
        db, *, category_slug=None, hardware_tag_slug=None,
        search=None, sort="downloads", page=1, page_size=20,
        status="approved"
    ) -> tuple[list[StoreApp], int]   # (items, total_count)

    def get_app_by_slug(db, slug: str) -> StoreApp   # raises 404

    def get_app_by_id(db, app_id: int) -> StoreApp   # raises 404

    def increment_downloads(db, store_app_id: int) -> None

    def update_rating_aggregate(db, store_app_id: int) -> None
    # Recalculates avg_rating and ratings_count from app_ratings table

    def get_ratings(db, store_app_id: int, page=1, page_size=20) -> list[AppRating]

    def upsert_rating(db, user_id: int, store_app_id: int, req: RatingRequest) -> AppRating

    def developer_list_apps(db, developer_id: int) -> list[StoreApp]
```

#### `PackageService` — `backend/services/package_service.py`

Responsibilities: ZIP validation, manifest parsing, extraction, icon extraction.

```python
class PackageService:
    MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024   # 50 MB
    ALLOWED_MIME = {"application/zip", "application/x-zip-compressed"}

    def validate_and_parse(file: UploadFile) -> ManifestSchema
    # Validates: file is ZIP, ≤50MB, contains manifest.json at root,
    # manifest parses correctly, entry_point file exists inside ZIP.
    # Raises HTTPException 422 on any failure.

    def save_package(file_bytes: bytes, store_app_id: int) -> str
    # Saves to backend/store/packages/{store_app_id}/app.zip
    # Returns relative path string.

    def extract_icon(zip_bytes: bytes, store_app_id: int) -> str | None
    # Looks for icon.png | icon.jpg | icon.svg at ZIP root.
    # Saves to backend/store/icons/{store_app_id}/icon.{ext}
    # Returns relative path or None.

    def extract_for_install(store_app_id: int, installed_app_id: int) -> str
    # Extracts backend/store/packages/{store_app_id}/app.zip
    # to backend/installed/{installed_app_id}/
    # Returns extraction path.

    def remove_installed(installed_app_id: int) -> None
    # Deletes backend/installed/{installed_app_id}/ tree.
```

#### `DeviceService` — `backend/services/device_service.py`

Responsibilities: install/uninstall workflow, active app management.

```python
class DeviceService:
    def install_app(db, store_app_id: int) -> InstalledApp
    # 1. Checks not already installed (unique constraint).
    # 2. Calls PackageService.extract_for_install().
    # 3. Creates InstalledApp row.
    # 4. Calls StoreService.increment_downloads().
    # 5. Writes ActivityLog(action="installed").
    # 6. Returns InstalledApp.

    def uninstall_app(db, installed_app_id: int) -> None
    # 1. Deactivates if active.
    # 2. Calls PackageService.remove_installed().
    # 3. Deletes InstalledApp (cascades AppData).
    # 4. Writes ActivityLog(action="uninstalled").

    def activate_app(db, installed_app_id: int) -> InstalledApp
    # 1. Deactivates any currently active app.
    # 2. Sets is_active=True.
    # 3. Writes ActivityLog(action="activated").

    def deactivate_app(db, installed_app_id: int) -> InstalledApp
    # Sets is_active=False, writes ActivityLog.

    def record_launch(db, installed_app_id: int) -> None
    # Updates last_launched=now(), launch_count+=1, writes ActivityLog.

    def list_installed(db) -> list[InstalledApp]

    def get_installed(db, installed_app_id: int) -> InstalledApp   # raises 404
```

#### `HardwareService` — `backend/services/hardware_service.py`

Responsibilities: GPIO via gpiozero, I2C sensor reads, WebSocket broadcaster.

```python
class HardwareService:
    # Lazy imports of gpiozero / smbus2 so backend runs on non-Pi hosts

    def read_gpio(pin: int) -> int          # returns 0 or 1
    def write_gpio(pin: int, value: int) -> bool

    def register_sensor(db, req: SensorRegisterRequest) -> RegisteredSensor
    def list_sensors(db) -> list[RegisteredSensor]
    def get_sensor(db, sensor_id: int) -> RegisteredSensor   # raises 404

    async def read_sensor_once(sensor: RegisteredSensor) -> SensorReadingResponse
    # Dispatches to correct reader: I2C, GPIO, mock

    async def stream_sensor(
        sensor_id: int, websocket: WebSocket, db,
        interval_ms: int = 1000
    ) -> None
    # Polls sensor every interval_ms, sends JSON over WebSocket until disconnect.
```

#### `SDKService` — `backend/services/sdk_service.py`

Responsibilities: sandboxed per-app data operations called by the SDK bridge.

```python
class SDKService:
    def get_value(db, installed_app_id: int, key: str) -> Any | None

    def set_value(db, installed_app_id: int, key: str, value: Any) -> None
    # JSON-encodes value into AppData.value text column.

    def delete_value(db, installed_app_id: int, key: str) -> None

    def list_values(
        db, installed_app_id: int, prefix: str | None = None
    ) -> list[SDKDataItem]

    def validate_active_app(db, installed_app_id: int) -> InstalledApp
    # Raises 403 if app is not currently is_active=True.
    # SDK endpoints call this to prevent idle apps from writing data.
```

### 3.5 API Routers — Full Endpoint Reference

All endpoints live under `/api/`. Authenticated endpoints require `Authorization: Bearer <access_token>` header.

---

#### `/api/auth` — `backend/routers/auth.py`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | none | Create new user account |
| POST | `/api/auth/login` | none | Exchange credentials for JWT pair |
| GET | `/api/auth/me` | user | Return current user profile |
| POST | `/api/auth/refresh` | none | Exchange refresh token for new access token |

**POST /api/auth/register**
```
Request:  UserRegisterRequest
Response: UserResponse (201)
Errors:   422 if username/email taken
```

**POST /api/auth/login**
```
Request:  UserLoginRequest
Response: TokenResponse (200)
Errors:   401 if credentials invalid
```

**GET /api/auth/me**
```
Request:  — (reads from JWT)
Response: UserResponse (200)
Errors:   401 if token invalid/expired
```

**POST /api/auth/refresh**
```
Request:  RefreshRequest
Response: TokenResponse (200) — new access_token, same refresh_token
Errors:   401 if refresh_token invalid/expired
```

---

#### `/api/store` — `backend/routers/store.py` (public browsing)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/store/apps` | optional | List/search approved apps |
| GET | `/api/store/apps/{slug}` | optional | Get full app detail |
| GET | `/api/store/apps/{slug}/ratings` | optional | Paginated ratings for an app |
| GET | `/api/store/categories` | none | List all categories |
| GET | `/api/store/hardware-tags` | none | List all hardware tags |

**GET /api/store/apps**
```
Query params:
  category:   string (slug)
  hardware:   string (hardware_tag slug, repeatable)
  search:     string (full-text on name + description)
  sort:       "downloads" | "rating" | "newest"  (default: "downloads")
  page:       int (default: 1)
  page_size:  int (default: 20, max: 100)
  status:     "approved" (fixed for public endpoint)

Response: {
  items: StoreAppSummary[]
  total: int
  page: int
  page_size: int
  pages: int
}
```

**GET /api/store/apps/{slug}**
```
Response: StoreAppDetail
Errors:   404 if not found or status != "approved"
```

**GET /api/store/apps/{slug}/ratings**
```
Query params: page, page_size
Response: {
  items: RatingResponse[]
  total: int
  avg_rating: float
}
```

---

#### `/api/store/apps` — `backend/routers/store_dev.py` (developer-only)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/store/developer/apps` | developer | List own apps (all statuses) |
| POST | `/api/store/developer/apps` | developer | Create app listing (metadata only) |
| PUT | `/api/store/developer/apps/{app_id}` | developer + owner | Update app metadata |
| DELETE | `/api/store/developer/apps/{app_id}` | developer + owner | Delete app listing |
| POST | `/api/store/developer/apps/{app_id}/upload` | developer + owner | Upload/replace ZIP package |
| POST | `/api/store/developer/apps/{app_id}/submit` | developer + owner | Submit for admin review |
| PUT | `/api/admin/apps/{app_id}/status` | admin | Approve or reject app |

**POST /api/store/developer/apps**
```
Request:  CreateAppRequest (JSON body)
Response: StoreAppDetail (201)
Notes:    Sets status="pending". Package must be uploaded separately.
```

**POST /api/store/developer/apps/{app_id}/upload**
```
Request:  multipart/form-data, field "package" (ZIP file)
Response: { store_app_id: int, package_path: str, icon_path: str | null }
Errors:
  422 — not a ZIP file
  422 — ZIP exceeds 50 MB
  422 — missing manifest.json
  422 — manifest validation failure
  413 — Content-Length header exceeds limit
Notes:
  Calls PackageService.validate_and_parse().
  Saves package + extracts icon.
  Updates store_app.package_path, icon_path, version (from manifest).
```

**PUT /api/admin/apps/{app_id}/status**
```
Request:  { status: "approved" | "rejected", reason?: string }
Response: StoreAppDetail
Notes:    Admin only. Sets status field.
```

---

#### `/api/store/ratings` — `backend/routers/ratings.py`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/store/ratings/{store_app_id}` | user | Create or update own rating |
| DELETE | `/api/store/ratings/{store_app_id}` | user | Delete own rating |

**POST /api/store/ratings/{store_app_id}**
```
Request:  RatingRequest
Response: RatingResponse (201 if created, 200 if updated)
Notes:    Upserts (one rating per user per app). Triggers rating aggregate update.
```

---

#### `/api/device` — `backend/routers/device.py`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/device/installed` | none | List all installed apps |
| POST | `/api/device/install/{store_app_id}` | none | Install app from store |
| DELETE | `/api/device/installed/{installed_app_id}` | none | Uninstall app |
| POST | `/api/device/installed/{installed_app_id}/activate` | none | Set as active app |
| POST | `/api/device/installed/{installed_app_id}/deactivate` | none | Deactivate app |
| POST | `/api/device/installed/{installed_app_id}/launch` | none | Record launch event |
| GET | `/api/device/settings` | none | List device settings |
| PUT | `/api/device/settings/{key}` | none | Update a device setting |

Note: Device endpoints have no auth requirement because the device UI is local-only and runs in kiosk mode. If exposed over the network, add a local-only middleware check.

**GET /api/device/installed**
```
Response: InstalledAppResponse[]
```

**POST /api/device/install/{store_app_id}**
```
Response: InstalledAppResponse (201)
Errors:
  404 — store app not found
  409 — already installed
  422 — package not yet uploaded (package_path is null)
```

**POST /api/device/installed/{installed_app_id}/activate**
```
Response: InstalledAppResponse
Notes:    Deactivates any currently active app first (only one active at a time).
```

**GET /api/device/settings**
```
Response: DeviceSettingResponse[]
```

**PUT /api/device/settings/{key}**
```
Request:  DeviceSettingUpdateRequest
Response: DeviceSettingResponse
Errors:   404 if key does not exist
```

---

#### `/api/hardware` — `backend/routers/hardware.py`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/hardware/sensors` | none | List registered sensors |
| POST | `/api/hardware/sensors` | none | Register a new sensor |
| DELETE | `/api/hardware/sensors/{sensor_id}` | none | Remove sensor registration |
| GET | `/api/hardware/gpio/{pin}` | none | Read GPIO pin (digital) |
| POST | `/api/hardware/gpio/{pin}` | none | Write GPIO pin (digital) |
| GET | `/api/hardware/sensors/{sensor_id}/read` | none | Single sensor reading |
| WS | `/api/hardware/sensors/{sensor_id}/stream` | none | WebSocket: stream readings |

**GET /api/hardware/gpio/{pin}**
```
Response: GPIOReadResponse
Errors:   422 if pin is not a valid BCM pin number
          500 if hardware read fails (not on Pi)
```

**POST /api/hardware/gpio/{pin}**
```
Request:  GPIOWriteRequest
Response: { pin: int, value: int, success: true }
```

**GET /api/hardware/sensors/{sensor_id}/read**
```
Query params: — (none)
Response: SensorReadingResponse
```

**WS /api/hardware/sensors/{sensor_id}/stream**
```
Query params: interval_ms (int, default 1000, min 100)
WebSocket messages (server → client):
  { type: "reading", data: SensorReadingResponse }
  { type: "error", message: string }
WebSocket messages (client → server):
  { type: "ping" }   → server replies { type: "pong" }
  { type: "stop" }   → server closes connection cleanly
```

---

#### `/api/sdk` — `backend/routers/sdk.py` (SDK bridge)

These endpoints are called exclusively by the AppRunner component (in the browser) on behalf of iframe apps, via `fetch` proxied from postMessage events. The `installed_app_id` comes from the iframe's URL path, validated against `installed_apps.is_active`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/sdk/{installed_app_id}/data/{key}` | none | Get one data item |
| PUT | `/api/sdk/{installed_app_id}/data/{key}` | none | Set one data item |
| DELETE | `/api/sdk/{installed_app_id}/data/{key}` | none | Delete one data item |
| GET | `/api/sdk/{installed_app_id}/data` | none | List data (with optional prefix) |
| GET | `/api/sdk/{installed_app_id}/system/info` | none | System info for SDK |
| GET | `/api/sdk/{installed_app_id}/sensors` | none | Sensor list for SDK |
| GET | `/api/sdk/{installed_app_id}/sensors/{sensor_id}` | none | Single reading for SDK |

**Security note**: Every SDK endpoint calls `SDKService.validate_active_app(db, installed_app_id)` first. If the app is not currently active (is_active=False), it returns 403. This prevents an app that is no longer running from reading or writing data.

**GET /api/sdk/{installed_app_id}/data**
```
Query params: prefix (optional string)
Response: SDKListResponse
```

**PUT /api/sdk/{installed_app_id}/data/{key}**
```
Request:  { value: any }   — JSON body, value is any JSON type
Response: { key: str, updated_at: datetime }
```

---

#### `/api/notes` — `backend/routers/notes.py` (existing, unchanged interface)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/notes` | none | List all notes |
| POST | `/api/notes` | none | Create note |
| GET | `/api/notes/{note_id}` | none | Get single note |
| PUT | `/api/notes/{note_id}` | none | Update note |
| DELETE | `/api/notes/{note_id}` | none | Delete note |

---

#### `/api/system` — `backend/routers/system.py` (existing, extended)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/system/info` | none | Full system info (CPU, RAM, temp, disk) |
| GET | `/api/system/stats` | none | App-level stats |
| GET | `/api/system/activity` | none | Recent activity log entries |

**GET /api/system/activity**
```
Query params: limit (int, default 20, max 100)
Response: ActivityLogEntry[]  where ActivityLogEntry = {
  id: int, action: str, timestamp: datetime,
  details: object | null, app_name: str | null
}
```

---

### 3.6 File Storage Layout

```
backend/
├── store/
│   ├── packages/
│   │   └── {store_app_id}/
│   │       └── app.zip             # original uploaded ZIP, kept for re-install
│   └── icons/
│       └── {store_app_id}/
│           └── icon.{png|jpg|svg}  # extracted from ZIP root
├── installed/
│   └── {installed_app_id}/         # unique per device installation
│       ├── manifest.json           # copied from ZIP
│       ├── index.html              # entry point
│       └── assets/                 # all other ZIP contents
└── modevi.db
```

FastAPI serves `backend/installed/` at `/installed/` via `StaticFiles(html=True)`. This means `/installed/{installed_app_id}/` serves the app's `index.html` automatically, enabling the iframe `src` to point there directly.

FastAPI serves `backend/store/icons/` at `/store-icons/` for icon `<img>` tags.

### 3.7 Security Design

**JWT Configuration**
- Library: `python-jose[cryptography]` + `passlib[bcrypt]`
- Algorithm: `HS256`
- Access token expiry: 30 minutes
- Refresh token expiry: 7 days
- Secret key: read from `MODEVI_SECRET` environment variable; if not set, generate a random key on startup and persist it to `backend/.secret_key` file

**Role-Based Guards (FastAPI dependencies)**

```python
# Three dependency levels:
get_current_user          → requires valid access token, any role
require_developer         → role in ("developer", "admin")
require_admin             → role == "admin"
```

Store developer endpoints also check object ownership:
```python
def check_app_owner(app_id: int, user: User, db) -> StoreApp:
    app = db.get(StoreApp, app_id)
    if not app or (app.developer_id != user.id and user.role != "admin"):
        raise HTTPException(403)
    return app
```

**File Upload Validation**

The `PackageService.validate_and_parse()` function enforces:
1. `Content-Type` must be `application/zip` or `application/x-zip-compressed`
2. File size ≤ 50 MB (checked before reading full body)
3. `manifest.json` must exist at the ZIP root (not in a subdirectory)
4. `manifest.json` must parse against `ManifestSchema` (Pydantic validation)
5. `entry_point` file referenced in manifest must exist inside the ZIP
6. No path traversal in ZIP entries (all paths must be relative, no `../`)

**CORS**: In production (device kiosk) CORS can be set to `allow_origins=["http://localhost:8000"]`. The current wildcard is acceptable for TFG dev mode.

### 3.8 WebSocket Design

The `/api/hardware/sensors/{sensor_id}/stream` endpoint uses FastAPI's `WebSocket` type. The connection lifecycle:

```
Client connects → server validates sensor exists → enters polling loop:
  while connected:
    reading = await HardwareService.read_sensor_once(sensor)
    await ws.send_json({"type": "reading", "data": reading})
    await asyncio.sleep(interval_ms / 1000)

On disconnect (WebSocketDisconnect): loop exits, no cleanup needed.
On sensor read error: send {"type": "error", "message": "..."}, continue loop.
```

The frontend `useSensorStream` hook wraps this with automatic reconnect on disconnect (exponential backoff, max 5 retries).

### 3.9 main.py Bootstrap

```python
# backend/main.py — updated structure

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import create_all_tables
from seed import seed
from routers import auth, store, store_dev, ratings, device, hardware, sdk, notes, system

@asynccontextmanager
async def lifespan(app):
    create_all_tables()
    seed()
    yield

app = FastAPI(title="ModevI API", version="2.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

for router in [auth, store, store_dev, ratings, device, hardware, sdk, notes, system]:
    app.include_router(router.router)

# Serve installed app bundles (iframe src targets)
app.mount("/installed", StaticFiles(directory="installed", html=True), name="installed")

# Serve store icons
app.mount("/store-icons", StaticFiles(directory="store/icons"), name="store-icons")

# Serve SDK JS file
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve frontend SPA (catch-all, must be last)
FRONTEND_DIR = "../frontend/dist"
if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=f"{FRONTEND_DIR}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(f"{FRONTEND_DIR}/index.html")
```

---

## 4. Frontend Architecture

### 4.1 Directory Structure

See [Section 2 — Repository Layout](#2-repository-layout) for the full tree.

Key conventions:
- `pages/` — one file per route, thin orchestration components that compose smaller pieces
- `components/` — reusable building blocks, organized by domain
- `contexts/` — React Context providers, one per concern
- `api/` — all `fetch` calls centralized here, no inline fetches in components
- `hooks/` — custom hooks that encapsulate side effects

### 4.2 Route Map

Defined in `frontend/src/App.jsx` using React Router v7 `createBrowserRouter`.

```jsx
const router = createBrowserRouter([
  // ── Device / Kiosk routes (DeviceLayout) ─────────────────────────────
  {
    element: <DeviceLayout />,
    children: [
      { path: "/",              element: <StorePage /> },
      { path: "/app/:slug",     element: <AppDetailPage /> },
      { path: "/launcher",      element: <LauncherPage /> },
      { path: "/settings",      element: <SettingsPage /> },
    ],
  },

  // ── App Runner (fullscreen, no chrome) ───────────────────────────────
  { path: "/running/:app_id",   element: <AppRunnerPage /> },

  // ── Auth routes (minimal layout) ─────────────────────────────────────
  { path: "/login",             element: <LoginPage /> },
  { path: "/register",          element: <RegisterPage /> },

  // ── Developer portal (PortalLayout) ──────────────────────────────────
  {
    path: "/developer",
    element: <RequireDeveloper><PortalLayout /></RequireDeveloper>,
    children: [
      { index: true,            element: <DeveloperDashboard /> },
      { path: "upload",         element: <AppUploadWizard /> },
      { path: "app/:id",        element: <AppEditPage /> },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    path: "/admin",
    element: <RequireAdmin><PortalLayout /></RequireAdmin>,
    children: [
      { index: true,            element: <AdminAppsQueue /> },
    ],
  },
])
```

Route guard components `<RequireDeveloper>` and `<RequireAdmin>` read from `AuthContext` and redirect to `/login` if the role check fails.

### 4.3 Component Hierarchy

```
App (RouterProvider + AuthProvider + DeviceProvider + StoreProvider)
│
├── DeviceLayout                          layouts/DeviceLayout.jsx
│   ├── TopBar                            components/layout/TopBar.jsx
│   │   ├── Logo (SVG)
│   │   ├── SearchInput                   components/ui/SearchInput.jsx
│   │   ├── UserAvatar (→ /login)
│   │   └── BackButton (conditional)
│   ├── CategoryBar                       components/store/CategoryBar.jsx
│   │   └── CategoryPill[]
│   ├── HardwareFilterBar                 components/store/HardwareFilterBar.jsx
│   │   └── HardwareBadge[] (toggleable)
│   └── <Outlet />
│       │
│       ├── StorePage                     pages/StorePage.jsx
│       │   ├── StatsBar                  components/layout/StatsBar.jsx
│       │   ├── ActiveAppBanner           components/device/ActiveAppBanner.jsx
│       │   └── StoreGrid                 components/store/StoreGrid.jsx
│       │       ├── SkeletonCard[]        components/ui/SkeletonCard.jsx
│       │       └── AppCard[]             components/store/AppCard.jsx
│       │           ├── HardwareBadge[]
│       │           ├── RatingStars       components/ui/RatingStars.jsx
│       │           └── InstallButton     components/device/InstallButton.jsx
│       │
│       ├── AppDetailPage                 pages/AppDetailPage.jsx
│       │   ├── AppHeader
│       │   │   ├── AppIcon
│       │   │   ├── HardwareBadges[]
│       │   │   └── RatingStars
│       │   ├── InstallButton             components/device/InstallButton.jsx
│       │   ├── LongDescription (markdown render)
│       │   └── RatingsSection            components/store/RatingsSection.jsx
│       │       ├── RatingDistribution
│       │       ├── RatingForm (if authenticated)
│       │       └── RatingCard[]
│       │
│       ├── LauncherPage                  pages/LauncherPage.jsx
│       │   └── InstalledAppGrid          components/device/InstalledAppGrid.jsx
│       │       └── LauncherAppIcon[]     components/device/LauncherAppIcon.jsx
│       │           └── (long-press menu: Launch, Uninstall)
│       │
│       └── SettingsPage                  pages/SettingsPage.jsx
│           ├── DeviceSettingsList
│           └── SensorCard[]              components/hardware/SensorCard.jsx
│               └── SensorReadingDisplay
│
├── AppRunnerPage                         pages/AppRunnerPage.jsx
│   ├── RunnerTopBar (back + app name, auto-hides after 3s)
│   └── SandboxedIframe                  components/device/SandboxedIframe.jsx
│       (handles postMessage SDK bridge)
│
├── LoginPage                             pages/LoginPage.jsx
├── RegisterPage                          pages/RegisterPage.jsx
│
└── PortalLayout                          layouts/PortalLayout.jsx
    ├── PortalSidebar
    └── <Outlet />
        ├── DeveloperDashboard            pages/developer/DeveloperDashboard.jsx
        │   ├── StatsCards
        │   └── MyAppsTable
        ├── AppUploadWizard               pages/developer/AppUploadWizard.jsx
        │   ├── Step1_ZipUpload
        │   ├── Step2_Metadata            (pre-filled from manifest)
        │   └── Step3_Preview
        └── AppEditPage                   pages/developer/AppEditPage.jsx
```

#### Key Component Specifications

**`InstallButton`** — state machine with 5 states:
```
not_installed → (click) → installing (spinner) → installed
installed     → (click) → launch / go to /running/:id
installed     → (long press or icon click) → confirm_uninstall → (confirm) → not_installed
installing    → (background) → error (retry button)
```

**`SandboxedIframe`** — core iframe configuration:
```jsx
<iframe
  src={`/installed/${appId}/`}
  sandbox="allow-scripts allow-same-origin allow-forms"
  // allow-same-origin is needed so ModevI.js can postMessage back to parent
  // allow-popups is NOT included (prevents opening new windows)
  style={{ width: "100%", height: "100%", border: "none" }}
  title={appName}
/>
```

**`LauncherAppIcon`** — touch behavior:
- Single tap: navigate to `/running/:id`
- Long press (500ms): show overlay menu (Launch fullscreen / Uninstall)
- Implements `onTouchStart`/`onTouchEnd` (no hover events)

### 4.4 Context / State Management

**`AuthContext`** — `frontend/src/contexts/AuthContext.jsx`

```typescript
interface AuthContextValue {
  user: UserResponse | null
  token: string | null
  isAuthenticated: boolean
  role: "user" | "developer" | "admin" | null
  login(username: string, password: string): Promise<void>
  logout(): void
  register(data: UserRegisterRequest): Promise<void>
}
```

Implementation notes:
- Stores `access_token` and `refresh_token` in `localStorage`
- On mount, reads token from localStorage and validates via `GET /api/auth/me`
- Intercepts 401 responses in the API client to attempt token refresh before failing
- `logout()` clears localStorage and resets state

**`DeviceContext`** — `frontend/src/contexts/DeviceContext.jsx`

```typescript
interface DeviceContextValue {
  installedApps: InstalledAppResponse[]
  activeApp: InstalledAppResponse | null
  isLoading: boolean
  install(storeAppId: number): Promise<void>
  uninstall(installedAppId: number): Promise<void>
  activate(installedAppId: number): Promise<void>
  deactivate(installedAppId: number): Promise<void>
  refresh(): Promise<void>
}
```

Implementation notes:
- Loads installed apps once on mount and after any mutation
- `install()` shows a progress toast during download/extraction (polls or uses optimistic update)
- Exposes `activeApp` as a derived value (first item where `is_active === true`)

**`StoreContext`** — `frontend/src/contexts/StoreContext.jsx`

```typescript
interface StoreContextValue {
  categories: CategoryResponse[]
  hardwareTags: HardwareTagResponse[]
  selectedCategory: string | null
  selectedHardwareTags: string[]
  searchQuery: string
  sortMode: "downloads" | "rating" | "newest"
  setCategory(slug: string | null): void
  toggleHardwareTag(slug: string): void
  setSearchQuery(q: string): void
  setSortMode(mode: string): void
}
```

Implementation notes:
- Loads categories and hardware tags once on mount (static reference data)
- Filter state lives here so `CategoryBar`, `HardwareFilterBar`, `SearchInput`, and `StoreGrid` all stay in sync
- App listings themselves are NOT in context — `StorePage` fetches them locally based on filter values from this context

**No global store for app listings**: `StorePage` uses a local `useState` + `useEffect` that re-fetches whenever filter values from `StoreContext` change. This avoids stale cache issues and keeps the store browsing stateless.

### 4.5 API Client Layer

All HTTP calls go through `frontend/src/api/client.js`. This module exports typed async functions, never raw `fetch` calls in components.

```javascript
// frontend/src/api/client.js

const BASE = ""   // same origin

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new ApiError(res.status, err.detail, err.code)
  }
  return res.json()
}

// Named exports mirror the router structure:
export const authApi = {
  register: (data) => request("POST", "/api/auth/register", data),
  login: (data) => request("POST", "/api/auth/login", data),
  me: (token) => request("GET", "/api/auth/me", null, token),
  refresh: (refreshToken) => request("POST", "/api/auth/refresh", { refresh_token: refreshToken }),
}

export const storeApi = {
  listApps: (params) => request("GET", `/api/store/apps?${new URLSearchParams(params)}`),
  getApp: (slug) => request("GET", `/api/store/apps/${slug}`),
  getRatings: (slug, params) => request("GET", `/api/store/apps/${slug}/ratings?${new URLSearchParams(params)}`),
  categories: () => request("GET", "/api/store/categories"),
  hardwareTags: () => request("GET", "/api/store/hardware-tags"),
}

export const storeDevApi = {
  myApps: (token) => request("GET", "/api/store/developer/apps", null, token),
  createApp: (data, token) => request("POST", "/api/store/developer/apps", data, token),
  updateApp: (id, data, token) => request("PUT", `/api/store/developer/apps/${id}`, data, token),
  deleteApp: (id, token) => request("DELETE", `/api/store/developer/apps/${id}`, null, token),
  uploadPackage: (id, formData, token) => {
    // FormData upload — cannot use JSON helper
    return fetch(`/api/store/developer/apps/${id}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(new ApiError(res.status, e.detail))))
  },
  submitApp: (id, token) => request("POST", `/api/store/developer/apps/${id}/submit`, null, token),
}

export const deviceApi = {
  installed: () => request("GET", "/api/device/installed"),
  install: (storeAppId) => request("POST", `/api/device/install/${storeAppId}`),
  uninstall: (installedAppId) => request("DELETE", `/api/device/installed/${installedAppId}`),
  activate: (installedAppId) => request("POST", `/api/device/installed/${installedAppId}/activate`),
  deactivate: (installedAppId) => request("POST", `/api/device/installed/${installedAppId}/deactivate`),
  launch: (installedAppId) => request("POST", `/api/device/installed/${installedAppId}/launch`),
  settings: () => request("GET", "/api/device/settings"),
  updateSetting: (key, value) => request("PUT", `/api/device/settings/${key}`, { value }),
}

export const hardwareApi = {
  sensors: () => request("GET", "/api/hardware/sensors"),
  registerSensor: (data) => request("POST", "/api/hardware/sensors", data),
  deleteSensor: (id) => request("DELETE", `/api/hardware/sensors/${id}`),
  readGPIO: (pin) => request("GET", `/api/hardware/gpio/${pin}`),
  writeGPIO: (pin, value) => request("POST", `/api/hardware/gpio/${pin}`, { value }),
  readSensor: (id) => request("GET", `/api/hardware/sensors/${id}/read`),
}

export const systemApi = {
  info: () => request("GET", "/api/system/info"),
  stats: () => request("GET", "/api/system/stats"),
  activity: (limit = 20) => request("GET", `/api/system/activity?limit=${limit}`),
}

export const ratingsApi = {
  submit: (storeAppId, data, token) => request("POST", `/api/store/ratings/${storeAppId}`, data, token),
  delete: (storeAppId, token) => request("DELETE", `/api/store/ratings/${storeAppId}`, null, token),
}

export class ApiError extends Error {
  constructor(status, detail, code) {
    super(detail)
    this.status = status
    this.code = code
  }
}
```

### 4.6 TypeScript Interfaces

The project uses JSX (not TSX), but these interface definitions document the exact shapes components expect. They map 1:1 to the Pydantic schemas in section 3.3.

```typescript
interface UserResponse {
  id: number
  username: string
  email: string
  role: "user" | "developer" | "admin"
  created_at: string    // ISO datetime
  is_active: boolean
}

interface CategoryResponse {
  id: number
  name: string
  slug: string
  icon: string | null   // lucide-react icon name
  description: string | null
  sort_order: number
}

interface HardwareTagResponse {
  id: number
  name: string
  slug: string
  description: string | null
}

interface StoreAppSummary {
  id: number
  name: string
  slug: string
  description: string | null
  icon_path: string | null
  category_id: number | null
  version: string
  downloads_count: number
  avg_rating: number
  ratings_count: number
  required_hardware: string[]   // hardware_tag slugs
  permissions: string[]
  status: "pending" | "approved" | "rejected"
  created_at: string
  developer_username: string
}

interface StoreAppDetail extends StoreAppSummary {
  long_description: string | null
  updated_at: string
  hardware_tags: HardwareTagResponse[]
}

interface InstalledAppResponse {
  id: number
  store_app_id: number
  install_date: string
  is_active: boolean
  last_launched: string | null
  launch_count: number
  app_name: string
  app_slug: string
  app_icon_path: string | null
  app_version: string
}

interface RatingResponse {
  id: number
  user_id: number
  store_app_id: number
  rating: number        // 1–5
  comment: string | null
  created_at: string
  username: string
}

interface SensorResponse {
  id: number
  name: string
  type: string
  interface: "gpio" | "i2c" | "spi"
  pin_or_address: string
  config_json: Record<string, unknown>
  hardware_tag_id: number | null
  is_active: boolean
  created_at: string
}

interface SensorReadingResponse {
  sensor_id: number
  value: number
  unit: string
  timestamp: string
}

interface SystemInfoResponse {
  hostname: string
  cpu_percent: number
  cpu_temp: number | null
  memory_percent: number
  memory_used_gb: number
  memory_total_gb: number
  disk_percent: number
  disk_used_gb: number
  disk_total_gb: number
  uptime_seconds: number
  os: string
  python_version: string
}

interface DeviceSettingResponse {
  key: string
  value: string | null
  description: string | null
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}
```

---

## 5. ModevI.js SDK

### 5.1 SDK Injection Mechanism

When `AppRunnerPage` renders, it:
1. Navigates to `/running/:app_id`
2. Records a launch event via `POST /api/device/installed/:app_id/launch`
3. Activates the app via `POST /api/device/installed/:app_id/activate`
4. Renders a `<SandboxedIframe>` pointing to `/installed/:app_id/`

The installed app's `index.html` includes in its `<head>`:
```html
<script src="/static/modevi.js"></script>
```

This script tag is **injected automatically** by `PackageService.extract_for_install()` into the app's `index.html` during installation — the developer does not add it manually.

`modevi.js` (at `/static/modevi.js`) sets up `window.ModevI` and the `postMessage` → `fetch` bridge.

### 5.2 Full SDK API Reference

```javascript
// backend/static/modevi.js
// Injected into every installed app's index.html at install time.
// Provides window.ModevI to the app.

(function () {
  "use strict";

  const APP_ID = __MODEVI_APP_ID__;
  // __MODEVI_APP_ID__ is replaced by PackageService at extraction time
  // with the actual installed_app_id integer.

  // ── Internal postMessage bridge ─────────────────────────────────────────

  let _callId = 0;
  const _pending = new Map();   // callId → { resolve, reject }

  window.addEventListener("message", (event) => {
    // Accept only messages from the parent (AppRunner)
    if (event.source !== window.parent) return;
    const { __callId, result, error } = event.data ?? {};
    if (!_pending.has(__callId)) return;
    const { resolve, reject } = _pending.get(__callId);
    _pending.delete(__callId);
    if (error) reject(new Error(error));
    else resolve(result);
  });

  function _call(method, args) {
    return new Promise((resolve, reject) => {
      const id = ++_callId;
      _pending.set(id, { resolve, reject });
      window.parent.postMessage({ __callId: id, method, args }, "*");
      // Timeout after 10 seconds
      setTimeout(() => {
        if (_pending.has(id)) {
          _pending.delete(id);
          reject(new Error(`ModevI.${method} timed out`));
        }
      }, 10000);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.ModevI = {

    system: {
      /**
       * Returns: { hostname, cpu_percent, cpu_temp, memory_percent,
       *            memory_used_gb, memory_total_gb, uptime_seconds, os }
       */
      getInfo() {
        return _call("system.getInfo", {});
      },

      /**
       * Returns: { installed_apps, total_store_apps, active_app }
       */
      getStats() {
        return _call("system.getStats", {});
      },
    },

    hardware: {
      /**
       * Returns: SensorResponse[]
       */
      getSensors() {
        return _call("hardware.getSensors", {});
      },

      /**
       * pin: BCM pin number (integer)
       * Returns: { pin: number, value: 0 | 1 }
       */
      readGPIO(pin) {
        return _call("hardware.readGPIO", { pin });
      },

      /**
       * pin: BCM pin number
       * value: 0 or 1
       * Returns: { pin: number, value: number, success: true }
       */
      writeGPIO(pin, value) {
        return _call("hardware.writeGPIO", { pin, value });
      },

      /**
       * sensor_id: integer from getSensors()
       * Returns: { sensor_id, value, unit, timestamp }
       */
      readSensor(sensor_id) {
        return _call("hardware.readSensor", { sensor_id });
      },

      /**
       * sensor_id: integer
       * callback: function({ value, unit, timestamp })
       * Returns: { stop: function }  — call stop() to end streaming
       *
       * Opens a WebSocket to /api/hardware/sensors/{id}/stream.
       * The WebSocket is opened from the PARENT window (not the iframe)
       * to avoid sandbox restrictions — routed via postMessage.
       */
      streamSensor(sensor_id, callback) {
        let active = true;
        _call("hardware.streamSensor.start", { sensor_id }).then((streamId) => {
          const handler = (event) => {
            if (!active) return;
            const { __streamId, reading, error } = event.data ?? {};
            if (__streamId !== streamId) return;
            if (error) { console.error("ModevI sensor stream error:", error); return; }
            callback(reading);
          };
          window.addEventListener("message", handler);
          return () => {
            active = false;
            window.removeEventListener("message", handler);
            window.parent.postMessage({ __streamStop: streamId }, "*");
          };
        });
        return {
          stop() {
            active = false;
            _call("hardware.streamSensor.stop", { sensor_id });
          },
        };
      },
    },

    db: {
      /**
       * key: string
       * Returns: any | null
       */
      get(key) {
        return _call("db.get", { key });
      },

      /**
       * key: string, value: any (JSON-serializable)
       * Returns: void
       */
      set(key, value) {
        return _call("db.set", { key, value });
      },

      /**
       * key: string
       * Returns: void
       */
      delete(key) {
        return _call("db.delete", { key });
      },

      /**
       * prefix: string (optional) — filter keys by prefix
       * Returns: { key: string, value: any }[]
       */
      list(prefix) {
        return _call("db.list", { prefix });
      },
    },

    notify: {
      /**
       * message: string
       * type: "info" | "success" | "warning" | "error"  (default: "info")
       * Displays a toast notification in the ModevI shell (not inside the iframe).
       */
      toast(message, type = "info") {
        window.parent.postMessage({ __notify: "toast", message, type }, "*");
        // Fire-and-forget — no Promise needed
      },

      /**
       * count: number (0 clears the badge)
       * Sets a numeric badge on the app's launcher icon.
       */
      badge(count) {
        window.parent.postMessage({ __notify: "badge", count }, "*");
      },
    },
  };

  // Announce readiness to the parent
  window.parent.postMessage({ __modevIReady: true, appId: APP_ID }, "*");
})();
```

### 5.3 postMessage Protocol

`SandboxedIframe` in `AppRunnerPage` listens for messages from the iframe and routes them to `/api/sdk/*` endpoints.

**Message from iframe → parent (SDK call):**
```javascript
{
  __callId: number,           // correlation ID
  method: string,             // e.g. "db.get", "hardware.readGPIO"
  args: Record<string, any>   // method arguments
}
```

**Message from parent → iframe (SDK response):**
```javascript
// Success:
{ __callId: number, result: any }

// Failure:
{ __callId: number, error: string }
```

**Routing table in `SandboxedIframe.jsx`:**

```javascript
const SDK_ROUTES = {
  "system.getInfo":   (args, appId) => fetch(`/api/sdk/${appId}/system/info`).then(r => r.json()),
  "system.getStats":  (args, appId) => fetch(`/api/system/stats`).then(r => r.json()),
  "hardware.getSensors": (args, appId) => fetch(`/api/sdk/${appId}/sensors`).then(r => r.json()),
  "hardware.readGPIO":   ({ pin }, appId) => fetch(`/api/hardware/gpio/${pin}`).then(r => r.json()),
  "hardware.writeGPIO":  ({ pin, value }, appId) =>
    fetch(`/api/hardware/gpio/${pin}`, { method: "POST", body: JSON.stringify({ value }), headers: {"Content-Type":"application/json"} }).then(r => r.json()),
  "hardware.readSensor": ({ sensor_id }, appId) => fetch(`/api/sdk/${appId}/sensors/${sensor_id}`).then(r => r.json()),
  "db.get":    ({ key }, appId)        => fetch(`/api/sdk/${appId}/data/${key}`).then(r => r.json()),
  "db.set":    ({ key, value }, appId) =>
    fetch(`/api/sdk/${appId}/data/${key}`, { method: "PUT", body: JSON.stringify({ value }), headers: {"Content-Type":"application/json"} }).then(r => r.json()),
  "db.delete": ({ key }, appId)        =>
    fetch(`/api/sdk/${appId}/data/${key}`, { method: "DELETE" }).then(r => r.json()),
  "db.list":   ({ prefix }, appId)     =>
    fetch(`/api/sdk/${appId}/data${prefix ? `?prefix=${prefix}` : ""}`).then(r => r.json()),
}
```

Sensor streaming uses a separate WebSocket opened in the parent window, relayed to the iframe via `__streamId` tagged messages.

### 5.4 SDK Bridge — Backend Endpoints

The `/api/sdk/{installed_app_id}/*` endpoints call `SDKService.validate_active_app()` before every operation. If the app is not active, 403 is returned, and `SandboxedIframe` propagates the error back to the iframe as a rejected Promise.

All SDK data values are JSON-encoded before storage and JSON-decoded on retrieval, supporting all JSON-serializable types (string, number, boolean, array, object, null).

---

## 6. Cross-Cutting Concerns

### 6.1 Error Handling Contract

**Backend → Frontend error shape** (all HTTPExceptions):
```json
{
  "detail": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

Common error codes:
| HTTP | code | Meaning |
|------|------|---------|
| 400 | `ALREADY_INSTALLED` | App already on device |
| 401 | `INVALID_CREDENTIALS` | Wrong username/password |
| 401 | `TOKEN_EXPIRED` | JWT expired |
| 401 | `TOKEN_INVALID` | JWT malformed |
| 403 | `FORBIDDEN` | Insufficient role |
| 403 | `NOT_APP_OWNER` | Developer owns other app |
| 403 | `APP_NOT_ACTIVE` | SDK call from inactive app |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `DUPLICATE` | Unique constraint violation |
| 422 | `INVALID_PACKAGE` | ZIP validation failure |
| 422 | `INVALID_MANIFEST` | manifest.json parse error |

**Frontend error display rules**:
- 401 `TOKEN_EXPIRED`: silently refresh token, retry request, user never sees error
- 401 `INVALID_CREDENTIALS`: inline error on login form
- 403: redirect to `/login` with a query param `?reason=forbidden`
- 404: show inline "Not found" state within the page, not a full error page
- 422: show specific validation error near the triggering UI element (form field, upload zone)
- 500: show a generic "Something went wrong" toast with a retry button
- Network error (fetch throws): show "No connection" banner, retry when online

### 6.2 Loading States Strategy

| Context | Loading UI |
|---------|------------|
| Store grid initial load | 6× `SkeletonCard` (grey animated pulse, same size as `AppCard`) |
| App detail page | Full-page skeleton matching the layout |
| Install in progress | `InstallButton` shows indeterminate spinner, text "Installing..." |
| Install progress (large apps) | Progress bar under InstallButton fed by polling `GET /api/device/installed` |
| Sensor reading | Spinner in `SensorCard`, replaced by value when data arrives |
| Page navigation | Top-of-page thin progress bar (React Router transition) |
| Developer upload — ZIP processing | Stepper UI with each step going to checkmark when done |

All skeleton states use the same `bg-white/[0.06] animate-pulse rounded` pattern as the existing design.

### 6.3 Touch Optimization Rules

The device has a 7" capacitive touch display. Every interactive element must meet these rules:

1. **Minimum tap target**: 44×44px (enforced via `min-h-[44px] min-w-[44px]` Tailwind classes on all buttons, icons, and list items)
2. **No hover-only interactions**: every feature accessible with hover must also be accessible with tap or long-press
3. **Long-press menus** (LauncherAppIcon): `onTouchStart` sets a 500ms timer; `onTouchEnd`/`onTouchMove` cancels it
4. **Swipe gestures** (LauncherPage): horizontal swipe between pages using `onTouchStart`/`onTouchEnd` delta detection (no third-party library required)
5. **Scroll containers**: use `-webkit-overflow-scrolling: touch` (via Tailwind `overflow-x-auto`) for CategoryBar and HardwareFilterBar
6. **No double-tap zoom**: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` in `index.html`
7. **Active feedback**: all tappable elements get `active:scale-95 transition-transform` instead of hover states
8. **Font size floor**: minimum 14px for any readable text (`text-sm` = 14px in Tailwind)

### 6.4 Dark Theme Tokens

Extending the existing `#0a0a0f` base palette used in the current `App.jsx`:

```css
/* CSS custom properties — add to frontend/src/index.css */
:root {
  --color-base:         #0a0a0f;   /* page background */
  --color-surface-1:    rgba(255,255,255,0.03);  /* card background */
  --color-surface-2:    rgba(255,255,255,0.06);  /* hover state */
  --color-border:       rgba(255,255,255,0.06);  /* subtle borders */
  --color-border-hover: rgba(255,255,255,0.12);
  --color-text-primary: #ffffff;
  --color-text-muted:   rgba(255,255,255,0.50);
  --color-text-faint:   rgba(255,255,255,0.30);
  --color-accent:       #6366f1;   /* indigo-500 — primary actions */
  --color-accent-hover: #4f46e5;   /* indigo-600 */
  --color-success:      #10b981;   /* emerald-500 */
  --color-warning:      #f59e0b;   /* amber-500 */
  --color-danger:       #ef4444;   /* red-500 */
}
```

Hardware badge colors by category:
- GPIO: `text-yellow-400 bg-yellow-400/10`
- I2C/SPI: `text-blue-400 bg-blue-400/10`
- Camera: `text-purple-400 bg-purple-400/10`
- Audio: `text-green-400 bg-green-400/10`
- Generic: `text-white/40 bg-white/[0.06]`

### 6.5 Offline Behavior

| Scenario | Behavior |
|----------|----------|
| Device has no internet, installed apps | Installed apps load fully from `backend/installed/` — completely offline |
| Device has no internet, store browsing | `storeApi.listApps()` fails → show "Store unavailable — no network" banner, launcher still accessible |
| Device has no internet, SDK db calls | SDK db/system calls go to `localhost:8000` — work offline always |
| Device has no internet, SDK hardware calls | GPIO/sensor calls go to `localhost:8000` — work offline always |
| Mid-install network drop | `PackageService` has already received the full ZIP (it's stored on device). Extraction continues. Install is atomic: row created only after extraction succeeds. |
| App being run goes offline | App itself handles this — ModevI has no special handling. The app may use its SDK db as a local cache. |

The frontend detects offline state via `window.addEventListener("offline", ...)` and shows a non-blocking banner. The launcher page and app runner always work regardless of network state.

---

## 7. Data Flow Diagrams

### App Install Flow

```
User taps "Install" on AppCard
  │
  ▼
DeviceContext.install(store_app_id)
  │
  ▼
deviceApi.install(store_app_id)
  POST /api/device/install/{store_app_id}
  │
  ▼ (backend)
DeviceService.install_app(db, store_app_id)
  ├── validate: store_app exists, status="approved", package_path not null
  ├── validate: not already installed (unique constraint)
  ├── PackageService.extract_for_install(store_app_id, new_installed_id)
  │     └── unzip backend/store/packages/{id}/app.zip
  │           → backend/installed/{new_id}/
  │           → inject <script src="/static/modevi.js"> into index.html
  │           → replace __MODEVI_APP_ID__ with new_id
  ├── db.add(InstalledApp(...))
  ├── StoreService.increment_downloads(store_app_id)
  └── db.add(ActivityLog(action="installed"))
  │
  ▼ (frontend)
InstalledAppResponse (201)
  │
  ▼
DeviceContext refreshes installedApps
InstallButton transitions to "installed" state
```

### SDK db.set Flow

```
App (inside iframe) calls:
  ModevI.db.set("score", 42)
  │
  ▼  (modevi.js)
window.parent.postMessage({
  __callId: 7, method: "db.set", args: { key: "score", value: 42 }
}, "*")
  │
  ▼  (SandboxedIframe.jsx in AppRunnerPage — message event listener)
SDK_ROUTES["db.set"]({ key: "score", value: 42 }, installed_app_id=3)
  │
  ▼
fetch PUT /api/sdk/3/data/score
  body: { value: 42 }
  │
  ▼  (backend)
sdk.py router → SDKService.validate_active_app(db, 3)
  ├── if is_active=False → 403
  └── if is_active=True → continue
SDKService.set_value(db, 3, "score", 42)
  └── upsert AppData(installed_app_id=3, key="score", value="42")
  │
  ▼
{ key: "score", updated_at: "..." } (200)
  │
  ▼  (SandboxedIframe.jsx)
iframe.contentWindow.postMessage({
  __callId: 7, result: { key: "score", updated_at: "..." }
}, "*")
  │
  ▼  (modevi.js — message event listener)
Promise from _call("db.set", ...) resolves
  │
  ▼
await ModevI.db.set("score", 42)  ✓ resolves
```

---

## 8. Dependencies List

### Backend (`backend/requirements.txt`)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
pydantic[email]>=2.7.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9    # for UploadFile / form data
psutil>=6.0.0              # system info
gpiozero>=2.0.1            # GPIO (Raspberry Pi only)
smbus2>=0.4.3              # I2C sensors (Raspberry Pi only)
aiofiles>=23.0.0           # async file I/O
```

### Frontend (`frontend/package.json` devDependencies + dependencies)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

No additional state management library (Redux, Zustand) is needed — Context API covers all use cases. No markdown parser is listed here but `marked` or `micromark` can be added for the `long_description` field rendering if desired.
