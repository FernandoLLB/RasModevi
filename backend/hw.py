"""Low-level hardware utilities shared by hardware and sdk routers.

Each subsystem degrades gracefully when the required library is not available
(development on non-Pi machines returns mock data instead of raising errors).
"""
from __future__ import annotations

import asyncio
import io
import logging
from typing import Any

log = logging.getLogger(__name__)

# ── GPIO / PWM ────────────────────────────────────────────────────────────────

try:
    from gpiozero import PWMLED, LED, Button  # type: ignore
    GPIOZERO_AVAILABLE = True
except Exception:
    GPIOZERO_AVAILABLE = False

# Cache de dispositivos PWM por pin — evita errores "pin already in use"
_pwm_devices: dict[int, Any] = {}
_gpio_devices: dict[int, Any] = {}


def gpio_read(pin: int) -> int:
    if not GPIOZERO_AVAILABLE:
        return 0
    btn = Button(pin)
    return 1 if btn.is_pressed else 0


def gpio_write(pin: int, value: int) -> None:
    if not GPIOZERO_AVAILABLE:
        return
    if pin not in _gpio_devices:
        _gpio_devices[pin] = LED(pin)
    if value:
        _gpio_devices[pin].on()
    else:
        _gpio_devices[pin].off()


def gpio_pwm_set(pin: int, duty: float) -> None:
    """Set PWM duty cycle (0.0–1.0) on a pin."""
    if not GPIOZERO_AVAILABLE:
        return
    if pin not in _pwm_devices:
        _pwm_devices[pin] = PWMLED(pin)
    _pwm_devices[pin].value = max(0.0, min(1.0, duty))


def gpio_pwm_get(pin: int) -> float:
    """Return current PWM duty cycle for a pin (0.0 if not set)."""
    if pin in _pwm_devices:
        return float(_pwm_devices[pin].value)
    return 0.0


# ── I2C ──────────────────────────────────────────────────────────────────────

try:
    import smbus2  # type: ignore
    I2C_AVAILABLE = True
except Exception:
    I2C_AVAILABLE = False


def i2c_read(bus: int, address: int, register: int, length: int = 1) -> list[int]:
    """Read `length` bytes from an I2C device. Returns mock zeros if unavailable."""
    if not I2C_AVAILABLE:
        return [0] * length
    try:
        with smbus2.SMBus(bus) as b:
            if length == 1:
                return [b.read_byte_data(address, register)]
            return list(b.read_i2c_block_data(address, register, length))
    except Exception as exc:
        log.warning("I2C read error (bus=%d addr=0x%02x reg=0x%02x): %s", bus, address, register, exc)
        raise


def i2c_write(bus: int, address: int, register: int, data: list[int]) -> None:
    """Write bytes to an I2C device."""
    if not I2C_AVAILABLE:
        return
    with smbus2.SMBus(bus) as b:
        b.write_i2c_block_data(address, register, data)


# ── Camera ───────────────────────────────────────────────────────────────────

try:
    from picamera2 import Picamera2  # type: ignore
    CAMERA_AVAILABLE = True
except Exception:
    CAMERA_AVAILABLE = False

_camera: Any = None
_camera_lock = asyncio.Lock()


async def _init_camera() -> Any:
    global _camera
    async with _camera_lock:
        if _camera is None and CAMERA_AVAILABLE:
            cam = Picamera2()
            config = cam.create_still_configuration(main={"size": (1280, 720)})
            cam.configure(config)
            cam.start()
            _camera = cam
            log.info("Camera initialised: %s", cam.camera_properties.get("Model", "unknown"))
    return _camera


async def camera_snapshot() -> bytes | None:
    """Capture a single JPEG frame. Returns None if no camera is available."""
    cam = await _init_camera()
    if cam is None:
        return None
    buf = io.BytesIO()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: cam.capture_file(buf, format="jpeg"))
    return buf.getvalue()


async def camera_frames(fps: int = 10):
    """Async generator yielding raw JPEG bytes at ~`fps` frames per second."""
    cam = await _init_camera()
    if cam is None:
        return
    interval = 1.0 / fps
    loop = asyncio.get_event_loop()
    while True:
        buf = io.BytesIO()
        await loop.run_in_executor(None, lambda: cam.capture_file(buf, format="jpeg"))
        yield buf.getvalue()
        await asyncio.sleep(interval)
