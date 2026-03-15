"""Device router — install/uninstall/activate apps on the device."""
from __future__ import annotations

import json
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

from auth import get_current_user
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


def _read_manifest(inst: InstalledApp) -> tuple[str | None, str | None]:
    """Read name and icon_path from manifest.json of an installed app."""
    try:
        install_path = Path(inst.install_path) if inst.install_path else INSTALLED_DIR / str(inst.id)
        manifest_file = install_path / "manifest.json"
        if manifest_file.exists():
            data = json.loads(manifest_file.read_text(encoding="utf-8"))
            return data.get("name"), data.get("icon_path") or data.get("icon_url")
    except Exception:
        pass
    return None, None


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
        if sa:
            store_app_out = StoreAppOut.model_validate(sa)
            # Proactively cache name+icon so they survive a future store deletion
            if not inst.local_name:
                inst.local_name = sa.name
                inst.local_icon_url = sa.icon_path
                try:
                    from sqlalchemy.orm import object_session
                    sess = object_session(inst)
                    if sess:
                        sess.commit()
                except Exception:
                    pass
        elif inst.local_name:  # local app or store app deleted — use cached metadata
            # Locally-created app (no store entry) — build a synthetic representation
            store_app_out = StoreAppOut(
                id=0,
                name=inst.local_name,
                slug=f"local-{inst.id}",
                description=inst.local_description or "",
                icon_path=inst.local_icon_url,
                version="1.0.0",
                avg_rating=0.0,
                ratings_count=0,
                downloads_count=0,
                status="local",
                required_hardware=[],
                permissions=[],
                category_id=None,
                developer_id=0,
                created_at=inst.install_date,
                developer=None,
            )
        else:
            # Last resort: read name from manifest.json of the installed files
            name, icon = _read_manifest(inst)
            if name:
                store_app_out = StoreAppOut(
                    id=0, name=name, slug=f"local-{inst.id}",
                    description="", icon_path=icon, version="1.0.0",
                    avg_rating=0.0, ratings_count=0, downloads_count=0,
                    status="local", required_hardware=[], permissions=[],
                    category_id=None, developer_id=0,
                    created_at=inst.install_date, developer=None,
                )
                # Cache in DB so next call is instant
                inst.local_name = name
                inst.local_icon_url = icon
                try:
                    from sqlalchemy.orm import object_session
                    sess = object_session(inst)
                    if sess:
                        sess.commit()
                except Exception:
                    pass
            else:
                store_app_out = None
        result.append(
            InstalledAppOut(
                id=inst.id,
                store_app_id=inst.store_app_id,
                install_date=inst.install_date,
                is_active=inst.is_active,
                last_launched=inst.last_launched,
                launch_count=inst.launch_count,
                install_path=inst.install_path,
                store_app=store_app_out,
            )
        )
    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/apps", response_model=List[InstalledAppOut])
async def list_installed_apps(
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    installed = (
        device_db.query(InstalledApp)
        .filter(InstalledApp.user_id == current_user.id)
        .order_by(InstalledApp.install_date.desc())
        .all()
    )
    return _enrich(installed, platform_db)


@router.get("/apps/active", response_model=Optional[InstalledAppOut])
async def get_active_app(
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    inst = (
        device_db.query(InstalledApp)
        .filter(InstalledApp.is_active == True, InstalledApp.user_id == current_user.id)
        .first()
    )
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
    current_user: User = Depends(get_current_user),
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
        InstalledApp.store_app_id == store_app_id,
        InstalledApp.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "App is already installed", "code": "ALREADY_INSTALLED"},
        )

    # --- Download ZIP BEFORE touching the device DB (avoids SQLite lock) ---
    zip_path = PACKAGES_DIR / str(store_app_id) / "app.zip"

    if not zip_path.exists() and STORE_API_URL:
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                r = await client.get(f"{STORE_API_URL}/api/store/apps/{store_app_id}/package")
                if r.status_code == 200:
                    zip_path.parent.mkdir(parents=True, exist_ok=True)
                    zip_path.write_bytes(r.content)
        except httpx.HTTPError:
            pass  # fall through to demo/empty path

    # --- Now perform all DB writes in a tight block ---
    try:
        installed = InstalledApp(
            store_app_id=store_app_id,
            user_id=current_user.id,
            is_active=False,
            local_name=store_app.name,
            local_icon_url=store_app.icon_path,
        )
        device_db.add(installed)
        device_db.flush()

        install_path = INSTALLED_DIR / str(installed.id)

        if zip_path.exists():
            install_path.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zip_path) as zf:
                # Validate: reject ZIPs with path traversal entries (zip slip)
                resolved_dest = install_path.resolve()
                for member in zf.namelist():
                    member_path = (install_path / member).resolve()
                    if not str(member_path).startswith(str(resolved_dest)):
                        raise HTTPException(
                            status_code=400,
                            detail={"detail": f"Zip contains path traversal: {member}", "code": "ZIP_SLIP"},
                        )
                zf.extractall(install_path)
            installed.install_path = str(install_path)
            # Fix SDK script src: replace placeholder id=0 with the real installed id
            index_html = install_path / "index.html"
            if index_html.exists():
                html = index_html.read_text(encoding="utf-8")
                sdk_tag = f'<script src="/api/sdk/app/{installed.id}/sdk.js"></script>'
                if '/api/sdk/app/0/sdk.js' in html:
                    html = html.replace(
                        '<script src="/api/sdk/app/0/sdk.js"></script>', sdk_tag, 1
                    )
                elif sdk_tag not in html:
                    inject_before = "</head>" if "</head>" in html else "</body>"
                    html = html.replace(inject_before, f"  {sdk_tag}\n{inject_before}", 1)
                index_html.write_text(html, encoding="utf-8")
        else:
            demo_path = BACKEND_DIR / "apps" / (store_app.slug or "")
            if demo_path.exists():
                installed.install_path = f"apps/{store_app.slug}"
            else:
                installed.install_path = str(install_path)

        device_db.add(ActivityLog(
            installed_app_id=installed.id,
            action="install",
            details=f"Installed '{store_app.name}' v{store_app.version}",
        ))
        device_db.commit()
    except Exception:
        device_db.rollback()
        # Clean up extracted files if DB failed
        install_path = INSTALLED_DIR / str(store_app_id)
        if install_path.exists():
            shutil.rmtree(install_path, ignore_errors=True)
        raise

    # Increment downloads on the platform DB (separate, non-critical)
    try:
        store_app.downloads_count = (store_app.downloads_count or 0) + 1
        platform_db.commit()
    except Exception:
        platform_db.rollback()

    device_db.refresh(installed)
    return _enrich([installed], platform_db)[0]


@router.post("/apps/{installed_id}/uninstall", status_code=status.HTTP_204_NO_CONTENT)
async def uninstall_app(
    installed_id: int,
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(
        InstalledApp.id == installed_id, InstalledApp.user_id == current_user.id
    ).first()
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
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
    platform_db: Session = Depends(get_platform_db),
):
    installed = device_db.query(InstalledApp).filter(
        InstalledApp.id == installed_id, InstalledApp.user_id == current_user.id
    ).first()
    if not installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )

    # Only deactivate this user's apps
    device_db.query(InstalledApp).filter(
        InstalledApp.id != installed_id, InstalledApp.user_id == current_user.id
    ).update({"is_active": False})
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
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(
        InstalledApp.id == installed_id, InstalledApp.user_id == current_user.id
    ).first()
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
    current_user: User = Depends(get_current_user),
    device_db: Session = Depends(get_device_db),
):
    installed = device_db.query(InstalledApp).filter(
        InstalledApp.id == installed_id, InstalledApp.user_id == current_user.id
    ).first()
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
