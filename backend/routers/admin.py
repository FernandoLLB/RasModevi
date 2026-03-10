"""Admin router — review and moderate store app submissions."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from auth import require_admin
from database import get_platform_db
from models_platform import StoreApp, User
from schemas import RejectAppBody, StoreAppOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/apps", response_model=List[StoreAppOut])
async def list_all_apps(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_platform_db),
):
    return (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .order_by(StoreApp.created_at.desc())
        .all()
    )


@router.post("/apps/{app_id}/approve", response_model=StoreAppOut)
async def approve_app(
    app_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_platform_db),
):
    app = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.id == app_id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )
    app.status = "published"
    app.rejection_reason = None
    db.commit()
    db.refresh(app)
    return app


@router.post("/apps/{app_id}/reject", response_model=StoreAppOut)
async def reject_app(
    app_id: int,
    body: RejectAppBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_platform_db),
):
    app = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.id == app_id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )
    app.status = "rejected"
    app.rejection_reason = body.reason
    db.commit()
    db.refresh(app)
    return app
