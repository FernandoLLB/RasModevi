from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import App, ActivityLog
import psutil
import platform
import os

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/info")
def system_info():
    temps = psutil.sensors_temperatures()
    cpu_temp = None
    if temps:
        for name, entries in temps.items():
            if entries:
                cpu_temp = entries[0].current
                break

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "hostname": platform.node(),
        "platform": platform.machine(),
        "os": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "cpu_percent": psutil.cpu_percent(interval=0.5),
        "cpu_count": psutil.cpu_count(),
        "cpu_freq": psutil.cpu_freq().current if psutil.cpu_freq() else None,
        "memory_total": mem.total,
        "memory_used": mem.used,
        "memory_percent": mem.percent,
        "disk_total": disk.total,
        "disk_used": disk.used,
        "disk_percent": disk.percent,
        "cpu_temp": cpu_temp,
        "uptime": int(psutil.boot_time()),
    }


@router.get("/stats")
def app_stats(db: Session = Depends(get_db)):
    total_apps = db.query(App).count()
    installed_apps = db.query(App).filter(App.installed == True).count()
    active_app = db.query(App).filter(App.active == True).first()
    recent_activity = (
        db.query(ActivityLog)
        .order_by(ActivityLog.timestamp.desc())
        .limit(10)
        .all()
    )

    return {
        "total_apps": total_apps,
        "installed_apps": installed_apps,
        "active_app": active_app.name if active_app else None,
        "recent_activity": [
            {
                "app_id": a.app_id,
                "action": a.action,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            }
            for a in recent_activity
        ],
    }
