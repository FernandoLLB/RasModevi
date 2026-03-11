"""SDK router — endpoints called by ModevI.js inside app iframes."""
from __future__ import annotations

import base64
import platform
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

import hw
from database import get_device_db
from models_device import AppData, InstalledApp, RegisteredSensor
from modevi_sdk import MODEVI_SDK_JS
from schemas import (
    AppDataOut, AppDataSet,
    GPIOReadOut, GPIOWriteIn,
    PWMWrite, PWMReadOut,
    I2CReadOut,
    SensorOut, SystemInfo,
)

router = APIRouter(prefix="/api/sdk", tags=["sdk"])

LIBS_DIR = Path(__file__).resolve().parent.parent / "libs"

_LIBS_META = {
    "chart.js":  "Chart.js 4.4 — gráficas (line, bar, pie, radar, doughnut...)",
    "three.js":  "Three.js r160 — gráficos 3D con WebGL",
    "alpine.js": "Alpine.js 3.13 — reactividad declarativa ligera (x-data, x-bind...)",
    "anime.js":  "Anime.js 3.2 — animaciones CSS/JS fluidas",
    "matter.js": "Matter.js 0.19 — motor de física 2D (colisiones, gravedad...)",
    "tone.js":   "Tone.js 14.7 — síntesis de audio y música en el navegador",
    "marked.js": "Marked.js 9.1 — renderizado de Markdown a HTML",
}


# ---------------------------------------------------------------------------
# JS library mirror
# ---------------------------------------------------------------------------


@router.get("/libs")
async def list_libs():
    """List all available JS libraries served by the platform."""
    return [
        {"name": name, "url": f"/api/sdk/libs/{name}", "description": desc}
        for name, desc in _LIBS_META.items()
    ]


@router.get("/libs/{filename}", response_class=FileResponse)
async def serve_lib(filename: str):
    """Serve a bundled JS library with long-lived cache headers."""
    if filename not in _LIBS_META:
        raise HTTPException(status_code=404, detail=f"Librería '{filename}' no disponible.")
    path = LIBS_DIR / filename
    return FileResponse(
        path,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


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
    uptime = int(time.time() - psutil.boot_time())

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
async def get_app_data(installed_app_id: int, db: Session = Depends(get_device_db)):
    _get_installed(installed_app_id, db)
    return db.query(AppData).filter(AppData.installed_app_id == installed_app_id).all()


@router.get("/app/{installed_app_id}/data/{key}", response_model=AppDataOut)
async def get_app_data_key(
    installed_app_id: int, key: str, db: Session = Depends(get_device_db)
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
    db: Session = Depends(get_device_db),
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
    installed_app_id: int, key: str, db: Session = Depends(get_device_db)
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
async def sdk_list_sensors(db: Session = Depends(get_device_db)):
    return db.query(RegisteredSensor).filter(RegisteredSensor.is_active == True).all()


# ── GPIO digital ──────────────────────────────────────────────────────────────

@router.get("/hardware/gpio/{pin}", response_model=GPIOReadOut)
async def sdk_gpio_read(pin: int):
    try:
        return GPIOReadOut(pin=pin, value=hw.gpio_read(pin))
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "GPIO_ERROR"})


@router.post("/hardware/gpio/{pin}")
async def sdk_gpio_write(pin: int, body: GPIOWriteIn):
    try:
        hw.gpio_write(pin, body.value)
        return {"success": True, "mock": not hw.GPIOZERO_AVAILABLE}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "GPIO_ERROR"})


# ── PWM ───────────────────────────────────────────────────────────────────────

@router.get("/hardware/gpio/{pin}/pwm", response_model=PWMReadOut)
async def sdk_pwm_read(pin: int):
    return PWMReadOut(pin=pin, duty_cycle=hw.gpio_pwm_get(pin))


@router.post("/hardware/gpio/{pin}/pwm", response_model=PWMReadOut)
async def sdk_pwm_write(pin: int, body: PWMWrite):
    try:
        hw.gpio_pwm_set(pin, body.duty_cycle)
        return PWMReadOut(pin=pin, duty_cycle=body.duty_cycle)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "PWM_ERROR"})


# ── I2C ───────────────────────────────────────────────────────────────────────

@router.get("/hardware/i2c/{bus}/{address}/{register}", response_model=I2CReadOut)
async def sdk_i2c_read(bus: int, address: int, register: int, length: int = 1):
    try:
        data = hw.i2c_read(bus, address, register, length)
        return I2CReadOut(bus=bus, address=address, register=register, data=data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "I2C_ERROR"})


# ── Camera ───────────────────────────────────────────────────────────────────

@router.get("/hardware/camera/snapshot")
async def sdk_camera_snapshot():
    """Returns {"image": "data:image/jpeg;base64,..."} for use in <img src>."""
    jpeg = await hw.camera_snapshot()
    if jpeg is None:
        raise HTTPException(status_code=503, detail={"detail": "Camera not available", "code": "NO_CAMERA"})
    b64 = base64.b64encode(jpeg).decode()
    return {"image": f"data:image/jpeg;base64,{b64}"}


@router.get("/hardware/camera/stream")
async def sdk_camera_stream():
    """
    MJPEG stream — use directly as <img src="/api/sdk/hardware/camera/stream">.
    """
    if not hw.CAMERA_AVAILABLE:
        raise HTTPException(status_code=503, detail={"detail": "Camera not available", "code": "NO_CAMERA"})

    async def _multipart():
        async for frame in hw.camera_frames(fps=10):
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )

    return StreamingResponse(
        _multipart(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache"},
    )
