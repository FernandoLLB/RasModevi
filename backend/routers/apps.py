from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import App, ActivityLog, AppSetting
from datetime import datetime

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.get("/")
def list_apps(db: Session = Depends(get_db)):
    apps = db.query(App).all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "icon": a.icon,
            "category": a.category,
            "version": a.version,
            "author": a.author,
            "installed": a.installed,
            "active": a.active,
            "install_date": a.install_date.isoformat() if a.install_date else None,
            "color": a.color,
        }
        for a in apps
    ]


@router.get("/{app_id}")
def get_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(404, "App not found")
    return {
        "id": app.id,
        "name": app.name,
        "description": app.description,
        "icon": app.icon,
        "category": app.category,
        "version": app.version,
        "author": app.author,
        "installed": app.installed,
        "active": app.active,
        "install_date": app.install_date.isoformat() if app.install_date else None,
        "color": app.color,
    }


@router.post("/{app_id}/install")
def install_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(404, "App not found")
    app.installed = True
    app.install_date = datetime.now()
    db.add(ActivityLog(app_id=app_id, action="installed"))
    db.commit()
    return {"status": "installed", "app_id": app_id}


@router.post("/{app_id}/uninstall")
def uninstall_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(404, "App not found")
    app.installed = False
    app.active = False
    app.install_date = None
    db.add(ActivityLog(app_id=app_id, action="uninstalled"))
    db.commit()
    return {"status": "uninstalled", "app_id": app_id}


@router.post("/{app_id}/activate")
def activate_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(404, "App not found")
    if not app.installed:
        raise HTTPException(400, "App not installed")
    # Deactivate all others
    db.query(App).filter(App.active == True).update({"active": False})
    app.active = True
    db.add(ActivityLog(app_id=app_id, action="activated"))
    db.commit()
    return {"status": "activated", "app_id": app_id}


@router.post("/{app_id}/deactivate")
def deactivate_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(404, "App not found")
    app.active = False
    db.add(ActivityLog(app_id=app_id, action="deactivated"))
    db.commit()
    return {"status": "deactivated", "app_id": app_id}


@router.get("/{app_id}/settings")
def get_app_settings(app_id: str, db: Session = Depends(get_db)):
    settings = db.query(AppSetting).filter(AppSetting.app_id == app_id).all()
    return {s.key: s.value for s in settings}


@router.put("/{app_id}/settings/{key}")
def set_app_setting(app_id: str, key: str, value: str, db: Session = Depends(get_db)):
    setting = (
        db.query(AppSetting)
        .filter(AppSetting.app_id == app_id, AppSetting.key == key)
        .first()
    )
    if setting:
        setting.value = value
    else:
        db.add(AppSetting(app_id=app_id, key=key, value=value))
    db.commit()
    return {"status": "ok"}
