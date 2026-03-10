"""AI-assisted app generation via Claude API + Server-Sent Events."""
from __future__ import annotations

import io
import json
import os
import re
import zipfile
from pathlib import Path
from typing import AsyncGenerator

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import verify_token
from database import get_platform_db, get_device_db
from models_platform import StoreApp, User
from models_device import InstalledApp, ActivityLog

router = APIRouter(prefix="/api/ai", tags=["ai"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
PACKAGES_DIR = BACKEND_DIR / "store" / "packages"
INSTALLED_DIR = BACKEND_DIR / "installed"

SYSTEM_PROMPT = """\
You are an expert web developer creating apps for ModevI — a modular app platform for Raspberry Pi 5 with a 7" touchscreen (800×480 pixels).

## Output Rules
1. Output ONLY a single complete HTML file starting with `<!DOCTYPE html>`. No markdown, no code fences, no explanations.
2. Completely self-contained — NO external CDN links (no Tailwind CDN, no Bootstrap CDN, no Google Fonts, no external scripts or stylesheets of any kind). All CSS and JS must be inline.
3. Dark theme: background #0f0f1a or similar deep dark color.
4. Touch-first design: minimum 44px tap targets, readable font sizes (≥14px).
5. Optimized for 800×480 viewport. Use `<meta name="viewport" content="width=800, height=480">`.

## ModevI SDK (window.ModevI)
Available inside the iframe — always wrap in try/catch and fall back to localStorage:

```js
// Persistent KV store per app
await window.ModevI.db.get('key')           // → string | null
await window.ModevI.db.set('key', 'value')  // → void
await window.ModevI.db.delete('key')        // → void
await window.ModevI.db.list('prefix')       // → string[]

// System info
await window.ModevI.system.getInfo()
// → { cpu_percent, temperature, memory: { used_mb, total_mb, percent }, disk: { used_gb, total_gb, percent } }

// Notifications
window.ModevI.notify.toast('message', 'success' | 'error' | 'info')

// GPIO & sensors (only if hardware connected)
await window.ModevI.hardware.getSensors()
await window.ModevI.hardware.readGPIO(pin)
await window.ModevI.hardware.writeGPIO(pin, value)
```

## Best Practices
- CSS variables for theming and colors.
- requestAnimationFrame for smooth animations.
- Web Audio API (AudioContext) for sounds.
- Save state via ModevI.db with localStorage fallback.
- Show loading/error states to the user.
- Keep UI clean, minimal, beautiful. Use gradients and subtle glass effects.
"""


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


async def _stream(
    description: str,
    name: str,
    category_id: int | None,
    user: User,
    db: Session,
    device_db: Session,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted data events for the entire app-creation pipeline."""

    def evt(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        yield evt({"type": "error", "message": "ANTHROPIC_API_KEY no está configurada en el servidor."})
        return

    yield evt({"type": "status", "step": "connecting", "message": "Conectando con Claude..."})

    client = anthropic.AsyncAnthropic(api_key=api_key)
    html_code = ""

    yield evt({"type": "status", "step": "generating", "message": "Generando código de la aplicación..."})

    try:
        async with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=32000,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Crea una aplicación ModevI llamada «{name}».\n\n"
                        f"Descripción:\n{description}"
                    ),
                }
            ],
        ) as stream:
            async for text in stream.text_stream:
                html_code += text
                yield evt({"type": "code_chunk", "text": text})

    except anthropic.APIError as e:
        yield evt({"type": "error", "message": f"Error de la API de IA: {e}"})
        return
    except Exception as e:
        yield evt({"type": "error", "message": f"Error inesperado: {e}"})
        return

    # Strip markdown code fences if the model wrapped the output
    if "```html" in html_code:
        html_code = html_code.split("```html", 1)[1].split("```", 1)[0].strip()
    elif "```" in html_code:
        html_code = html_code.split("```", 1)[1].split("```", 1)[0].strip()

    if not html_code.strip().upper().startswith("<!"):
        yield evt({
            "type": "error",
            "message": "La IA no devolvió un HTML válido. Prueba con una descripción más detallada.",
        })
        return

    # Validate HTML is complete (not truncated mid-generation)
    stripped = html_code.strip().upper()
    if not stripped.endswith("</HTML>"):
        yield evt({
            "type": "error",
            "message": "El código generado quedó incompleto (truncado). Inténtalo de nuevo con una descripción más simple.",
        })
        return

    # ------------------------------------------------------------------ #
    # Package into ZIP                                                     #
    # ------------------------------------------------------------------ #
    yield evt({"type": "status", "step": "packaging", "message": "Empaquetando en ZIP..."})

    manifest = {
        "name": name,
        "version": "1.0.0",
        "description": description[:500],
        "entry_point": "index.html",
        "required_hardware": [],
        "permissions": [],
    }

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("index.html", html_code)
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
    zip_bytes = zip_buf.getvalue()

    # ------------------------------------------------------------------ #
    # Register in platform DB                                              #
    # ------------------------------------------------------------------ #
    yield evt({"type": "status", "step": "registering", "message": "Registrando en la tienda..."})

    base_slug = _slugify(name) or "ai-app"
    slug = base_slug
    counter = 1
    while db.query(StoreApp).filter(StoreApp.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    store_app = StoreApp(
        developer_id=user.id,
        category_id=category_id,
        name=name,
        slug=slug,
        description=description[:500],
        long_description=description,
        version="1.0.0",
        permissions=[],
        required_hardware=[],
        status="published",  # AI-generated apps go live immediately
    )
    db.add(store_app)
    db.commit()
    db.refresh(store_app)

    # Save ZIP package
    pkg_dir = PACKAGES_DIR / str(store_app.id)
    pkg_dir.mkdir(parents=True, exist_ok=True)
    zip_path = pkg_dir / "app.zip"
    zip_path.write_bytes(zip_bytes)
    store_app.package_path = str(zip_path)
    db.commit()

    # Extract to installed/ and register on device DB
    installed = InstalledApp(store_app_id=store_app.id, is_active=False)
    device_db.add(installed)
    device_db.flush()

    install_path = INSTALLED_DIR / str(installed.id)
    install_path.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(install_path)
    installed.install_path = str(install_path)

    device_db.add(ActivityLog(
        installed_app_id=installed.id,
        action="install",
        details=f"App '{name}' generada con IA e instalada automáticamente",
    ))
    device_db.commit()

    yield evt({
        "type": "done",
        "app_id": store_app.id,
        "app_slug": slug,
        "installed_id": installed.id,
        "message": f"¡Aplicación «{name}» creada e instalada!",
    })


@router.get("/create-app")
async def create_app_with_ai(
    description: str = Query(..., min_length=10, description="Descripción de la app"),
    name: str = Query(..., min_length=2, description="Nombre de la app"),
    category_id: int = Query(default=None, description="ID de categoría (opcional)"),
    token: str = Query(..., description="JWT access token"),
    db: Session = Depends(get_platform_db),
    device_db: Session = Depends(get_device_db),
):
    """
    Stream Server-Sent Events for AI-assisted app generation.
    Uses JWT via query param because the browser EventSource API doesn't support
    custom request headers.
    """
    try:
        payload = verify_token(token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token de tipo incorrecto")

    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if user.role not in ("developer", "admin"):
        raise HTTPException(status_code=403, detail="Se requiere rol developer o admin")

    return StreamingResponse(
        _stream(description, name, category_id, user, db, device_db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
