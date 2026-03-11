"""Device router — install/uninstall/activate apps on the device."""
from __future__ import annotations

import os
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

# If set, ZIPs are downloaded from the store API when not available locally
STORE_API_URL: str = os.getenv("STORE_API_URL", "").rstrip("/")

from database import get_device_db, get_platform_db
from models_device import ActivityLog, AppData, InstalledApp
from models_platform import StoreApp, User
from schemas import InstalledAppOut, StoreAppOut

router = APIRouter(prefix="/api/device", tags=["device"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
PACKAGES_DIR = BACKEND_DIR / "store" / "packages"
INSTALLED_DIR = BACKEND_DIR / "installed"
APP_DATA_DIR = BACKEND_DIR / "app_data"


# ---------------------------------------------------------------------------
# Helper — enrich InstalledApp list with StoreApp data from platform DB
# ---------------------------------------------------------------------------


def _enrich(
    installed_list: list[InstalledApp],
    platform_db: Session,
) -> list[InstalledAppOut]:
    """Merge platform store app data into device installed app records."""
    store_app_ids = [a.store_app_id for a in installed_list if a.store_app_id is not None]
    store_apps: dict[int, StoreApp] = {}
    if store_app_ids:
        rows = (
            platform_db.query(StoreApp)
            .options(joinedload(StoreApp.developer))
            .filter(StoreApp.id.in_(store_app_ids))
            .all()
        )
        store_apps = {r.id: r for r in rows}

    result = []
    for inst in installed_list:
        sa = store_apps.get(inst.store_app_id) if inst.store_app_id else None
        result.append(
            InstalledAppOut(
                id=inst.id,
                store_app_id=inst.store_app_id,
                install_date=inst.install_date,
                is_active=inst.is_active,
                last_launched=inst.last_launched,
                launch_count=inst.launch_count,
                install_path=inst.install_path,
                store_app=StoreAppOut.model_validate(sa) if sa else None,
            )
        )
    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/apps", response_model=List[InstalledAppOut])
async def list_installed_apps(
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    installed = (
        device_db.query(InstalledApp)
        .order_by(InstalledApp.install_date.desc())
        .all()
    )
    return _enrich(installed, platform_db)


@router.get("/apps/active", response_model=Optional[InstalledAppOut])
async def get_active_app(
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    inst = device_db.query(InstalledApp).filter(InstalledApp.is_active == True).first()
    if not inst:
        return None
    return _enrich([inst], platform_db)[0]


@router.post(
    "/apps/{store_app_id}/install",
    response_model=InstalledAppOut,
    status_code=status.HTTP_201_CREATED,
)
async def install_app(
    store_app_id: int,
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    store_app = (
        platform_db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.id == store_app_id, StoreApp.status == "published")
        .first()
    )
    if not store_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Store app not found or not published", "code": "APP_NOT_FOUND"},
        )

    existing = device_db.query(InstalledApp).filter(
        InstalledApp.store_app_id == store_app_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "App is already installed", "code": "ALREADY_INSTALLED"},
        )

    installed = InstalledApp(store_app_id=store_app_id, is_active=False)
    device_db.add(installed)
    device_db.flush()

    zip_path = PACKAGES_DIR / str(store_app_id) / "app.zip"
    install_path = INSTALLED_DIR / str(installed.id)

    # Download ZIP from store API if not available locally
    if not zip_path.exists() and STORE_API_URL:
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                r = await client.get(f"{STORE_API_URL}/api/store/apps/{store_app_id}/package")
                if r.status_code == 200:
                    zip_path.parent.mkdir(parents=True, exist_ok=True)
                    zip_path.write_bytes(r.content)
        except httpx.HTTPError:
            pass  # fall through to demo/empty path

    if zip_path.exists():
        install_path.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(install_path)
        installed.install_path = str(install_path)
        # Inject ModevI SDK into index.html so window.ModevI is available inside the iframe
        index_html = install_path / "index.html"
        if index_html.exists():
            html = index_html.read_text(encoding="utf-8")
            sdk_tag = f'<script src="/api/sdk/app/{installed.id}/sdk.js"></script>'
            if sdk_tag not in html:
                inject_before = "</head>" if "</head>" in html else "</body>"
                html = html.replace(inject_before, f"  {sdk_tag}\n{inject_before}", 1)
                index_html.write_text(html, encoding="utf-8")
    else:
        demo_path = BACKEND_DIR / "apps" / (store_app.slug or "")
        if demo_path.exists():
            installed.install_path = f"apps/{store_app.slug}"
        else:
            installed.install_path = str(install_path)

    # Increment downloads on the platform DB
    store_app.downloads_count = (store_app.downloads_count or 0) + 1
    platform_db.commit()

    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="install",
        details=f"Installed '{store_app.name}' v{store_app.version}",
    ))
    device_db.commit()
    device_db.refresh(installed)
    return _enrich([installed], platform_db)[0]


@router.post("/apps/{installed_id}/uninstall", status_code=status.HTTP_204_NO_CONTENT)
async def uninstall_app(
    installed_id: int,
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )

    # Delete installed files
    if installed.install_path:
        path = Path(installed.install_path)
        if INSTALLED_DIR in path.parents and path.exists():
            shutil.rmtree(path, ignore_errors=True)

    # Delete per-app SQLite database
    app_db_path = APP_DATA_DIR / f"app_{installed_id}.db"
    if app_db_path.exists():
        app_db_path.unlink()

    # Delete KV store entries (fix: previously these were left orphaned)
    device_db.query(AppData).filter(AppData.installed_app_id == installed_id).delete()

    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="uninstall",
        details=f"Uninstalled app id={installed_id}",
    ))
    device_db.delete(installed)
    device_db.commit()


@router.post("/apps/{installed_id}/activate", response_model=InstalledAppOut)
async def activate_app(
    installed_id: int,
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    installed = device_db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )

    device_db.query(InstalledApp).filter(InstalledApp.id != installed_id).update(
        {"is_active": False}
    )
    installed.is_active = True

    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="activate",
        details=f"Activated app id={installed_id}",
    ))
    device_db.commit()
    device_db.refresh(installed)
    return _enrich([installed], platform_db)[0]


@router.post("/apps/{installed_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_app(
    installed_id: int,
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )
    installed.is_active = False
    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="deactivate",
        details=f"Deactivated app id={installed_id}",
    ))
    device_db.commit()


@router.post("/apps/{installed_id}/launch", status_code=status.HTTP_204_NO_CONTENT)
async def launch_app(
    installed_id: int,
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )
    installed.launch_count = (installed.launch_count or 0) + 1
    installed.last_launched = datetime.utcnow()
    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="launch",
        details=f"Launched app id={installed_id}",
    ))
    device_db.commit()
