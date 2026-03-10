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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from seed import seed
from routers import auth, store, developer, admin, device, sdk, hardware, notes, system

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend" / "dist"
APPS_DIR = BACKEND_DIR / "apps"
INSTALLED_DIR = BACKEND_DIR / "installed"
STORE_DIR = BACKEND_DIR / "store"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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
