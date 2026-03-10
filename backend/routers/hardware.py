"""Hardware router — manage registered sensors and GPIO access with WebSocket streaming."""
from __future__ import annotations

import asyncio
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from database import get_device_db
from models_device import RegisteredSensor
from schemas import GPIOReadOut, GPIOWriteIn, SensorOut, SensorRegister, SensorUpdate

try:
    from gpiozero import LED, Button  # type: ignore

    GPIOZERO_AVAILABLE = True
except Exception:
    GPIOZERO_AVAILABLE = False

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Sensor not found", "code": "NOT_FOUND"},
        )
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sensor, field, value)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.delete("/sensors/{sensor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sensor(sensor_id: int, db: Session = Depends(get_device_db)):
    sensor = db.query(RegisteredSensor).filter(RegisteredSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Sensor not found", "code": "NOT_FOUND"},
        )
    db.delete(sensor)
    db.commit()


# ---------------------------------------------------------------------------
# GPIO read/write
# ---------------------------------------------------------------------------


@router.get("/gpio/{pin}", response_model=GPIOReadOut)
async def gpio_read(pin: int):
    if not GPIOZERO_AVAILABLE:
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


@router.post("/gpio/{pin}")
async def gpio_write(pin: int, body: GPIOWriteIn):
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


# ---------------------------------------------------------------------------
# WebSocket streaming
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
