"""Device router — install/uninstall/activate apps on the device."""
from __future__ import annotations

import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import ActivityLog, InstalledApp, StoreApp
from schemas import InstalledAppOut

router = APIRouter(prefix="/api/device", tags=["device"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
PACKAGES_DIR = BACKEND_DIR / "store" / "packages"
INSTALLED_DIR = BACKEND_DIR / "installed"


@router.get("/apps", response_model=List[InstalledAppOut])
async def list_installed_apps(db: Session = Depends(get_db)):
    return (
        db.query(InstalledApp)
        .options(
            joinedload(InstalledApp.store_app).joinedload(StoreApp.developer)
        )
        .order_by(InstalledApp.install_date.desc())
        .all()
    )


@router.get("/apps/active", response_model=Optional[InstalledAppOut])
async def get_active_app(db: Session = Depends(get_db)):
    app = (
        db.query(InstalledApp)
        .options(
            joinedload(InstalledApp.store_app).joinedload(StoreApp.developer)
        )
        .filter(InstalledApp.is_active == True)
        .first()
    )
    return app


@router.post(
    "/apps/{store_app_id}/install",
    response_model=InstalledAppOut,
    status_code=status.HTTP_201_CREATED,
)
async def install_app(store_app_id: int, db: Session = Depends(get_db)):
    store_app = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.id == store_app_id, StoreApp.status == "published")
        .first()
    )
    if not store_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Store app not found or not published", "code": "APP_NOT_FOUND"},
        )

    existing = (
        db.query(InstalledApp).filter(InstalledApp.store_app_id == store_app_id).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "App is already installed", "code": "ALREADY_INSTALLED"},
        )

    installed = InstalledApp(
        store_app_id=store_app_id,
        is_active=False,
    )
    db.add(installed)
    db.flush()

    # Try to extract ZIP if package exists
    zip_path = PACKAGES_DIR / str(store_app_id) / "app.zip"
    install_path = INSTALLED_DIR / str(installed.id)
    if zip_path.exists():
        install_path.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(install_path)
        installed.install_path = str(install_path)
    else:
        # For demo apps, point to existing apps directory
        demo_path = BACKEND_DIR / "apps" / (store_app.slug or "")
        if demo_path.exists():
            installed.install_path = str(demo_path)
        else:
            installed.install_path = str(install_path)

    # Increment downloads count
    store_app.downloads_count = (store_app.downloads_count or 0) + 1

    db.add(ActivityLog(
        installed_app_id=installed.id,
        action="install",
        details=f"Installed '{store_app.name}' v{store_app.version}",
    ))
    db.commit()
    db.refresh(installed)
    return installed


@router.post("/apps/{installed_id}/uninstall", status_code=status.HTTP_204_NO_CONTENT)
async def uninstall_app(installed_id: int, db: Session = Depends(get_db)):
    installed = (
        db.query(InstalledApp)
        .options(joinedload(InstalledApp.store_app))
        .filter(InstalledApp.id == installed_id)
        .first()
    )
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )

    # Remove extracted files only if they are in the installed/ directory
    if installed.install_path:
        path = Path(installed.install_path)
        if INSTALLED_DIR in path.parents and path.exists():
            shutil.rmtree(path, ignore_errors=True)

    db.add(ActivityLog(
        installed_app_id=installed.id,
        action="uninstall",
        details=f"Uninstalled app id={installed_id}",
    ))
    db.delete(installed)
    db.commit()


@router.post("/apps/{installed_id}/activate", response_model=InstalledAppOut)
async def activate_app(installed_id: int, db: Session = Depends(get_db)):
    installed = (
        db.query(InstalledApp)
        .options(
            joinedload(InstalledApp.store_app).joinedload(StoreApp.developer)
        )
        .filter(InstalledApp.id == installed_id)
        .first()
    )
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )

    # Deactivate all others
    db.query(InstalledApp).filter(InstalledApp.id != installed_id).update(
        {"is_active": False}
    )
    installed.is_active = True

    db.add(ActivityLog(
        installed_app_id=installed.id,
        action="activate",
        details=f"Activated app id={installed_id}",
    ))
    db.commit()
    db.refresh(installed)
    return installed


@router.post("/apps/{installed_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_app(installed_id: int, db: Session = Depends(get_db)):
    installed = db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )
    installed.is_active = False
    db.add(ActivityLog(
        installed_app_id=installed.id,
        action="deactivate",
        details=f"Deactivated app id={installed_id}",
    ))
    db.commit()


@router.post("/apps/{installed_id}/launch", status_code=status.HTTP_204_NO_CONTENT)
async def launch_app(installed_id: int, db: Session = Depends(get_db)):
    installed = db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )
    installed.launch_count = (installed.launch_count or 0) + 1
    installed.last_launched = datetime.utcnow()
    db.add(ActivityLog(
        installed_app_id=installed.id,
        action="launch",
        details=f"Launched app id={installed_id}",
    ))
    db.commit()
