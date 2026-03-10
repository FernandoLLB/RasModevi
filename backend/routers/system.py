"""System router — device info and recent activity stats."""
from __future__ import annotations

import platform
import time

import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import ActivityLog, InstalledApp

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/info")
async def system_info():
    temps = psutil.sensors_temperatures() if hasattr(psutil, "sensors_temperatures") else {}
    cpu_temp = None
    if temps:
        for _, entries in temps.items():
            if entries:
                cpu_temp = entries[0].current
                break

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    boot_time = psutil.boot_time()
    uptime = int(time.time() - boot_time)

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
        "uptime_seconds": uptime,
    }


@router.get("/stats")
async def app_stats(db: Session = Depends(get_db)):
    total_installed = db.query(InstalledApp).count()
    active_app = db.query(InstalledApp).filter(InstalledApp.is_active == True).first()
    recent_activity = (
        db.query(ActivityLog)
        .order_by(ActivityLog.timestamp.desc())
        .limit(10)
        .all()
    )

    return {
        "total_installed": total_installed,
        "active_app_id": active_app.id if active_app else None,
        "recent_activity": [
            {
                "id": a.id,
                "installed_app_id": a.installed_app_id,
                "action": a.action,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "details": a.details,
            }
            for a in recent_activity
        ],
    }
