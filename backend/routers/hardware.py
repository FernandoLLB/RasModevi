"""Hardware router — manage registered sensors, GPIO, PWM, I2C and camera."""
from __future__ import annotations

import asyncio
import base64
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import hw
from database import get_device_db
from models_device import RegisteredSensor
from schemas import (
    GPIOReadOut, GPIOWriteIn,
    PWMWrite, PWMReadOut,
    I2CReadOut,
    SensorOut, SensorRegister, SensorUpdate,
)

router = APIRouter(prefix="/api/hardware", tags=["hardware"])


# ---------------------------------------------------------------------------
# Sensors CRUD
# ---------------------------------------------------------------------------


@router.get("/sensors", response_model=List[SensorOut])
async def list_sensors(db: Session = Depends(get_device_db)):
    return db.query(RegisteredSensor).order_by(RegisteredSensor.name).all()


@router.post("/sensors", response_model=SensorOut, status_code=status.HTTP_201_CREATED)
async def register_sensor(body: SensorRegister, db: Session = Depends(get_device_db)):
    sensor = RegisteredSensor(
        name=body.name,
        sensor_type=body.sensor_type,
        interface=body.interface,
        pin_or_address=body.pin_or_address,
        config_json=body.config_json,
        hardware_tag_id=body.hardware_tag_id,
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.put("/sensors/{sensor_id}", response_model=SensorOut)
async def update_sensor(
    sensor_id: int, body: SensorUpdate, db: Session = Depends(get_device_db)
):
    sensor = db.query(RegisteredSensor).filter(RegisteredSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail={"detail": "Sensor not found", "code": "NOT_FOUND"})
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sensor, field, value)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.delete("/sensors/{sensor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sensor(sensor_id: int, db: Session = Depends(get_device_db)):
    sensor = db.query(RegisteredSensor).filter(RegisteredSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail={"detail": "Sensor not found", "code": "NOT_FOUND"})
    db.delete(sensor)
    db.commit()


# ---------------------------------------------------------------------------
# GPIO digital read / write
# ---------------------------------------------------------------------------


@router.get("/gpio/{pin}", response_model=GPIOReadOut)
async def gpio_read(pin: int):
    try:
        value = hw.gpio_read(pin)
        return GPIOReadOut(pin=pin, value=value)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "GPIO_ERROR"})


@router.post("/gpio/{pin}")
async def gpio_write(pin: int, body: GPIOWriteIn):
    try:
        hw.gpio_write(pin, body.value)
        return {"success": True, "mock": not hw.GPIOZERO_AVAILABLE}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "GPIO_ERROR"})


# ---------------------------------------------------------------------------
# GPIO PWM
# ---------------------------------------------------------------------------


@router.get("/gpio/{pin}/pwm", response_model=PWMReadOut)
async def pwm_read(pin: int):
    return PWMReadOut(pin=pin, duty_cycle=hw.gpio_pwm_get(pin))


@router.post("/gpio/{pin}/pwm", response_model=PWMReadOut)
async def pwm_write(pin: int, body: PWMWrite):
    try:
        hw.gpio_pwm_set(pin, body.duty_cycle)
        return PWMReadOut(pin=pin, duty_cycle=body.duty_cycle)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "PWM_ERROR"})


# ---------------------------------------------------------------------------
# I2C
# ---------------------------------------------------------------------------


@router.get("/i2c/{bus}/{address}/{register}", response_model=I2CReadOut)
async def i2c_read(bus: int, address: int, register: int, length: int = 1):
    """
    Read `length` bytes from an I2C device.
    - bus: usually 1 on Raspberry Pi
    - address: device address in decimal (e.g. 118 for BME280 at 0x76)
    - register: register address in decimal
    """
    try:
        data = hw.i2c_read(bus, address, register, length)
        return I2CReadOut(bus=bus, address=address, register=register, data=data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"detail": str(exc), "code": "I2C_ERROR"})


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------


@router.get("/camera/snapshot")
async def camera_snapshot():
    """Return a single JPEG frame as a base64 data URL."""
    jpeg = await hw.camera_snapshot()
    if jpeg is None:
        raise HTTPException(status_code=503, detail={"detail": "Camera not available", "code": "NO_CAMERA"})
    b64 = base64.b64encode(jpeg).decode()
    return {"image": f"data:image/jpeg;base64,{b64}", "mock": False}


@router.get("/camera/stream")
async def camera_stream():
    """
    MJPEG stream — use directly as <img src="/api/hardware/camera/stream">.
    Streams at ~10 fps until the client disconnects.
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


# ---------------------------------------------------------------------------
# WebSocket streaming (registered sensors)
# ---------------------------------------------------------------------------


@router.websocket("/sensors/{sensor_id}/stream")
async def sensor_stream(sensor_id: int, websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = {
                "sensor_id": sensor_id,
                "timestamp": time.time(),
                "value": _mock_sensor_value(sensor_id),
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass


def _mock_sensor_value(sensor_id: int) -> float:
    import math
    t = time.time()
    return round(20.0 + 5.0 * math.sin(t / 10.0 + sensor_id), 2)
