# ModevI — Database Schema Design

**Version**: 2.0
**Date**: 2026-03-10
**Stack**: FastAPI + SQLAlchemy 2.0 + SQLite
**File**: `backend/modevi.db`

---

## Table of Contents

1. [Overview and Design Decisions](#1-overview-and-design-decisions)
2. [Entity Relationship Summary](#2-entity-relationship-summary)
3. [Schema: Users and Auth](#3-schema-users-and-auth)
4. [Schema: Platform / Community Store](#4-schema-platform--community-store)
5. [Schema: Device / Local](#5-schema-device--local)
6. [Schema: Hardware Registry](#6-schema-hardware-registry)
7. [Indexes](#7-indexes)
8. [Relationships Map](#8-relationships-map)
9. [Migration Notes](#9-migration-notes)
10. [Query Patterns](#10-query-patterns)
11. [Full models.py](#11-full-modelspy)

---

## 1. Overview and Design Decisions

### Two logical domains in one SQLite file

The platform has two distinct concerns that share a single database file:

- **Platform domain**: community store data (users, published apps, ratings, categories). This data could theoretically live on a remote server, but for TFG scope it resides locally alongside the device data.
- **Device domain**: what is installed and running on this specific Raspberry Pi right now (installed apps, per-app key-value storage, activity log, notes, device settings, sensors).

Keeping both in one SQLite file simplifies the deployment (no separate server required for the TFG demo) while maintaining clean separation through table naming: `store_*` prefix for platform tables, no prefix for device-local tables.

### SQLite type notes

SQLite does not enforce column types strictly. The design uses:
- `JSON` columns (stored as TEXT in SQLite, serialized by SQLAlchemy's `JSON` type) for array fields like `required_hardware` and `permissions`.
- `Enum` via `String` with a `CheckConstraint` — SQLAlchemy's `Enum` type works with SQLite but does not enforce at the DB level; the constraint adds that enforcement.
- `Boolean` stored as INTEGER 0/1.
- `DateTime` stored as TEXT in ISO-8601 format via SQLAlchemy's `DateTime`.

### Primary keys

All tables use `Integer` auto-increment primary keys except `users`, `store_apps`, `categories`, and `hardware_tags` which also carry a human-readable `slug` unique column. The `apps` legacy table used a `String` PK (the app slug itself); that is replaced in the new design.

---

## 2. Entity Relationship Summary

```
users ──< store_apps          (one developer publishes many store apps)
users ──< app_ratings          (one user rates many apps)
store_apps ──< app_ratings     (one store app has many ratings)
categories ──< store_apps      (one category contains many store apps)
store_apps >──< hardware_tags  (many-to-many via store_app_hardware)
store_apps ──< installed_apps  (one store app installed zero or one time locally)
installed_apps ──< app_data    (one installed app stores many key-value pairs)
installed_apps ──< activity_log
registered_sensors  (standalone, linked optionally by app_data)
notes               (standalone)
device_settings     (standalone)
```

---

## 3. Schema: Users and Auth

### 3.1 `users`

Covers all account types. Role determines what actions are permitted (enforced at the API layer).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| username | String(50) | NOT NULL, UNIQUE | login handle |
| email | String(255) | NOT NULL, UNIQUE | |
| hashed_password | String(255) | NOT NULL | bcrypt hash |
| role | String(20) | NOT NULL, DEFAULT 'user' | CHECK IN ('user','developer','admin') |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | soft disable without delete |
| created_at | DateTime | NOT NULL, server_default now() | |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |
| avatar_path | String(500) | nullable | path relative to media root |
| bio | Text | nullable | developer profile bio |

**Indexes**: `ix_users_username`, `ix_users_email`

```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'developer', 'admin')", name="ck_users_role"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    username       = Column(String(50), nullable=False, unique=True, index=True)
    email          = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role           = Column(String(20), nullable=False, default="user")
    is_active      = Column(Boolean, nullable=False, default=True)
    created_at     = Column(DateTime, nullable=False, server_default=func.now())
    updated_at     = Column(DateTime, nullable=False, server_default=func.now(),
                            onupdate=func.now())
    avatar_path    = Column(String(500), nullable=True)
    bio            = Column(Text, nullable=True)

    # Relationships
    store_apps  = relationship("StoreApp", back_populates="developer",
                               foreign_keys="StoreApp.developer_id")
    ratings     = relationship("AppRating", back_populates="user")
```

---

## 4. Schema: Platform / Community Store

### 4.1 `categories`

Lookup table for app categories. Seeded at startup.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| name | String(100) | NOT NULL, UNIQUE | display name, e.g. "Utilidades" |
| slug | String(100) | NOT NULL, UNIQUE | URL-safe, e.g. "utilidades" |
| icon | String(100) | nullable | lucide icon name |
| description | Text | nullable | |
| sort_order | Integer | NOT NULL, DEFAULT 0 | controls display order |

**Index**: `ix_categories_slug`

```python
class Category(Base):
    __tablename__ = "categories"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    icon        = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    sort_order  = Column(Integer, nullable=False, default=0)

    store_apps  = relationship("StoreApp", back_populates="category")
```

---

### 4.2 `hardware_tags`

Canonical list of hardware identifiers. Seeded with known hardware.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| name | String(100) | NOT NULL, UNIQUE | display name, e.g. "DHT22" |
| slug | String(100) | NOT NULL, UNIQUE | e.g. "dht22" |
| description | Text | nullable | brief explanation of what this hardware is |
| interface | String(20) | nullable | gpio / i2c / spi / uart / usb |

**Index**: `ix_hardware_tags_slug`

```python
class HardwareTag(Base):
    __tablename__ = "hardware_tags"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    interface   = Column(String(20), nullable=True)  # gpio/i2c/spi/uart/usb

    store_apps  = relationship("StoreApp", secondary="store_app_hardware",
                               back_populates="hardware_tags")
```

---

### 4.3 `store_app_hardware` (association table)

Many-to-many join between `store_apps` and `hardware_tags`.

| Column | Type | Constraints |
|---|---|---|
| store_app_id | Integer | FK store_apps.id, NOT NULL |
| hardware_tag_id | Integer | FK hardware_tags.id, NOT NULL |

**PK**: composite (store_app_id, hardware_tag_id)

```python
from sqlalchemy import Table, ForeignKey

store_app_hardware = Table(
    "store_app_hardware",
    Base.metadata,
    Column("store_app_id",    Integer, ForeignKey("store_apps.id",    ondelete="CASCADE"),
           primary_key=True),
    Column("hardware_tag_id", Integer, ForeignKey("hardware_tags.id", ondelete="CASCADE"),
           primary_key=True),
)
```

---

### 4.4 `store_apps`

The central platform table. One row per published (or pending/rejected) app version. A new version upload creates a new row; older versions are kept for download history integrity.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| developer_id | Integer | FK users.id, NOT NULL | must have role='developer' or 'admin' |
| category_id | Integer | FK categories.id, nullable | nullable allows submission before categorization |
| name | String(200) | NOT NULL | display name |
| slug | String(200) | NOT NULL, UNIQUE | URL-safe identifier, globally unique |
| description | String(500) | NOT NULL | short description (store card) |
| long_description | Text | nullable | full markdown description |
| icon_path | String(500) | nullable | stored under media/icons/ |
| package_path | String(500) | nullable | stored under media/packages/ |
| version | String(50) | NOT NULL, DEFAULT '1.0.0' | semver string |
| status | String(20) | NOT NULL, DEFAULT 'pending' | CHECK IN ('pending','published','rejected') |
| rejection_reason | Text | nullable | filled by admin on rejection |
| downloads_count | Integer | NOT NULL, DEFAULT 0 | denormalized counter, updated on install |
| avg_rating | Float | nullable | denormalized, recomputed on rating change |
| ratings_count | Integer | NOT NULL, DEFAULT 0 | denormalized count |
| required_hardware | JSON | nullable | e.g. ["dht22", "gpio"] — redundant with M2M, kept for fast filtering without join |
| permissions | JSON | nullable | e.g. ["gpio", "filesystem", "network"] |
| manifest_json | JSON | nullable | raw parsed manifest.json from ZIP |
| min_modevi_version | String(20) | nullable | SDK version compatibility floor |
| created_at | DateTime | NOT NULL, server_default now() | |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |

**Why denormalize `avg_rating`, `ratings_count`, `downloads_count`**: Store listing queries must sort and filter by these values across potentially thousands of apps. Recomputing aggregates on every list request is expensive. A trigger-style update (update these columns whenever `app_ratings` or `installed_apps` changes) keeps them fresh at write time rather than read time.

**Why keep `required_hardware` as JSON alongside the M2M table**: The M2M table `store_app_hardware` is the source of truth for filtering and tag management. The JSON column is a denormalized snapshot stored in the `manifest.json` so the device can render it without a join. Both are written together at upload time.

**Indexes**: `ix_store_apps_slug`, `ix_store_apps_developer_id`, `ix_store_apps_category_id`, `ix_store_apps_status`, `ix_store_apps_avg_rating`, `ix_store_apps_downloads_count`

```python
from sqlalchemy import JSON

class StoreApp(Base):
    __tablename__ = "store_apps"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')",
            name="ck_store_apps_status",
        ),
    )

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    developer_id        = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"),
                                 nullable=False, index=True)
    category_id         = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    name                = Column(String(200), nullable=False)
    slug                = Column(String(200), nullable=False, unique=True, index=True)
    description         = Column(String(500), nullable=False)
    long_description    = Column(Text, nullable=True)
    icon_path           = Column(String(500), nullable=True)
    package_path        = Column(String(500), nullable=True)
    version             = Column(String(50), nullable=False, default="1.0.0")
    status              = Column(String(20), nullable=False, default="pending")
    rejection_reason    = Column(Text, nullable=True)
    downloads_count     = Column(Integer, nullable=False, default=0, index=True)
    avg_rating          = Column(Float, nullable=True, index=True)
    ratings_count       = Column(Integer, nullable=False, default=0)
    required_hardware   = Column(JSON, nullable=True)
    permissions         = Column(JSON, nullable=True)
    manifest_json       = Column(JSON, nullable=True)
    min_modevi_version  = Column(String(20), nullable=True)
    created_at          = Column(DateTime, nullable=False, server_default=func.now())
    updated_at          = Column(DateTime, nullable=False, server_default=func.now(),
                                 onupdate=func.now())

    # Relationships
    developer      = relationship("User", back_populates="store_apps",
                                  foreign_keys=[developer_id])
    category       = relationship("Category", back_populates="store_apps")
    ratings        = relationship("AppRating", back_populates="store_app",
                                  cascade="all, delete-orphan")
    hardware_tags  = relationship("HardwareTag", secondary="store_app_hardware",
                                  back_populates="store_apps")
    installed      = relationship("InstalledApp", back_populates="store_app",
                                  cascade="all, delete-orphan")
```

---

### 4.5 `app_ratings`

One rating per user per app. A user can update their rating (upsert on user_id + store_app_id).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| user_id | Integer | FK users.id, NOT NULL | |
| store_app_id | Integer | FK store_apps.id, NOT NULL | |
| rating | Integer | NOT NULL | CHECK BETWEEN 1 AND 5 |
| comment | Text | nullable | optional review text |
| created_at | DateTime | NOT NULL, server_default now() | |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |

**Unique constraint**: (user_id, store_app_id) — one review per user per app.
**Indexes**: `ix_app_ratings_store_app_id`, `ix_app_ratings_user_id`

```python
from sqlalchemy import UniqueConstraint

class AppRating(Base):
    __tablename__ = "app_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "store_app_id", name="uq_app_ratings_user_app"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_app_ratings_rating"),
    )

    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    store_app_id  = Column(Integer, ForeignKey("store_apps.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    rating        = Column(Integer, nullable=False)
    comment       = Column(Text, nullable=True)
    created_at    = Column(DateTime, nullable=False, server_default=func.now())
    updated_at    = Column(DateTime, nullable=False, server_default=func.now(),
                           onupdate=func.now())

    user       = relationship("User", back_populates="ratings")
    store_app  = relationship("StoreApp", back_populates="ratings")
```

---

## 5. Schema: Device / Local

### 5.1 `installed_apps`

Tracks what is currently installed on this Raspberry Pi. One row per installed store app. When an app is uninstalled the row is deleted (or soft-deleted if history is needed — see migration notes).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| store_app_id | Integer | FK store_apps.id, NOT NULL, UNIQUE | one install per app |
| install_date | DateTime | NOT NULL, server_default now() | |
| is_active | Boolean | NOT NULL, DEFAULT FALSE | currently in foreground |
| last_launched | DateTime | nullable | updated on each launch |
| launch_count | Integer | NOT NULL, DEFAULT 0 | incremented on each launch |
| installed_version | String(50) | NOT NULL | version string at install time |
| local_path | String(500) | nullable | path to unpacked app on device filesystem |

**Index**: `ix_installed_apps_store_app_id`, `ix_installed_apps_is_active`

```python
class InstalledApp(Base):
    __tablename__ = "installed_apps"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    store_app_id      = Column(Integer, ForeignKey("store_apps.id", ondelete="RESTRICT"),
                               nullable=False, unique=True, index=True)
    install_date      = Column(DateTime, nullable=False, server_default=func.now())
    is_active         = Column(Boolean, nullable=False, default=False, index=True)
    last_launched     = Column(DateTime, nullable=True)
    launch_count      = Column(Integer, nullable=False, default=0)
    installed_version = Column(String(50), nullable=False)
    local_path        = Column(String(500), nullable=True)

    store_app   = relationship("StoreApp", back_populates="installed")
    app_data    = relationship("AppData", back_populates="installed_app",
                               cascade="all, delete-orphan")
    activity    = relationship("ActivityLog", back_populates="installed_app",
                               cascade="all, delete-orphan")
```

---

### 5.2 `app_data`

Namespaced key-value store for the ModevI SDK. Each installed app gets its own isolated namespace — queried by `installed_app_id + key`. This replaces the old `app_settings` table and extends it for SDK use (apps can read/write arbitrary data, not just settings).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| installed_app_id | Integer | FK installed_apps.id, NOT NULL | |
| key | String(255) | NOT NULL | namespaced key |
| value | Text | nullable | JSON-serializable string |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |

**Unique constraint**: (installed_app_id, key)
**Index**: `ix_app_data_installed_app_id`

```python
class AppData(Base):
    __tablename__ = "app_data"
    __table_args__ = (
        UniqueConstraint("installed_app_id", "key", name="uq_app_data_app_key"),
    )

    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(Integer, ForeignKey("installed_apps.id", ondelete="CASCADE"),
                              nullable=False, index=True)
    key              = Column(String(255), nullable=False)
    value            = Column(Text, nullable=True)
    updated_at       = Column(DateTime, nullable=False, server_default=func.now(),
                              onupdate=func.now())

    installed_app = relationship("InstalledApp", back_populates="app_data")
```

---

### 5.3 `activity_log`

Device-level event log for audit, debugging, and analytics. Records installs, uninstalls, launches, crashes, SDK calls.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| installed_app_id | Integer | FK installed_apps.id, nullable | null for system-level events |
| action | String(100) | NOT NULL | e.g. "installed", "launched", "crashed", "sdk_gpio_read" |
| timestamp | DateTime | NOT NULL, server_default now() | |
| details | Text | nullable | JSON blob with extra context |

**Index**: `ix_activity_log_installed_app_id`, `ix_activity_log_timestamp`, `ix_activity_log_action`

```python
class ActivityLog(Base):
    __tablename__ = "activity_log"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(Integer, ForeignKey("installed_apps.id", ondelete="SET NULL"),
                              nullable=True, index=True)
    action           = Column(String(100), nullable=False, index=True)
    timestamp        = Column(DateTime, nullable=False, server_default=func.now(),
                              index=True)
    details          = Column(Text, nullable=True)

    installed_app = relationship("InstalledApp", back_populates="activity")
```

---

### 5.4 `notes`

Unchanged from existing model. Kept as standalone device-local table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| title | String | NOT NULL | |
| content | Text | DEFAULT '' | |
| color | String | DEFAULT '#fef08a' | hex color for UI card |
| pinned | Boolean | DEFAULT FALSE | |
| created_at | DateTime | server_default now() | |
| updated_at | DateTime | server_default now(), onupdate now() | |

```python
class Note(Base):
    __tablename__ = "notes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    title      = Column(String, nullable=False)
    content    = Column(Text, default="")
    color      = Column(String, default="#fef08a")
    pinned     = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

---

### 5.5 `device_settings`

Global device configuration key-value store. Used for: display brightness, kiosk URL, WiFi SSID display, timezone, etc.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| key | String(255) | NOT NULL, UNIQUE | e.g. "display_brightness", "timezone" |
| value | Text | nullable | JSON-serializable string |
| description | String(500) | nullable | human-readable explanation |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |

**Index**: `ix_device_settings_key`

```python
class DeviceSetting(Base):
    __tablename__ = "device_settings"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    key         = Column(String(255), nullable=False, unique=True, index=True)
    value       = Column(Text, nullable=True)
    description = Column(String(500), nullable=True)
    updated_at  = Column(DateTime, nullable=False, server_default=func.now(),
                         onupdate=func.now())
```

---

## 6. Schema: Hardware Registry

### 6.1 `registered_sensors`

User-registered hardware connected to the Pi. The ModevI SDK exposes these to apps at runtime. An app that requires "DHT22" checks this table to find the pin/address the user configured.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK, autoincrement | |
| name | String(200) | NOT NULL | user-given label, e.g. "Temperatura habitación" |
| type | String(100) | NOT NULL | canonical type slug, e.g. "dht22", "bme280", "button" |
| interface | String(20) | NOT NULL | gpio / i2c / spi / uart / usb |
| pin_or_address | String(50) | nullable | GPIO pin number or I2C hex address e.g. "0x76" |
| config_json | JSON | nullable | additional config: bus number, pull-up, sampling rate |
| is_active | Boolean | NOT NULL, DEFAULT TRUE | false = physically disconnected |
| hardware_tag_id | Integer | FK hardware_tags.id, nullable | links to store tag for filtering |
| created_at | DateTime | NOT NULL, server_default now() | |
| updated_at | DateTime | NOT NULL, server_default now(), onupdate now() | |

**Index**: `ix_registered_sensors_type`, `ix_registered_sensors_interface`, `ix_registered_sensors_is_active`

```python
class RegisteredSensor(Base):
    __tablename__ = "registered_sensors"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String(200), nullable=False)
    type            = Column(String(100), nullable=False, index=True)
    interface       = Column(String(20), nullable=False, index=True)
    pin_or_address  = Column(String(50), nullable=True)
    config_json     = Column(JSON, nullable=True)
    is_active       = Column(Boolean, nullable=False, default=True, index=True)
    hardware_tag_id = Column(Integer, ForeignKey("hardware_tags.id", ondelete="SET NULL"),
                             nullable=True)
    created_at      = Column(DateTime, nullable=False, server_default=func.now())
    updated_at      = Column(DateTime, nullable=False, server_default=func.now(),
                             onupdate=func.now())

    hardware_tag = relationship("HardwareTag")
```

---

## 7. Indexes

The following indexes are defined for the most common query patterns:

| Table | Index Name | Columns | Purpose |
|---|---|---|---|
| users | ix_users_username | username | login lookup |
| users | ix_users_email | email | login lookup |
| categories | ix_categories_slug | slug | URL routing |
| hardware_tags | ix_hardware_tags_slug | slug | URL routing / filter |
| store_apps | ix_store_apps_slug | slug | URL routing |
| store_apps | ix_store_apps_developer_id | developer_id | "my apps" dashboard |
| store_apps | ix_store_apps_category_id | category_id | browse by category |
| store_apps | ix_store_apps_status | status | admin queue, public listing (WHERE status='published') |
| store_apps | ix_store_apps_avg_rating | avg_rating | sort by rating |
| store_apps | ix_store_apps_downloads_count | downloads_count | sort by popularity |
| app_ratings | ix_app_ratings_store_app_id | store_app_id | fetch reviews for an app |
| app_ratings | ix_app_ratings_user_id | user_id | user's review history |
| installed_apps | ix_installed_apps_store_app_id | store_app_id | check if installed |
| installed_apps | ix_installed_apps_is_active | is_active | find currently active app |
| app_data | ix_app_data_installed_app_id | installed_app_id | SDK data reads |
| activity_log | ix_activity_log_installed_app_id | installed_app_id | per-app log |
| activity_log | ix_activity_log_timestamp | timestamp | time-ordered queries |
| activity_log | ix_activity_log_action | action | filter by event type |
| registered_sensors | ix_registered_sensors_type | type | SDK hardware discovery |
| registered_sensors | ix_registered_sensors_interface | interface | filter GPIO vs I2C etc. |
| registered_sensors | ix_registered_sensors_is_active | is_active | only active sensors |
| device_settings | ix_device_settings_key | key | O(1) config reads |

---

## 8. Relationships Map

```
User (1) ──────────────────── (N) StoreApp
  via: StoreApp.developer_id → users.id

User (1) ──────────────────── (N) AppRating
  via: AppRating.user_id → users.id

StoreApp (1) ───────────────── (N) AppRating          [CASCADE DELETE]
  via: AppRating.store_app_id → store_apps.id

Category (1) ──────────────── (N) StoreApp
  via: StoreApp.category_id → categories.id

StoreApp (N) ──────────────── (N) HardwareTag
  via: store_app_hardware association table

StoreApp (1) ───────────────── (0..1) InstalledApp     [UNIQUE FK]
  via: InstalledApp.store_app_id → store_apps.id

InstalledApp (1) ─────────── (N) AppData              [CASCADE DELETE]
  via: AppData.installed_app_id → installed_apps.id

InstalledApp (1) ─────────── (N) ActivityLog          [SET NULL on delete]
  via: ActivityLog.installed_app_id → installed_apps.id

RegisteredSensor (N) ──────── (0..1) HardwareTag      [SET NULL on delete]
  via: RegisteredSensor.hardware_tag_id → hardware_tags.id
```

### Cascade behavior

| Relationship | On parent delete |
|---|---|
| User → StoreApp | RESTRICT (cannot delete a developer who has published apps) |
| StoreApp → AppRating | CASCADE (deleting an app removes all its ratings) |
| StoreApp → InstalledApp | RESTRICT (cannot delete store record of installed app) |
| InstalledApp → AppData | CASCADE (uninstalling deletes all app data) |
| InstalledApp → ActivityLog | SET NULL (history preserved even if app removed) |
| HardwareTag → RegisteredSensor | SET NULL (sensor preserved if tag removed) |

---

## 9. Migration Notes

### What changes from the existing schema

#### `apps` table → **replaced by two tables**

The old `App` model conflated "available apps" (catalog) with "installed state". This is split:

- Catalog data (`name`, `description`, `icon`, `category`, `version`, `author`, `color`) moves to `store_apps`.
- Install state (`installed`, `active`, `install_date`) moves to `installed_apps`.

**Migration steps for existing data**:
1. For each row in `apps` where `installed = TRUE`: create a row in `installed_apps` with `store_app_id` pointing to the new `store_apps` row.
2. The `color` field does not exist in `store_apps`; it can be stored in the app's `manifest_json` or dropped.
3. The old string `id` (e.g. `"clock"`) becomes the `slug` in `store_apps`.

#### `app_settings` table → **replaced by `app_data`**

`AppSetting` used a bare `app_id: String` with no FK. The new `AppData` uses `installed_app_id: Integer` FK to `installed_apps.id`. The unique constraint on `(installed_app_id, key)` is new.

**Migration**: existing settings rows need their `app_id` resolved to the new `installed_apps.id`.

#### `activity_log` table → **updated FK**

Old `ActivityLog.app_id` was a String with no FK. New `ActivityLog.installed_app_id` is a nullable Integer FK to `installed_apps.id`. The `action` column gains an index.

**Migration**: set `installed_app_id` by joining old `app_id` string through the new `installed_apps → store_apps.slug` chain. Rows that cannot be matched get `NULL`.

#### `notes` table — **no changes**

The `Note` model is identical to the existing implementation. No migration needed.

#### New tables (no migration needed, created fresh)

- `users`
- `categories`
- `hardware_tags`
- `store_app_hardware`
- `store_apps`
- `app_ratings`
- `device_settings`
- `registered_sensors`

### Alembic migration script structure

```
migrations/
  versions/
    001_initial_schema.py       ← creates all new tables
    002_migrate_apps_data.py    ← data migration from old apps/app_settings/activity_log
    003_drop_legacy_tables.py   ← drops apps, app_settings after data verified
```

---

## 10. Query Patterns

The schema is optimized for the following read patterns:

### Store listing with filters (most common query)

```sql
SELECT sa.*, c.name AS category_name, u.username AS developer_name
FROM store_apps sa
JOIN users u ON u.id = sa.developer_id
LEFT JOIN categories c ON c.id = sa.category_id
WHERE sa.status = 'published'
  AND (sa.category_id = :cat OR :cat IS NULL)
  AND (sa.name LIKE :q OR sa.description LIKE :q OR :q IS NULL)
ORDER BY sa.downloads_count DESC
LIMIT 20 OFFSET :offset;
```
Uses: `ix_store_apps_status`, `ix_store_apps_category_id`, `ix_store_apps_downloads_count`

### Filter by hardware requirement

```sql
SELECT DISTINCT sa.*
FROM store_apps sa
JOIN store_app_hardware sah ON sah.store_app_id = sa.id
JOIN hardware_tags ht ON ht.id = sah.hardware_tag_id
WHERE ht.slug = :hw_slug
  AND sa.status = 'published';
```
Uses: `ix_hardware_tags_slug`, composite PK on `store_app_hardware`

### Check if app is installed (device-side)

```sql
SELECT ia.* FROM installed_apps ia
WHERE ia.store_app_id = :store_app_id;
```
Uses: `ix_installed_apps_store_app_id` (unique, so this is an O(1) lookup)

### SDK data read for a running app

```sql
SELECT value FROM app_data
WHERE installed_app_id = :installed_app_id AND key = :key;
```
Uses: `uq_app_data_app_key` unique index (effectively a two-column lookup index)

### SDK hardware discovery

```sql
SELECT * FROM registered_sensors
WHERE type = :sensor_type AND is_active = 1;
```
Uses: `ix_registered_sensors_type`, `ix_registered_sensors_is_active`

### Developer dashboard ("my apps")

```sql
SELECT sa.*, COUNT(ar.id) AS total_ratings
FROM store_apps sa
LEFT JOIN app_ratings ar ON ar.store_app_id = sa.id
WHERE sa.developer_id = :user_id
GROUP BY sa.id
ORDER BY sa.created_at DESC;
```
Uses: `ix_store_apps_developer_id`, `ix_app_ratings_store_app_id`

### Admin moderation queue

```sql
SELECT sa.*, u.username AS developer_name
FROM store_apps sa
JOIN users u ON u.id = sa.developer_id
WHERE sa.status = 'pending'
ORDER BY sa.created_at ASC;
```
Uses: `ix_store_apps_status`

### Recent activity log (device debug view)

```sql
SELECT al.*, sa.name AS app_name
FROM activity_log al
LEFT JOIN installed_apps ia ON ia.id = al.installed_app_id
LEFT JOIN store_apps sa ON sa.id = ia.store_app_id
ORDER BY al.timestamp DESC
LIMIT 100;
```
Uses: `ix_activity_log_timestamp`

---

## 11. Full models.py

Below is the complete `backend/models.py` ready to drop in. It includes all models in dependency order (no forward references needed if defined in this order).

```python
"""
ModevI Database Models — v2.0
SQLAlchemy 2.0 declarative style, targeting SQLite via backend/database.py
"""
from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, Float,
    ForeignKey, Integer, JSON, String, Table, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
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
# 1. User & Auth
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'developer', 'admin')",
            name="ck_users_role",
        ),
    )

    id              = Column(Integer, primary_key=True, autoincrement=True)
    username        = Column(String(50), nullable=False, unique=True, index=True)
    email           = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(20), nullable=False, default="user")
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime, nullable=False, server_default=func.now())
    updated_at      = Column(DateTime, nullable=False, server_default=func.now(),
                             onupdate=func.now())
    avatar_path     = Column(String(500), nullable=True)
    bio             = Column(Text, nullable=True)

    store_apps = relationship("StoreApp", back_populates="developer",
                              foreign_keys="StoreApp.developer_id")
    ratings    = relationship("AppRating", back_populates="user")


# ---------------------------------------------------------------------------
# 2. Platform — Community Store
# ---------------------------------------------------------------------------
class Category(Base):
    __tablename__ = "categories"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    icon        = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    sort_order  = Column(Integer, nullable=False, default=0)

    store_apps = relationship("StoreApp", back_populates="category")


class HardwareTag(Base):
    __tablename__ = "hardware_tags"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False, unique=True)
    slug        = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    interface   = Column(String(20), nullable=True)

    store_apps = relationship(
        "StoreApp",
        secondary="store_app_hardware",
        back_populates="hardware_tags",
    )


class StoreApp(Base):
    __tablename__ = "store_apps"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'published', 'rejected')",
            name="ck_store_apps_status",
        ),
    )

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    developer_id       = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    category_id        = Column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name               = Column(String(200), nullable=False)
    slug               = Column(String(200), nullable=False, unique=True, index=True)
    description        = Column(String(500), nullable=False)
    long_description   = Column(Text, nullable=True)
    icon_path          = Column(String(500), nullable=True)
    package_path       = Column(String(500), nullable=True)
    version            = Column(String(50), nullable=False, default="1.0.0")
    status             = Column(String(20), nullable=False, default="pending")
    rejection_reason   = Column(Text, nullable=True)
    downloads_count    = Column(Integer, nullable=False, default=0, index=True)
    avg_rating         = Column(Float, nullable=True, index=True)
    ratings_count      = Column(Integer, nullable=False, default=0)
    required_hardware  = Column(JSON, nullable=True)
    permissions        = Column(JSON, nullable=True)
    manifest_json      = Column(JSON, nullable=True)
    min_modevi_version = Column(String(20), nullable=True)
    created_at         = Column(DateTime, nullable=False, server_default=func.now())
    updated_at         = Column(DateTime, nullable=False, server_default=func.now(),
                                onupdate=func.now())

    developer     = relationship("User", back_populates="store_apps",
                                 foreign_keys=[developer_id])
    category      = relationship("Category", back_populates="store_apps")
    ratings       = relationship("AppRating", back_populates="store_app",
                                 cascade="all, delete-orphan")
    hardware_tags = relationship("HardwareTag", secondary="store_app_hardware",
                                 back_populates="store_apps")
    installed     = relationship("InstalledApp", back_populates="store_app",
                                 cascade="all, delete-orphan")


class AppRating(Base):
    __tablename__ = "app_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "store_app_id", name="uq_app_ratings_user_app"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_app_ratings_rating"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    store_app_id = Column(
        Integer, ForeignKey("store_apps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating       = Column(Integer, nullable=False)
    comment      = Column(Text, nullable=True)
    created_at   = Column(DateTime, nullable=False, server_default=func.now())
    updated_at   = Column(DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())

    user      = relationship("User", back_populates="ratings")
    store_app = relationship("StoreApp", back_populates="ratings")


# ---------------------------------------------------------------------------
# 3. Device — Local
# ---------------------------------------------------------------------------
class InstalledApp(Base):
    __tablename__ = "installed_apps"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    store_app_id      = Column(
        Integer, ForeignKey("store_apps.id", ondelete="RESTRICT"),
        nullable=False, unique=True, index=True,
    )
    install_date      = Column(DateTime, nullable=False, server_default=func.now())
    is_active         = Column(Boolean, nullable=False, default=False, index=True)
    last_launched     = Column(DateTime, nullable=True)
    launch_count      = Column(Integer, nullable=False, default=0)
    installed_version = Column(String(50), nullable=False)
    local_path        = Column(String(500), nullable=True)

    store_app = relationship("StoreApp", back_populates="installed")
    app_data  = relationship("AppData", back_populates="installed_app",
                             cascade="all, delete-orphan")
    activity  = relationship("ActivityLog", back_populates="installed_app",
                             cascade="all, delete-orphan")


class AppData(Base):
    __tablename__ = "app_data"
    __table_args__ = (
        UniqueConstraint("installed_app_id", "key", name="uq_app_data_app_key"),
    )

    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(
        Integer, ForeignKey("installed_apps.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    key        = Column(String(255), nullable=False)
    value      = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    installed_app = relationship("InstalledApp", back_populates="app_data")


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    installed_app_id = Column(
        Integer, ForeignKey("installed_apps.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    action    = Column(String(100), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    details   = Column(Text, nullable=True)

    installed_app = relationship("InstalledApp", back_populates="activity")


class Note(Base):
    __tablename__ = "notes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    title      = Column(String, nullable=False)
    content    = Column(Text, default="")
    color      = Column(String, default="#fef08a")
    pinned     = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DeviceSetting(Base):
    __tablename__ = "device_settings"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    key         = Column(String(255), nullable=False, unique=True, index=True)
    value       = Column(Text, nullable=True)
    description = Column(String(500), nullable=True)
    updated_at  = Column(DateTime, nullable=False, server_default=func.now(),
                         onupdate=func.now())


# ---------------------------------------------------------------------------
# 4. Hardware Registry
# ---------------------------------------------------------------------------
class RegisteredSensor(Base):
    __tablename__ = "registered_sensors"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String(200), nullable=False)
    type           = Column(String(100), nullable=False, index=True)
    interface      = Column(String(20), nullable=False, index=True)
    pin_or_address = Column(String(50), nullable=True)
    config_json    = Column(JSON, nullable=True)
    is_active      = Column(Boolean, nullable=False, default=True, index=True)
    hardware_tag_id = Column(
        Integer, ForeignKey("hardware_tags.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    hardware_tag = relationship("HardwareTag")
```
