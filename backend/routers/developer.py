"""Developer router — manage own store app listings and packages."""
from __future__ import annotations

import io
import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from auth import require_developer
from database import get_db
from models import StoreApp, User
from schemas import StoreAppCreate, StoreAppDetail, StoreAppOut, StoreAppUpdate

router = APIRouter(prefix="/api/developer", tags=["developer"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
ICONS_DIR = BACKEND_DIR / "store" / "icons"
PACKAGES_DIR = BACKEND_DIR / "store" / "packages"
MAX_ZIP_SIZE = 50 * 1024 * 1024  # 50 MB

MANIFEST_REQUIRED = {"name", "version", "description"}


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


@router.get("/apps", response_model=List[StoreAppOut])
async def list_developer_apps(
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    return (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.developer_id == current_user.id)
        .order_by(StoreApp.created_at.desc())
        .all()
    )


@router.post("/apps", response_model=StoreAppOut, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: StoreAppCreate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    base_slug = _slugify(body.name)
    slug = base_slug
    counter = 1
    while db.query(StoreApp).filter(StoreApp.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    app = StoreApp(
        developer_id=current_user.id,
        category_id=body.category_id,
        name=body.name,
        slug=slug,
        description=body.description,
        long_description=body.long_description,
        version=body.version,
        permissions=body.required_permissions,
        required_hardware=[],
        status="pending",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.post("/apps/{app_id}/upload", response_model=StoreAppDetail)
async def upload_app_package(
    app_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    app = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer), joinedload(StoreApp.hardware_tags))
        .filter(StoreApp.id == app_id, StoreApp.developer_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )

    # Validate file type
    if file.content_type not in ("application/zip", "application/x-zip-compressed") and not (
        file.filename or ""
    ).endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "Only ZIP files are accepted", "code": "INVALID_FILE_TYPE"},
        )

    content = await file.read()
    if len(content) > MAX_ZIP_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "ZIP file exceeds 50 MB limit", "code": "FILE_TOO_LARGE"},
        )

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "File is not a valid ZIP", "code": "INVALID_ZIP"},
        )

    # Validate manifest.json
    names = zf.namelist()
    manifest_path = None
    for n in names:
        if n == "manifest.json" or n.endswith("/manifest.json"):
            manifest_path = n
            break
    if not manifest_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "manifest.json not found in ZIP", "code": "MISSING_MANIFEST"},
        )

    try:
        manifest = json.loads(zf.read(manifest_path).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "manifest.json is not valid JSON", "code": "INVALID_MANIFEST"},
        )

    missing = MANIFEST_REQUIRED - set(manifest.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": f"manifest.json missing required fields: {', '.join(missing)}",
                "code": "MANIFEST_MISSING_FIELDS",
            },
        )

    # Persist package
    pkg_dir = PACKAGES_DIR / str(app_id)
    pkg_dir.mkdir(parents=True, exist_ok=True)
    zip_path = pkg_dir / "app.zip"
    zip_path.write_bytes(content)

    # Extract icon
    icon_url: str | None = None
    icon_name = manifest.get("icon")
    if icon_name and icon_name in names:
        icon_dir = ICONS_DIR / str(app_id)
        icon_dir.mkdir(parents=True, exist_ok=True)
        icon_bytes = zf.read(icon_name)
        dest = icon_dir / Path(icon_name).name
        dest.write_bytes(icon_bytes)
        icon_url = f"store/icons/{app_id}/{Path(icon_name).name}"

    # Update app record
    app.package_path = str(zip_path)
    if icon_url:
        app.icon_path = icon_url
    # Update version from manifest if present
    if "version" in manifest:
        app.version = str(manifest["version"])

    db.commit()
    db.refresh(app)
    return app


@router.put("/apps/{app_id}", response_model=StoreAppOut)
async def update_app(
    app_id: int,
    body: StoreAppUpdate,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    app = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.id == app_id, StoreApp.developer_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(app, field, value)

    db.commit()
    db.refresh(app)
    return app


@router.delete("/apps/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app(
    app_id: int,
    current_user: User = Depends(require_developer),
    db: Session = Depends(get_db),
):
    app = (
        db.query(StoreApp)
        .filter(StoreApp.id == app_id, StoreApp.developer_id == current_user.id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )

    # Clean up files
    pkg_dir = PACKAGES_DIR / str(app_id)
    if pkg_dir.exists():
        shutil.rmtree(pkg_dir)
    icon_dir = ICONS_DIR / str(app_id)
    if icon_dir.exists():
        shutil.rmtree(icon_dir)

    db.delete(app)
    db.commit()
