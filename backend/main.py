"""ModevI FastAPI application entry point."""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

# Load .env before anything else touches os.getenv
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db, device_engine
from seed import seed
from routers import auth, store, developer, admin, device, sdk, hardware, notes, system, ai

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend" / "dist"
APPS_DIR = BACKEND_DIR / "apps"
INSTALLED_DIR = BACKEND_DIR / "installed"
STORE_DIR = BACKEND_DIR / "store"


def _migrate_device_db() -> None:
    """Add columns introduced after initial schema creation."""
    from sqlalchemy import text
    with device_engine.connect() as conn:
        for col, definition in [
            ("local_name", "VARCHAR(200)"),
            ("local_description", "TEXT"),
            ("local_icon_url", "VARCHAR(500)"),
            ("user_id", "INTEGER"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE installed_apps ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # column already exists

        # Add user_id to notes table
        try:
            conn.execute(text("ALTER TABLE notes ADD COLUMN user_id INTEGER"))
            conn.commit()
        except Exception:
            pass

        # SQLite can't drop inline UNIQUE constraints — recreate the table
        # if it still has the old UNIQUE(store_app_id) instead of UNIQUE(user_id, store_app_id)
        try:
            old_schema = conn.execute(
                text("SELECT sql FROM sqlite_master WHERE name='installed_apps'")
            ).scalar() or ""
            if "UNIQUE (store_app_id)" in old_schema and "UNIQUE (user_id" not in old_schema:
                conn.execute(text("""
                    CREATE TABLE installed_apps_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        store_app_id INTEGER,
                        install_date DATETIME NOT NULL,
                        is_active BOOLEAN NOT NULL,
                        last_launched DATETIME,
                        launch_count INTEGER NOT NULL,
                        install_path VARCHAR(500),
                        local_name VARCHAR(200),
                        local_description TEXT,
                        local_icon_url VARCHAR(500),
                        user_id INTEGER,
                        UNIQUE (user_id, store_app_id)
                    )
                """))
                conn.execute(text("""
                    INSERT INTO installed_apps_new
                    SELECT id, store_app_id, install_date, is_active, last_launched,
                           launch_count, install_path, local_name, local_description,
                           local_icon_url, user_id
                    FROM installed_apps
                """))
                conn.execute(text("DROP TABLE installed_apps"))
                conn.execute(text("ALTER TABLE installed_apps_new RENAME TO installed_apps"))
                conn.commit()
        except Exception:
            pass

        # Assign existing apps with NULL user_id to the default admin user
        try:
            from database import platform_engine as _pe
            with _pe.connect() as pconn:
                # Prefer username='admin', fall back to first admin by id
                admin_row = pconn.execute(
                    text("SELECT id FROM users WHERE username='admin' AND role='admin' LIMIT 1")
                ).fetchone()
                if not admin_row:
                    admin_row = pconn.execute(
                        text("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")
                    ).fetchone()
                if admin_row:
                    conn.execute(
                        text("UPDATE installed_apps SET user_id = :uid WHERE user_id IS NULL"),
                        {"uid": admin_row[0]},
                    )
                    conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _migrate_device_db()
    seed()
    # Ensure required directories exist
    (STORE_DIR / "packages").mkdir(parents=True, exist_ok=True)
    (STORE_DIR / "icons").mkdir(parents=True, exist_ok=True)
    INSTALLED_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="ModevI API",
    version="1.0.0",
    description="Modular app platform for Raspberry Pi",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def no_cache_installed(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/installed/") or request.url.path.startswith("/apps/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    return response

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(store.router)
app.include_router(developer.router)
app.include_router(admin.router)
app.include_router(device.router)
app.include_router(sdk.router)
app.include_router(hardware.router)
app.include_router(notes.router)
app.include_router(system.router)
app.include_router(ai.router)

# ---------------------------------------------------------------------------
# Static file mounts
# ---------------------------------------------------------------------------

# Legacy demo apps served at /apps/
if APPS_DIR.exists():
    app.mount("/apps", StaticFiles(directory=str(APPS_DIR), html=True), name="apps")

# Installed app files served at /installed/
if INSTALLED_DIR.exists():
    app.mount(
        "/installed",
        StaticFiles(directory=str(INSTALLED_DIR), html=True),
        name="installed",
    )

# Store assets (icons) served at /store/
if STORE_DIR.exists():
    app.mount("/store", StaticFiles(directory=str(STORE_DIR)), name="store")

# Frontend SPA — must be mounted last so API routes take priority
if FRONTEND_DIR.exists():
    _assets_dir = FRONTEND_DIR / "assets"
    if _assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_assets_dir)),
            name="frontend-assets",
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
