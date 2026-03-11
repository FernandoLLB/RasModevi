"""ModevI Store FastAPI application — Railway cloud deployment.

Includes: auth, store, developer, admin, ai
Excludes: device, sdk, hardware, notes, system (device-only, stay on Pi)
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db, platform_engine as get_platform_engine
from seed import seed
from routers import auth, store, developer, admin, ai

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend" / "dist"
STORE_DIR = BACKEND_DIR / "store"
INSTALLED_DIR = BACKEND_DIR / "installed"
APPS_DIR = BACKEND_DIR / "apps"


def _migrate():
    """Add/remove columns to existing tables that create_all won't touch."""
    from sqlalchemy import text
    engine = get_platform_engine
    with engine.connect() as conn:
        # Add package_url (R2 public URL, replaces package_data LONGBLOB)
        try:
            conn.execute(text("ALTER TABLE store_apps ADD COLUMN package_url VARCHAR(1000)"))
            conn.commit()
        except Exception:
            pass  # Column already exists
        # Drop package_data LONGBLOB (data migrated to R2)
        try:
            conn.execute(text("ALTER TABLE store_apps DROP COLUMN package_data"))
            conn.commit()
        except Exception:
            pass  # Column already gone


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _migrate()
    seed()
    (STORE_DIR / "packages").mkdir(parents=True, exist_ok=True)
    (STORE_DIR / "icons").mkdir(parents=True, exist_ok=True)
    INSTALLED_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="ModevI Store API",
    version="1.0.0",
    description="ModevI community store — cloud deployment",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(store.router)
app.include_router(developer.router)
app.include_router(admin.router)
app.include_router(ai.router)

# Store assets (icons, packages metadata)
if STORE_DIR.exists():
    app.mount("/store", StaticFiles(directory=str(STORE_DIR)), name="store")

# Demo apps assets (icons referenced in seed.py as /apps/{slug}/icon.svg)
if APPS_DIR.exists():
    app.mount("/apps", StaticFiles(directory=str(APPS_DIR), html=True), name="apps")

# Frontend SPA — must be last
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
