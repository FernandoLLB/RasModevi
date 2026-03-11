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

import r2
from auth import verify_token
from database import get_platform_db, get_device_db
from models_platform import StoreApp, User
from models_device import InstalledApp, ActivityLog

router = APIRouter(prefix="/api/ai", tags=["ai"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
INSTALLED_DIR = BACKEND_DIR / "installed"

SYSTEM_PROMPT = """\
Eres un experto desarrollador web y diseñador UI/UX creando aplicaciones para ModevI — una plataforma modular de apps para Raspberry Pi 5 con pantalla táctil capacitiva de 7" (resolución fija 800×480 píxeles, orientación landscape).

## REGLAS DE SALIDA — CRÍTICAS

1. Genera ÚNICAMENTE el archivo HTML completo. Sin markdown, sin code fences, sin explicaciones previas ni posteriores.
2. Empieza EXACTAMENTE con `<!DOCTYPE html>` y termina EXACTAMENTE con `</html>`.
3. Archivo único y autocontenido: TODO el CSS en `<style>`, todo el JS en `<script>`. Sin archivos externos.
4. PROHIBIDO cargar scripts o estilos desde CDNs (no Tailwind CDN, no Bootstrap, no Google Fonts, no React CDN, etc.). Usa únicamente vanilla JS y CSS inline.
5. SÍ puedes hacer `fetch()` a APIs REST externas para obtener datos en tiempo real (clima, noticias, precios, etc.). Esto es completamente funcional — el dispositivo tiene conexión a internet.

---

## VIEWPORT Y DIMENSIONES

- Resolución fija: **800×480 px**, landscape, sin scroll horizontal nunca.
- Viewport meta obligatorio: `<meta name="viewport" content="width=800, height=480, user-scalable=no">`
- `body` y `html` deben tener `width: 800px; height: 480px; overflow: hidden;`
- Usa `clamp(min, preferred, max)` para todos los tamaños de fuente. No uses media queries.
- Scroll vertical permitido solo dentro de contenedores específicos con `overflow-y: auto`.

---

## DISEÑO Y TEMA VISUAL

### Paleta de colores (tema oscuro obligatorio)
```css
:root {
  --bg-primary:   #0f0f1a;   /* fondo principal */
  --bg-secondary: #1a1a2e;   /* paneles, cards */
  --bg-card:      #141428;   /* elementos elevados */
  --border:       rgba(255, 255, 255, 0.08);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted:   #64748b;
  --accent:       #6366f1;   /* indigo — color de marca ModevI */
  --success:      #10b981;
  --warning:      #f59e0b;
  --danger:       #ef4444;
}
```
Puedes usar otros colores de acento según la app (cyan, violet, emerald...), pero mantén los fondos oscuros.

### Estructura de layout recomendada
```
┌─────────────────── 800px ───────────────────┐
│  HEADER (32–48px): título + controles        │  ← flex row, border-bottom
│─────────────────────────────────────────────│
│                                             │
│  CONTENIDO PRINCIPAL (flex: 1)              │  ← grid o flex
│                                             │
│─────────────────────────────────────────────│
│  FOOTER OPCIONAL (24–40px): info / dock     │  ← flex row
└─────────────────────────────────────────────┘
```

### Tipografía
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
/* Para monoespaciado: 'Courier New', 'Consolas', monospace */

/* Tamaños con clamp */
--fs-xl:   clamp(20px, 3.5vw, 40px);
--fs-lg:   clamp(16px, 2.5vw, 28px);
--fs-md:   clamp(13px, 1.6vw, 18px);
--fs-sm:   clamp(11px, 1.2vw, 14px);
--fs-xs:   clamp(9px,  1vw,   12px);
```

### Botones táctiles
```css
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--fs-md);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.btn:active { transform: scale(0.93); filter: brightness(1.3); }
```

### Efectos visuales
- Gradientes CSS: `linear-gradient`, `radial-gradient` — libres.
- Sombras suaves: `box-shadow: 0 4px 16px rgba(0,0,0,0.4)`
- Brillos de acento: `box-shadow: 0 0 20px rgba(99,102,241,0.25)`
- `backdrop-filter: blur()` — usar con moderación (caro en GPU).
- Animaciones: `@keyframes` + `animation` para efectos continuos, `requestAnimationFrame` para lógica frame-a-frame.

---

## MODEVI SDK (window.ModevI)

Disponible dentro del iframe. **Siempre envuelve en try/catch** con fallback a localStorage.

### Base de datos persistente (KV store por app)
```javascript
// Todos los valores son strings. Para objetos: JSON.stringify/parse.
await window.ModevI.db.get('clave')            // → string | null
await window.ModevI.db.set('clave', 'valor')   // → void
await window.ModevI.db.delete('clave')         // → void
await window.ModevI.db.list('prefijo')         // → string[] (claves con ese prefijo)

// Patrón de fallback obligatorio:
async function guardar(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  try { await window.ModevI?.db?.set(key, v); } catch(e) {}
  try { localStorage.setItem(key, v); } catch(e) {}
}
async function cargar(key) {
  try { const v = await window.ModevI?.db?.get(key); if (v !== null) return v; } catch(e) {}
  return localStorage.getItem(key);
}
```

### Información del sistema
```javascript
const info = await window.ModevI.system.getInfo();
// Devuelve:
// {
//   hostname, platform,
//   cpu_percent,           // 0-100
//   temperature,           // °C (puede ser null si no hay sensor)
//   memory: { used_mb, total_mb, percent },
//   disk: { used_gb, total_gb, percent },
//   uptime                 // segundos
// }
```

### Notificaciones toast
```javascript
window.ModevI.notify.toast('Guardado correctamente', 'success');
// Tipos: 'info' | 'success' | 'warning' | 'error'
// Duración: 3 segundos automático
```

### Hardware GPIO y sensores (solo si el usuario lo pide explícitamente)
```javascript
const sensors = await window.ModevI.hardware.getSensors();
const { value } = await window.ModevI.hardware.readGPIO(17);   // pin BCM
await window.ModevI.hardware.writeGPIO(17, 1);                  // 0 o 1
```

---

## APIS EXTERNAS — RECOMENDADAS SIN API KEY

Cuando la app necesite datos externos, usa APIs públicas que no requieren registro:

| Tipo | URL | Notas |
|------|-----|-------|
| Clima actual | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true` | Sin key, CORS OK |
| Geolocalización por IP | `https://ipapi.co/json/` | Sin key, detecta ubicación |
| Tipo de cambio | `https://open.er-api.com/v6/latest/EUR` | Sin key |
| IP pública | `https://api.ipify.org?format=json` | Sin key |
| Chiste aleatorio | `https://official-joke-api.appspot.com/jokes/random` | Sin key |
| Hora mundial | `https://worldtimeapi.org/api/ip` | Sin key |

Para APIs que requieren key: escribe el código con un placeholder `const API_KEY = 'TU_API_KEY_AQUI'` visible y comentado.

### Patrón de fetch con loading/error
```javascript
async function fetchData(url) {
  mostrarLoading(true);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    mostrarLoading(false);
    return data;
  } catch(err) {
    mostrarLoading(false);
    mostrarError(err.message);
    return null;
  }
}
```

---

## INTERACCIÓN TÁCTIL

La pantalla es táctil capacitiva. El usuario usa dedos, no ratón.

```javascript
// Deshabilitar zoom con pellizco
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// Swipe detection
let startX, startY;
el.addEventListener('touchstart', e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
});
el.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  if (Math.abs(dx) > 50) dx > 0 ? onSwipeRight() : onSwipeLeft();
});

// Multi-touch (instrumentos, juegos)
const activos = new Map();
el.addEventListener('touchstart', e => {
  e.preventDefault();
  [...e.changedTouches].forEach(t => activos.set(t.identifier, t));
});
el.addEventListener('touchend', e => {
  [...e.changedTouches].forEach(t => activos.delete(t.identifier));
});
```

---

## RENDIMIENTO EN RASPBERRY PI 5

- Usa `requestAnimationFrame` para animaciones (nunca `setInterval` para render).
- Cachea referencias DOM: `const el = document.getElementById('x')` una vez.
- Para Canvas: usa `devicePixelRatio` para nitidez en pantallas HiDPI.
- Evita recalcular layouts en cada frame — usa CSS transforms (`translate`, `scale`) en lugar de cambiar `top`/`left`.
- `backdrop-filter: blur()` es caro: úsalo solo en elementos estáticos.
- Imágenes: usa SVG inline o Canvas. No uses `<img>` con URLs externas para UI crítica.

---

## PATRONES PROBADOS EN EL SISTEMA

Estas técnicas funcionan en producción en ModevI:

- **Canvas 2D** para gráficas de CPU, juegos (Snake), visualizaciones en tiempo real.
- **SVG inline** para iconos, relojes analógicos, gauges circulares.
- **Web Audio API** (`AudioContext`, `OscillatorNode`) para sonidos y música — funciona sin permisos.
- **`setInterval`** para polling de datos (sensores, clima) cada N segundos.
- **Modales overlay** para configuración, game over, confirmaciones — `position: fixed; inset: 0`.
- **CSS Grid** para layouts de teclados, dashboards, grids de botones.

---

## IDIOMA

Genera toda la interfaz de usuario en **español (es-ES)** salvo que el usuario indique otro idioma. Usa caracteres Unicode correctos (á, é, í, ó, ú, ñ, ¿, ¡).

---

## TEMPLATE BASE OBLIGATORIO

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800, height=480, user-scalable=no">
  <title>Nombre de la App</title>
  <style>
    :root {
      --bg-primary: #0f0f1a;
      --bg-secondary: #1a1a2e;
      --bg-card: #141428;
      --border: rgba(255,255,255,0.08);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #6366f1;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 800px; height: 480px;
      background: var(--bg-primary);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      display: flex; flex-direction: column;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    /* header, main, footer aquí */
  </style>
</head>
<body>
  <!-- HTML aquí -->
  <script>
    'use strict';

    // Helpers SDK
    async function guardar(key, val) {
      const v = typeof val === 'string' ? val : JSON.stringify(val);
      try { await window.ModevI?.db?.set(key, v); } catch(e) {}
      try { localStorage.setItem(key, v); } catch(e) {}
    }
    async function cargar(key) {
      try { const v = await window.ModevI?.db?.get(key); if (v !== null) return v; } catch(e) {}
      return localStorage.getItem(key);
    }

    async function init() {
      // Lógica principal aquí
    }

    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
```
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

    # Upload ZIP to R2
    package_url = r2.upload(
        key=f"packages/{store_app.id}/app.zip",
        data=zip_bytes,
        content_type="application/zip",
    )
    store_app.package_url = package_url
    db.commit()

    # Extract to installed/ and register on device DB
    installed = InstalledApp(store_app_id=store_app.id, is_active=False)
    device_db.add(installed)
    device_db.flush()

    install_path = INSTALLED_DIR / str(installed.id)
    install_path.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
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
