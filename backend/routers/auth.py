"""Authentication router — register, login, me, refresh."""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_password,
    verify_token,
)
from database import get_platform_db
from models_platform import User
from schemas import LoginRequest, RefreshRequest, Token, UserCreate, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: Session = Depends(get_platform_db)):
    # Set REGISTRATION_ENABLED=true in .env to allow public self-registration
    if os.getenv("REGISTRATION_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"detail": "Registration is currently disabled", "code": "REGISTRATION_DISABLED"},
        )
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "Username already taken", "code": "USERNAME_TAKEN"},
        )
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "Email already registered", "code": "EMAIL_TAKEN"},
        )
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(body: LoginRequest, db: Session = Depends(get_platform_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Invalid username or password", "code": "INVALID_CREDENTIALS"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"detail": "Account is disabled", "code": "ACCOUNT_DISABLED"},
        )
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh(body: RefreshRequest, db: Session = Depends(get_platform_db)):
    payload = verify_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Invalid refresh token", "code": "INVALID_REFRESH_TOKEN"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Invalid token payload", "code": "INVALID_TOKEN"},
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "User not found or disabled", "code": "USER_NOT_FOUND"},
        )
    access_token = create_access_token({"sub": str(user.id)})
    new_refresh_token = create_refresh_token({"sub": str(user.id)})
    return Token(access_token=access_token, refresh_token=new_refresh_token)
