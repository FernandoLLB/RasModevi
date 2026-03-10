"""SDK router — endpoints called by ModevI.js inside app iframes."""
from __future__ import annotations

import platform
import time
from datetime import datetime
from typing import List, Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from models import AppData, InstalledApp, RegisteredSensor
from modevi_sdk import MODEVI_SDK_JS
from schemas import AppDataOut, AppDataSet, GPIOReadOut, GPIOWriteIn, SensorOut, SystemInfo

# GPIO availability
try:
    from gpiozero import LED, Button  # type: ignore

    GPIOZERO_AVAILABLE = True
except Exception:
    GPIOZERO_AVAILABLE = False

router = APIRouter(prefix="/api/sdk", tags=["sdk"])


# ---------------------------------------------------------------------------
# SDK JS endpoint
# ---------------------------------------------------------------------------


@router.get("/app/{installed_app_id}/sdk.js", response_class=Response)
async def serve_sdk(installed_app_id: int):
    js = MODEVI_SDK_JS.replace("{{INSTALLED_APP_ID}}", str(installed_app_id))
    return Response(content=js, media_type="application/javascript")


# ---------------------------------------------------------------------------
# System info
# ---------------------------------------------------------------------------


@router.get("/system/info", response_model=SystemInfo)
async def sdk_system_info():
    temps = psutil.sensors_temperatures() if hasattr(psutil, "sensors_temperatures") else {}
    cpu_temp: Optional[float] = None
    if temps:
        for _, entries in temps.items():
            if entries:
                cpu_temp = entries[0].current
                break

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    boot_time = psutil.boot_time()
    uptime = int(time.time() - boot_time)

    return SystemInfo(
        hostname=platform.node(),
        platform=platform.machine(),
        cpu_percent=psutil.cpu_percent(interval=0.2),
        cpu_count=psutil.cpu_count() or 0,
        ram_percent=mem.percent,
        ram_total=mem.total,
        ram_used=mem.used,
        disk_percent=disk.percent,
        disk_total=disk.total,
        disk_used=disk.used,
        temperature=cpu_temp,
        uptime_seconds=uptime,
    )


# ---------------------------------------------------------------------------
# App data (key-value store)
# ---------------------------------------------------------------------------


def _get_installed(installed_app_id: int, db: Session) -> InstalledApp:
    app = db.query(InstalledApp).filter(InstalledApp.id == installed_app_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Installed app not found", "code": "NOT_FOUND"},
        )
    return app


@router.get("/app/{installed_app_id}/data", response_model=List[AppDataOut])
async def get_app_data(installed_app_id: int, db: Session = Depends(get_db)):
    _get_installed(installed_app_id, db)
    return (
        db.query(AppData)
        .filter(AppData.installed_app_id == installed_app_id)
        .all()
    )


@router.get("/app/{installed_app_id}/data/{key}", response_model=AppDataOut)
async def get_app_data_key(
    installed_app_id: int, key: str, db: Session = Depends(get_db)
):
    _get_installed(installed_app_id, db)
    entry = (
        db.query(AppData)
        .filter(AppData.installed_app_id == installed_app_id, AppData.key == key)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Key not found", "code": "KEY_NOT_FOUND"},
        )
    return entry


@router.put("/app/{installed_app_id}/data/{key}", response_model=AppDataOut)
async def set_app_data_key(
    installed_app_id: int,
    key: str,
    body: AppDataSet,
    db: Session = Depends(get_db),
):
    _get_installed(installed_app_id, db)
    entry = (
        db.query(AppData)
        .filter(AppData.installed_app_id == installed_app_id, AppData.key == key)
        .first()
    )
    if entry:
        entry.value = body.value
        entry.updated_at = datetime.utcnow()
    else:
        entry = AppData(
            installed_app_id=installed_app_id,
            key=key,
            value=body.value,
            updated_at=datetime.utcnow(),
        )
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/app/{installed_app_id}/data/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app_data_key(
    installed_app_id: int, key: str, db: Session = Depends(get_db)
):
    _get_installed(installed_app_id, db)
    entry = (
        db.query(AppData)
        .filter(AppData.installed_app_id == installed_app_id, AppData.key == key)
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Key not found", "code": "KEY_NOT_FOUND"},
        )
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Hardware / sensors
# ---------------------------------------------------------------------------


@router.get("/hardware/sensors", response_model=List[SensorOut])
async def sdk_list_sensors(db: Session = Depends(get_db)):
    return db.query(RegisteredSensor).filter(RegisteredSensor.is_active == True).all()


@router.get("/hardware/gpio/{pin}", response_model=GPIOReadOut)
async def sdk_gpio_read(pin: int):
    if not GPIOZERO_AVAILABLE:
        # Return mock value on non-Pi
        return GPIOReadOut(pin=pin, value=0)
    try:
        btn = Button(pin)
        value = 1 if btn.is_pressed else 0
        return GPIOReadOut(pin=pin, value=value)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": str(exc), "code": "GPIO_ERROR"},
        )


@router.post("/hardware/gpio/{pin}")
async def sdk_gpio_write(pin: int, body: GPIOWriteIn):
    if not GPIOZERO_AVAILABLE:
        return {"success": True, "mock": True}
    try:
        led = LED(pin)
        if body.value:
            led.on()
        else:
            led.off()
        return {"success": True}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": str(exc), "code": "GPIO_ERROR"},
        )
