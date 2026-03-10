"""Community store router — browse apps, categories, hardware tags, ratings."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import AppRating, Category, HardwareTag, StoreApp, User
from schemas import (
    AppRatingCreate,
    AppRatingOut,
    CategoryOut,
    HardwareTagOut,
    StoreAppDetail,
    StoreAppOut,
)

router = APIRouter(prefix="/api/store", tags=["store"])


# ---------------------------------------------------------------------------
# Categories & hardware tags
# ---------------------------------------------------------------------------


@router.get("/categories", response_model=List[CategoryOut])
async def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.get("/hardware-tags", response_model=List[HardwareTagOut])
async def list_hardware_tags(db: Session = Depends(get_db)):
    return db.query(HardwareTag).order_by(HardwareTag.name).all()


# ---------------------------------------------------------------------------
# Apps listing
# ---------------------------------------------------------------------------


@router.get("/apps", response_model=List[StoreAppOut])
async def list_apps(
    category_slug: Optional[str] = Query(None),
    hardware_slug: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("downloads", pattern="^(downloads|rating|newest)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = (
        db.query(StoreApp)
        .options(joinedload(StoreApp.developer))
        .filter(StoreApp.status == "published")
    )

    if category_slug:
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            q = q.filter(StoreApp.category_id == cat.id)
        else:
            return []

    if hardware_slug:
        ht = db.query(HardwareTag).filter(HardwareTag.slug == hardware_slug).first()
        if ht:
            q = q.filter(StoreApp.hardware_tags.any(HardwareTag.id == ht.id))
        else:
            return []

    if search:
        term = f"%{search}%"
        q = q.filter(
            StoreApp.name.ilike(term) | StoreApp.description.ilike(term)
        )

    if sort == "downloads":
        q = q.order_by(StoreApp.downloads_count.desc())
    elif sort == "rating":
        q = q.order_by(StoreApp.avg_rating.desc())
    else:
        q = q.order_by(StoreApp.created_at.desc())

    offset = (page - 1) * limit
    return q.offset(offset).limit(limit).all()


@router.get("/apps/{slug}", response_model=StoreAppDetail)
async def get_app(slug: str, db: Session = Depends(get_db)):
    app = (
        db.query(StoreApp)
        .options(
            joinedload(StoreApp.developer),
            joinedload(StoreApp.hardware_tags),
        )
        .filter(StoreApp.slug == slug, StoreApp.status == "published")
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )
    return app


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------


@router.get("/apps/{slug}/ratings", response_model=List[AppRatingOut])
async def list_ratings(slug: str, db: Session = Depends(get_db)):
    app = db.query(StoreApp).filter(StoreApp.slug == slug).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )
    return (
        db.query(AppRating)
        .options(joinedload(AppRating.user))
        .filter(AppRating.store_app_id == app.id)
        .order_by(AppRating.created_at.desc())
        .all()
    )


@router.post("/apps/{slug}/rate", response_model=AppRatingOut, status_code=status.HTTP_201_CREATED)
async def rate_app(
    slug: str,
    body: AppRatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = (
        db.query(StoreApp)
        .filter(StoreApp.slug == slug, StoreApp.status == "published")
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )

    existing = (
        db.query(AppRating)
        .filter(AppRating.user_id == current_user.id, AppRating.store_app_id == app.id)
        .first()
    )
    if existing:
        existing.rating = body.rating
        existing.comment = body.comment
        db.commit()
        db.refresh(existing)
        _recalc_rating(db, app)
        return existing

    rating = AppRating(
        user_id=current_user.id,
        store_app_id=app.id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(rating)
    db.flush()
    _recalc_rating(db, app)
    db.commit()
    db.refresh(rating)
    return rating


@router.delete("/apps/{slug}/rate", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rating(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(StoreApp).filter(StoreApp.slug == slug).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "App not found", "code": "APP_NOT_FOUND"},
        )
    rating = (
        db.query(AppRating)
        .filter(AppRating.user_id == current_user.id, AppRating.store_app_id == app.id)
        .first()
    )
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Rating not found", "code": "RATING_NOT_FOUND"},
        )
    db.delete(rating)
    db.flush()
    _recalc_rating(db, app)
    db.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _recalc_rating(db: Session, app: StoreApp) -> None:
    """Recalculate avg_rating and ratings_count for an app."""
    result = (
        db.query(func.avg(AppRating.rating), func.count(AppRating.id))
        .filter(AppRating.store_app_id == app.id)
        .first()
    )
    app.avg_rating = float(result[0]) if result[0] else 0.0
    app.ratings_count = result[1] or 0
