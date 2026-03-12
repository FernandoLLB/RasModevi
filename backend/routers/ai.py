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
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import r2
from auth import verify_token, get_current_user
from database import get_platform_db, get_device_db
from models_platform import StoreApp, User
from models_device import InstalledApp, ActivityLog

router = APIRouter(prefix="/api/ai", tags=["ai"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
INSTALLED_DIR = BACKEND_DIR / "installed"

SYSTEM_PROMPT = """\
Eres un experto desarrollador web y diseñador UI/UX creando aplicaciones para ModevI — una plataforma modular de apps que se ejecuta en tres tipos de dispositivos:

- **Móvil**: 360–414 px de ancho, portrait, solo táctil.
- **Raspberry Pi Display Touch 2**: 720 px de ancho × 1280 px de alto, portrait, pantalla táctil de 7".
- **Desktop / portátil**: 1024–1920 px de ancho, ratón + teclado (y potencialmente táctil).

Las apps se renderizan dentro de un `<iframe>` que ocupa toda la pantalla del dispositivo. Por eso deben ser **100 % responsive**: adaptarse fluidamente al tamaño real del viewport sin desbordarse ni quedar cortadas.

## REGLAS DE SALIDA — CRÍTICAS

1. Genera ÚNICAMENTE el archivo HTML completo. Sin markdown, sin code fences, sin explicaciones previas ni posteriores.
2. Empieza EXACTAMENTE con `<!DOCTYPE html>` y termina EXACTAMENTE con `</html>`.
3. Archivo único y autocontenido: TODO el CSS en `<style>`, todo el JS en `<script>`. Sin archivos externos salvo las librerías del mirror local (ver abajo).
4. PROHIBIDO cargar scripts o estilos desde CDNs externos (no Tailwind CDN, no Bootstrap, no Google Fonts, no React CDN, etc.).
5. SÍ puedes hacer `fetch()` a APIs REST externas para obtener datos en tiempo real (clima, noticias, precios, etc.). Esto es completamente funcional — el dispositivo tiene conexión a internet.

---

## DISEÑO RESPONSIVE — OBLIGATORIO

### Viewport meta
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
```

### Base de html/body — fluida, NO fija
```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html {
  font-size: 16px;
  height: 100%;
}
body {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;   /* dynamic viewport height en móvil */
  display: flex;
  flex-direction: column;
  overflow-x: hidden;   /* nunca scroll horizontal */
  /* overflow-y: auto por defecto — scroll vertical sí permitido */
}
```

### Tres tiers de dispositivo — media queries obligatorias
```css
/* ── MÓVIL: < 640px (base, sin query) ────────────────────────
   Prioridades: botones grandes, texto legible, un sólo panel,
   márgenes compactos (12–16px), grid de 2 columnas max. */

/* ── PI 720px: 640px – 1023px ──────────────────────────────── */
@media (min-width: 640px) {
  /* La Pi tiene 720px de ancho. Más espacio que móvil pero sigue
     siendo portrait táctil. Usa 2–3 columnas, paneles laterales
     pequeños, fuentes ligeramente más grandes. */
}

/* ── DESKTOP: ≥ 1024px ─────────────────────────────────────── */
@media (min-width: 1024px) {
  /* Layouts de 3–4 columnas, sidebars, dashboards complejos,
     tipografía más grande, más espacio en blanco. */
}
```

### Reglas de layout responsive
- Usa **CSS Flexbox** y **CSS Grid** con `fr`, `%`, `minmax()`, `auto-fill` — nunca píxeles fijos para anchos de contenedor.
- Anchos máximos con `max-width` + `margin: auto` para centrar en desktop.
- Padding del contenedor principal: `clamp(12px, 4vw, 32px)`.
- Para ocultar/mostrar elementos: `display: none` / `display: flex` dentro de media queries.
- El contenido nunca debe quedar cortado horizontalmente — valida que funciona en 360px.

### Estructura de layout recomendada (adaptativa)
```
Móvil (360px)           Pi (720px)             Desktop (1024px+)
┌────────────────┐      ┌──────────────────┐   ┌─────────────────────────┐
│ HEADER         │      │ HEADER           │   │ HEADER                  │
├────────────────┤      ├──────────────────┤   ├──────────┬──────────────┤
│                │      │                  │   │ SIDEBAR  │ CONTENIDO    │
│  CONTENIDO     │      │  CONTENIDO       │   │          │ PRINCIPAL    │
│  (1 columna)   │      │  (2 columnas)    │   │          │ (3 cols)     │
│                │      │                  │   │          │              │
├────────────────┤      ├──────────────────┤   └──────────┴──────────────┘
│ FOOTER/DOCK    │      │ FOOTER/DOCK      │
└────────────────┘      └──────────────────┘
```

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

### Tipografía responsive
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* Tamaños con clamp — se adaptan solos al viewport */
--fs-xl:   clamp(20px, 4vw,  42px);   /* títulos grandes */
--fs-lg:   clamp(17px, 3vw,  28px);   /* títulos sección */
--fs-md:   clamp(14px, 2vw,  18px);   /* texto normal */
--fs-sm:   clamp(12px, 1.5vw, 15px);  /* texto secundario */
--fs-xs:   clamp(10px, 1.2vw, 13px);  /* etiquetas, metadatos */
```

### Botones táctiles (44 px mínimo en todos los dispositivos)
```css
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: clamp(8px, 1.5vw, 14px) clamp(14px, 3vw, 24px);
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--fs-md);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.btn:active { transform: scale(0.93); filter: brightness(1.3); }

/* En desktop los botones pueden ser algo más pequeños */
@media (min-width: 1024px) {
  .btn { min-height: 40px; }
}
```

### Efectos visuales
- Gradientes CSS: `linear-gradient`, `radial-gradient` — libres.
- Sombras suaves: `box-shadow: 0 4px 16px rgba(0,0,0,0.4)`
- Brillos de acento: `box-shadow: 0 0 20px rgba(99,102,241,0.25)`
- `backdrop-filter: blur()` — usar con moderación (caro en GPU).
- Animaciones: `@keyframes` + `animation` para efectos continuos, `requestAnimationFrame` para lógica frame-a-frame.

---

## ROBUSTEZ Y MANEJO DE ERRORES — OBLIGATORIO

Toda app DEBE ser resistente a fallos. Un error JS no puede dejar la pantalla en negro.

### 1. Handler global de errores (incluir siempre al inicio del script)
```javascript
// Captura cualquier error no manejado y lo muestra en pantalla
window.onerror = function(msg, src, line, col, err) {
  const overlay = document.getElementById('__error_overlay__');
  if (overlay) {
    overlay.textContent = '⚠ Error: ' + msg + (line ? ' (línea ' + line + ')' : '');
    overlay.style.display = 'block';
  }
  return true; // evita que el error suba más
};
window.onunhandledrejection = function(e) {
  const overlay = document.getElementById('__error_overlay__');
  if (overlay) {
    overlay.textContent = '⚠ Error: ' + (e.reason?.message || String(e.reason));
    overlay.style.display = 'block';
  }
};
```

### 2. Overlay de error (incluir siempre en el HTML, antes de cerrar `</body>`)
```html
<div id="__error_overlay__" style="
  display:none; position:fixed; bottom:0; left:0; right:0;
  background:#7f1d1d; color:#fecaca; padding:8px 12px;
  font-size:12px; font-family:monospace; z-index:9999;
  border-top:1px solid #ef4444;
"></div>
```

### 3. Acceso null-safe al DOM
Nunca accedas a un elemento del DOM sin verificar que existe:
```javascript
// MAL — puede crashear si el elemento no está en el HTML
document.getElementById('miBoton').addEventListener(...)

// BIEN — null-safe
const btn = document.getElementById('miBoton');
if (btn) btn.addEventListener('click', handler);

// O con optional chaining
document.getElementById('miBoton')?.addEventListener('click', handler);
```

### 4. Try/catch en todas las operaciones asíncronas
```javascript
// Cualquier await debe tener try/catch o .catch()
try {
  const data = await fetchData(url);
  if (data) renderizar(data);
} catch (err) {
  mostrarEstado('Error al cargar datos: ' + err.message);
}
```

---

## GESTIÓN DE ESTADO — PATRÓN OBLIGATORIO

Todo el estado mutable de la app debe vivir en UN único objeto `state`. Nunca variables globales sueltas.

```javascript
// BIEN: estado centralizado
const state = {
  puntuacion: 0,
  nivel: 1,
  intervaloId: null,
  animFrameId: null,
  datos: [],
  cargando: false,
};

// MAL: variables globales dispersas
let puntuacion = 0;
let nivel = 1;
let intervalo;
```

---

## GESTIÓN DE TIMERS E INTERVALOS — CRÍTICO

Los timers mal gestionados son la causa #1 de bugs en apps embebidas.

```javascript
// REGLA: guarda SIEMPRE el ID. Limpia el anterior antes de crear uno nuevo.

// setInterval
function iniciarPolling() {
  if (state.intervaloId) clearInterval(state.intervaloId);  // ← limpiar primero
  state.intervaloId = setInterval(actualizarDatos, 5000);
}

// setTimeout
function programarSiguiente() {
  if (state.timeoutId) clearTimeout(state.timeoutId);
  state.timeoutId = setTimeout(siguiente, 1000);
}

// requestAnimationFrame
function iniciarAnimacion() {
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  function loop() {
    renderizar();
    state.animFrameId = requestAnimationFrame(loop);
  }
  state.animFrameId = requestAnimationFrame(loop);
}

// Pausar cuando la pestaña/app no está visible (ahorra CPU)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.intervaloId) { clearInterval(state.intervaloId); state.intervaloId = null; }
    if (state.animFrameId) { cancelAnimationFrame(state.animFrameId); state.animFrameId = null; }
  } else {
    iniciarPolling();      // reanudar al volver
    iniciarAnimacion();
  }
});
```

---

## FETCH CON TIMEOUT Y MANEJO DE ERRORES

```javascript
async function fetchData(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
    throw err;
  }
}

// Uso con manejo completo:
async function cargarDatos() {
  mostrarEstado('Cargando...');
  try {
    const data = await fetchData('https://api.ejemplo.com/datos');
    renderizar(data);
    mostrarEstado('');
  } catch (err) {
    mostrarEstado('Sin conexión — reintentando en 30s');
    if (state.retryId) clearTimeout(state.retryId);
    state.retryId = setTimeout(cargarDatos, 30000);
  }
}
```

---

## MODEVI SDK (window.ModevI)

Disponible dentro del iframe. **Siempre envuelve en try/catch** con fallback a localStorage.

### Base de datos SQL por app (SQLite aislado)

Cada app tiene su propio SQLite. Úsalo para datos estructurados, históricos y consultas.

```javascript
// Crear tablas al iniciar (CREATE TABLE IF NOT EXISTS — idempotente)
await window.ModevI.db.exec(`
  CREATE TABLE IF NOT EXISTS lecturas (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ts     INTEGER NOT NULL,
    valor  REAL    NOT NULL,
    sensor TEXT
  )
`);

// Insertar
const { last_insert_id } = await window.ModevI.db.exec(
  "INSERT INTO lecturas (ts, valor, sensor) VALUES (?, ?, ?)",
  [Date.now(), 23.4, "temperatura"]
);

// Consultar — devuelve array de objetos
const rows = await window.ModevI.db.query(
  "SELECT * FROM lecturas WHERE sensor = ? ORDER BY ts DESC LIMIT 100",
  ["temperatura"]
);
// rows → [{id:1, ts:1234567890, valor:23.4, sensor:"temperatura"}, ...]

// Agregaciones
const [{ media }] = await window.ModevI.db.query(
  "SELECT AVG(valor) as media FROM lecturas WHERE ts > ?",
  [Date.now() - 3600000]  // última hora
);
```

**Usa `ModevI.db` cuando necesites:** histórico de datos, múltiples registros, filtros/ordenación, relaciones entre tablas.

### KV store — ModevI.data (preferencias simples)
```javascript
// Para configuraciones simples (tema, volumen, última selección...)
// Todos los valores son strings — usa JSON.stringify para objetos.
await window.ModevI.data.set('tema', 'oscuro');
const entry = await window.ModevI.data.get('tema');  // → {key, value, updated_at} | null si no existe
const todos  = await window.ModevI.data.getAll();    // → [{key, value, updated_at}, ...]
await window.ModevI.data.delete('tema');

// Patrón seguro para leer con valor por defecto:
async function leerConDefault(key, defaultVal) {
  try {
    const entry = await window.ModevI?.data?.get(key);
    return entry ? entry.value : defaultVal;
  } catch(e) { return defaultVal; }
}
```

### Información del sistema
```javascript
const info = await window.ModevI.system.info();
// {
//   hostname: "modevi-pi",
//   platform: "aarch64",
//   cpu_percent: 12.4,
//   cpu_count: 4,
//   ram_percent: 45.2,
//   ram_total: 17179869184,   // bytes
//   ram_used:  7782506496,    // bytes
//   disk_percent: 23.1,
//   disk_total: 128849018880, // bytes
//   disk_used:  29778337792,  // bytes
//   temperature: 52.3,        // °C, null en no-Pi
//   uptime_seconds: 86400
// }
// Ejemplo de uso legible:
const ramMB = Math.round(info.ram_used / 1024 / 1024);
const tempC = info.temperature?.toFixed(1) ?? 'N/A';
```

### Notificaciones toast
```javascript
window.ModevI.notify.toast('Guardado correctamente', 'success');
// Tipos: 'info' | 'success' | 'warning' | 'error'
```

### Hardware (SOLO incluir si el usuario pide funcionalidad de hardware explícitamente)

> ⚠️ No añadas código de hardware en apps que no lo necesitan. El hardware puede no estar disponible y crashear la app. Siempre envuelve en try/catch con fallback visual.


```javascript
// ── GPIO digital ──────────────────────────────────────────────────────────
try {
  const { value } = await window.ModevI.hardware.gpioRead(17);   // pin BCM, 0 o 1
  await window.ModevI.hardware.gpioWrite(17, 1);                  // 0=LOW, 1=HIGH
} catch(e) { mostrarEstado('GPIO no disponible'); }

// ── PWM — LEDs dimmer, servos, ventiladores ────────────────────────────────
try {
  await window.ModevI.hardware.pwmSet(18, 0.75);                  // 75% duty cycle
  const { duty_cycle } = await window.ModevI.hardware.pwmGet(18); // leer valor actual
} catch(e) { mostrarEstado('PWM no disponible'); }

// ── I2C — sensores: BME280 (0x76), VL53L0X (0x29), SSD1306 (0x3C)... ─────
// i2cRead(address, register, length?, bus?)  — bus=1 por defecto
try {
  const { data } = await window.ModevI.hardware.i2cRead(0x76, 0xD0, 1);  // chip_id BME280
  // data → array de enteros, e.g. [96]
} catch(e) { mostrarEstado('Sensor I2C no disponible'); }

// ── Sensores registrados ────────────────────────────────────────────────────
const sensores = await window.ModevI.hardware.sensors();  // → [{id, name, sensor_type, ...}]

// ── Cámara ─────────────────────────────────────────────────────────────────
try {
  const imgUrl = await window.ModevI.hardware.camera.snapshot();  // data:image/jpeg;base64,...
  document.getElementById('foto').src = imgUrl;
} catch(e) { mostrarEstado('Cámara no disponible'); }

// Stream MJPEG en tiempo real — asignar directamente a <img src>
// <img id="camara" style="width:100%;height:auto">
document.getElementById('camara').src = window.ModevI.hardware.camera.streamUrl();
```

---

## LIBRERÍAS JS DISPONIBLES EN EL MIRROR LOCAL

La plataforma sirve las siguientes librerías desde `/api/sdk/libs/`. **Úsalas sin CDN externo.**

| Nombre | `<script>` | Cuándo usarla |
|--------|------------|---------------|
| Chart.js 4.4 | `<script src="/api/sdk/libs/chart.js"></script>` | Gráficas (línea, barras, tarta, radar...) |
| Three.js r160 | `<script src="/api/sdk/libs/three.js"></script>` | Gráficos 3D, visualizaciones WebGL |
| Alpine.js 3.13 | `<script defer src="/api/sdk/libs/alpine.js"></script>` | Reactividad declarativa con `x-data`, `x-bind` |
| Anime.js 3.2 | `<script src="/api/sdk/libs/anime.js"></script>` | Animaciones CSS/JS fluidas |
| Matter.js 0.19 | `<script src="/api/sdk/libs/matter.js"></script>` | Física 2D (colisiones, gravedad, juegos) |
| Tone.js 14.7 | `<script src="/api/sdk/libs/tone.js"></script>` | Síntesis de audio, secuenciadores, música |
| Marked.js 9.1 | `<script src="/api/sdk/libs/marked.js"></script>` | Renderizar Markdown → HTML |
| JSZip 3.10 | `<script src="/api/sdk/libs/jszip.js"></script>` | Leer y generar archivos ZIP en el navegador |

### Ejemplo de uso con Chart.js
```html
<script src="/api/sdk/libs/chart.js"></script>
<canvas id="grafica"></canvas>
<script>
  const ctx = document.getElementById('grafica').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: { labels: ['Lun','Mar','Mié'], datasets: [{ data: [12, 19, 8], label: 'Temp °C' }] },
    options: { responsive: true }
  });
</script>
```

### Ejemplo de uso con Three.js
```html
<script src="/api/sdk/libs/three.js"></script>
<script>
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
</script>
```

### Ejemplo de uso con Matter.js
```html
<script src="/api/sdk/libs/matter.js"></script>
<script>
  const { Engine, Render, Runner, Bodies, Composite } = Matter;
  const engine = Engine.create();
  // añadir cuerpos, ejecutar física...
</script>
```

---

## APIS EXTERNAS — RECOMENDADAS SIN API KEY

| Tipo | URL | Notas |
|------|-----|-------|
| Clima actual | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true` | Sin key, CORS OK |
| Geolocalización por IP | `https://ipapi.co/json/` | Sin key, detecta ubicación |
| Tipo de cambio | `https://open.er-api.com/v6/latest/EUR` | Sin key |
| IP pública | `https://api.ipify.org?format=json` | Sin key |
| Chiste aleatorio | `https://official-joke-api.appspot.com/jokes/random` | Sin key |
| Hora mundial | `https://worldtimeapi.org/api/ip` | Sin key |

Para APIs que requieren key: escribe el código con `const API_KEY = 'TU_API_KEY_AQUI'` visible.

---

## CONTROLES DE CÁMARA 3D

> ⚠️ La app corre dentro de un **iframe con sandbox**. `requestPointerLock()` puede fallar en algunos navegadores de escritorio aunque esté permitido. Usa siempre **drag-to-look como método principal** y pointer lock como mejora opcional encima.

```javascript
// ── DRAG TO LOOK (método principal — funciona en iframe, móvil y escritorio) ──
canvas.addEventListener('mousedown', () => { state.dragging = true; });
canvas.addEventListener('mouseup',   () => { state.dragging = false; });
canvas.addEventListener('mouseleave',() => { state.dragging = false; });
canvas.addEventListener('mousemove', (e) => {
  if (state.pointerLocked) return; // pointer lock tiene prioridad si está activo
  if (!state.dragging || !state.gameRunning) return;
  state.cameraYaw   -= e.movementX * 0.002;
  state.cameraPitch -= e.movementY * 0.002;
  state.cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, state.cameraPitch));
});

// ── POINTER LOCK (mejora opcional — captura el cursor para FPS fluido) ──
canvas.addEventListener('click', () => {
  if (state.gameRunning) canvas.requestPointerLock?.(); // sin restricción de resolución
});
document.addEventListener('pointerlockchange', () => {
  state.pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!state.pointerLocked || !state.gameRunning) return;
  state.cameraYaw   -= e.movementX * 0.002;
  state.cameraPitch -= e.movementY * 0.002;
  state.cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, state.cameraPitch));
});
```

**NUNCA** pongas `requestPointerLock` condicionado a `window.innerWidth >= 1024` ni similar.

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
el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; });
el.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) dx > 0 ? onSwipeRight() : onSwipeLeft();
});

// Multi-touch (instrumentos, juegos)
const activos = new Map();
el.addEventListener('touchstart', e => { e.preventDefault(); [...e.changedTouches].forEach(t => activos.set(t.identifier, t)); });
el.addEventListener('touchend',   e => { [...e.changedTouches].forEach(t => activos.delete(t.identifier)); });
```

---

## RENDIMIENTO EN RASPBERRY PI 5

- Usa `requestAnimationFrame` para animaciones (NUNCA `setInterval` para render visual).
- Cachea referencias DOM: `const el = document.getElementById('x')` una sola vez, al inicio.
- Para Canvas: ajusta con `devicePixelRatio` para nitidez en pantallas HiDPI.
- Usa CSS transforms (`translate`, `scale`) en lugar de cambiar `top`/`left`.
- `backdrop-filter: blur()` es costoso: solo en elementos estáticos.
- Imágenes: usa SVG inline o Canvas. Evita `<img>` con URLs externas para UI crítica.
- Web Audio API: el `AudioContext` necesita un gesto del usuario para iniciar. Créalo en el primer click/touch.

---

## PATRONES PROBADOS EN EL SISTEMA

- **Canvas 2D** para gráficas de CPU, juegos, visualizaciones en tiempo real.
- **SVG inline** para iconos, relojes analógicos, gauges circulares.
- **Web Audio API** (`AudioContext`, `OscillatorNode`) para sonidos — funciona sin permisos extra.
- **Modales overlay** para configuración, game over, confirmaciones — `position: fixed; inset: 0`.
- **CSS Grid** para layouts de teclados, dashboards, grids de botones.

---

## CARGA Y DESCARGA DE ARCHIVOS

Las apps corren dentro de un **iframe con sandbox**. El sandbox incluye `allow-downloads` y `allow-popups`, por lo que tanto la descarga de archivos como la apertura de ventanas están permitidas. Sin embargo hay reglas importantes:

### Descarga de archivos generados en el navegador

Usa siempre el patrón `Blob` + `URL.createObjectURL` + `<a download>`. Nunca uses `window.location` ni `document.write` para descargas.

```javascript
function descargarArchivo(contenido, nombreArchivo, mimeType) {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Ejemplos de uso:
descargarArchivo('Hola mundo', 'nota.txt', 'text/plain;charset=utf-8');
descargarArchivo(jsonString, 'datos.json', 'application/json');
descargarArchivo(csvString, 'tabla.csv', 'text/csv;charset=utf-8');
```

> ⚠️ **Encoding**: usa siempre `charset=utf-8` en el MIME type para archivos de texto. Si generas un `Blob` con `new TextEncoder().encode(texto)` (Uint8Array), el resultado ya es UTF-8 correcto. Si lo generas desde un string directamente, añade `charset=utf-8` al tipo.

### NO intentes generar PDFs binarios desde cero

Generar un PDF válido con encoding correcto desde JavaScript puro es extremadamente complejo (el formato usa byte offsets exactos y encodings distintos a UTF-8). **Nunca escribas un generador de PDF manual.**

Si el usuario necesita PDF, la única alternativa fiable sin librería externa es:
```javascript
// Abrir el contenido HTML en ventana nueva y llamar print() → "Guardar como PDF"
function imprimirComoPdf(htmlContent, titulo) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    setTimeout(() => { win.focus(); win.print(); }, 800);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
```

### Lectura de archivos del usuario

```javascript
// Input file
const input = document.createElement('input');
input.type = 'file';
input.accept = '.txt,.json,.csv';
input.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const texto = await file.text();           // para texto
  const buffer = await file.arrayBuffer();   // para binarios (ZIP, imágenes...)
};
input.click();

// Drag & drop
zona.addEventListener('dragover', e => e.preventDefault());
zona.addEventListener('drop', async e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) procesarArchivo(file);
});
```

### Lectura de ZIPs con JSZip

Cuando necesites leer archivos ZIP (por ejemplo .docx, .xlsx, .apk, cualquier ZIP):

```javascript
// SIEMPRE usa JSZip del mirror — NO intentes parsear ZIP manualmente
// <script src="/api/sdk/libs/jszip.js"></script>

const zip = await JSZip.loadAsync(arrayBuffer);  // arrayBuffer de file.arrayBuffer()

// Leer un archivo concreto dentro del ZIP
const texto = await zip.file('ruta/dentro/del.zip').async('string');
const bytes = await zip.file('archivo.bin').async('uint8array');
const b64   = await zip.file('imagen.png').async('base64');

// Listar archivos
zip.forEach((rutaRelativa, archivo) => {
  if (!archivo.dir) console.log(rutaRelativa);
});

// Crear un ZIP nuevo y descargarlo
const zipNuevo = new JSZip();
zipNuevo.file('hola.txt', 'Hola mundo');
zipNuevo.file('datos.json', JSON.stringify({ x: 1 }));
const blob = await zipNuevo.generateAsync({ type: 'blob' });
descargarArchivo(blob, 'archivo.zip', 'application/zip');
```

---

## BUGS COMUNES A EVITAR — LISTA EXPLÍCITA

1. **NO** uses variables globales sueltas — todo en `state = {}`
2. **NO** crees un `setInterval` sin guardar su ID y limpiar el anterior
3. **NO** accedas a `element.property` sin verificar que `element !== null`
4. **NO** hagas `await` sin `try/catch` o `.catch()`
5. **NO** uses `innerHTML` con datos externos sin sanitizar (XSS)
6. **NO** inicies `AudioContext` fuera de un evento de usuario (el navegador lo bloqueará)
7. **NO** dejes `fetch()` sin timeout — puede quedar colgado indefinidamente
8. **NO** mezcles `async/await` con callbacks sin sincronizar el orden
9. **NO** olvides limpiar timers cuando el usuario navega fuera (`visibilitychange`)
10. **NO** uses `document.write()` ni `eval()` — bloquean el render y son inseguros
11. **NO** uses `ModevI.db.exec()` para SELECT — usa `query()` para consultas que devuelven filas
12. **NO** olvides `CREATE TABLE IF NOT EXISTS` en `init()` antes de insertar o consultar
13. **NO** añadas código de hardware (GPIO, I2C, cámara) si el usuario no lo pidió — puede fallar si no hay hardware conectado
14. **NO** cargues librerías desde CDNs externos — usa ÚNICAMENTE `/api/sdk/libs/{nombre}` del mirror local
15. **NO** elimines ni muevas el `<script src="/api/sdk/app/0/sdk.js">` del `<head>` — sin él `window.ModevI` es `undefined` y TODAS las llamadas al SDK fallan silenciosamente
16. **NO** reutilices el mismo nombre en `state` para dos propósitos distintos (ej: `state.keys` como Set de teclas pulsadas Y como contador numérico): usa nombres descriptivos únicos (`state.pressedKeys`, `state.collectedKeys`)
17. **NO** pongas `AmbientLight` con intensidad < 0.8 en escenas Three.js — la pantalla quedará negra; usa mínimo `new THREE.AmbientLight(0x404060, 1.0)` como base y añade luces direccionales/puntuales encima
18. **NO** generes PDFs binarios desde cero con un generador manual — el encoding falla con caracteres no-ASCII (tildes, ñ...) y el PDF queda vacío; usa el patrón `window.open` + `print()` descrito en la sección de archivos
19. **NO** parsees archivos ZIP manualmente — usa JSZip (`/api/sdk/libs/jszip.js`) que maneja correctamente todos los métodos de compresión y variantes del formato

---

## IDIOMA

Genera toda la interfaz en **español (es-ES)** salvo que el usuario indique otro idioma. Usa Unicode correcto (á, é, í, ó, ú, ñ, ¿, ¡).

---

## CHECKLIST MENTAL ANTES DE ESCRIBIR EL CÓDIGO

Antes de generar el HTML, verifica mentalmente:
- [ ] ¿Tengo el handler global `window.onerror` y el overlay de error?
- [ ] ¿Todo el estado está en un objeto `state = {}`?
- [ ] ¿Cada `setInterval`/`setTimeout`/`rAF` guarda su ID en `state` y limpia el anterior?
- [ ] ¿Cada `await` tiene `try/catch`?
- [ ] ¿Cada acceso al DOM usa null-check o optional chaining?
- [ ] ¿Los `fetch()` tienen timeout con `AbortController`?
- [ ] ¿La app funciona visualmente aunque fallen las llamadas de red?
- [ ] ¿El layout es responsive: se ve bien en 360px (móvil), 720px (Pi) y 1200px (desktop)?
- [ ] ¿Ningún elemento tiene ancho fijo en px que pueda desbordar en móvil?
- [ ] ¿Los botones tienen `min-height: 44px` para que sean cómodos al tacto en móvil y Pi?
- [ ] Si uso `ModevI.db`: ¿creo las tablas con `CREATE TABLE IF NOT EXISTS` en `init()` antes de usarlas?
- [ ] Si uso `ModevI.db.query()`: ¿destructuro `rows` del resultado, no el objeto entero?
- [ ] Si uso hardware: ¿envuelvo cada llamada en `try/catch` con fallback visual para cuando no hay hardware?
- [ ] ¿Todas las librerías externas vienen de `/api/sdk/libs/` y NO de CDNs externos?
- [ ] ¿El `<script src="/api/sdk/app/0/sdk.js">` está en el `<head>` y NO lo he eliminado? (la plataforma reemplaza el `0` por el id real al instalar — sin este tag `window.ModevI` es `undefined`)
- [ ] ¿Cada propiedad de `state` tiene un nombre único y descriptivo? ¿Ninguna se reutiliza para dos tipos de dato distintos (ej: Set vs número)?

---

## TEMPLATE BASE OBLIGATORIO

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Nombre de la App</title>
  <!-- SDK de ModevI — NO eliminar, es obligatorio para window.ModevI -->
  <script src="/api/sdk/app/0/sdk.js"></script>
  <style>
    :root {
      --bg-primary: #0f0f1a;
      --bg-secondary: #1a1a2e;
      --bg-card: #141428;
      --border: rgba(255,255,255,0.08);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      /* Tipografía fluida — se adapta sola */
      --fs-xl: clamp(20px, 4vw,   42px);
      --fs-lg: clamp(17px, 3vw,   28px);
      --fs-md: clamp(14px, 2vw,   18px);
      --fs-sm: clamp(12px, 1.5vw, 15px);
      --fs-xs: clamp(10px, 1.2vw, 13px);
      /* Espaciado fluido */
      --pad: clamp(12px, 4vw, 32px);
      --gap: clamp(8px,  2vw, 20px);
      --radius: clamp(8px, 1.5vw, 14px);
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      min-height: 100vh;
      background: var(--bg-primary);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: var(--fs-md);
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    /* Botones táctiles — 44px mínimo siempre */
    .btn {
      min-height: 44px;
      min-width: 44px;
      padding: clamp(8px, 1.5vw, 12px) clamp(14px, 3vw, 24px);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text);
      font-size: var(--fs-md);
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .btn:active { transform: scale(0.93); filter: brightness(1.3); }

    /* ── RESPONSIVE BREAKPOINTS ── */

    /* Base (< 640px): móvil — layout de 1 columna, compacto */

    /* Pi 720px y tablets (640px – 1023px) */
    @media (min-width: 640px) {
      /* 2 columnas, paneles algo más anchos */
    }

    /* Desktop (≥ 1024px): layouts más complejos, sidebars */
    @media (min-width: 1024px) {
      .btn { min-height: 40px; }
      /* sidebars, 3-4 columnas, etc. */
    }

    /* Estilos específicos de la app aquí */
  </style>
</head>
<body>
  <!-- HTML de la app aquí -->

  <!-- Overlay de error — no eliminar -->
  <div id="__error_overlay__" style="
    display:none; position:fixed; bottom:0; left:0; right:0;
    background:#7f1d1d; color:#fecaca; padding:8px 12px;
    font-size:12px; font-family:monospace; z-index:9999;
    border-top:1px solid #ef4444;
  "></div>

  <script>
    'use strict';

    // ── Error handlers globales ──────────────────────────────────────────
    window.onerror = function(msg, src, line, col, err) {
      const o = document.getElementById('__error_overlay__');
      if (o) { o.textContent = '⚠ ' + msg + (line ? ' (l.' + line + ')' : ''); o.style.display = 'block'; }
      return true;
    };
    window.onunhandledrejection = function(e) {
      const o = document.getElementById('__error_overlay__');
      if (o) { o.textContent = '⚠ ' + (e.reason?.message || String(e.reason)); o.style.display = 'block'; }
    };

    // ── Estado centralizado ──────────────────────────────────────────────
    const state = {
      // IDs de timers (obligatorio guardarlos aquí)
      intervaloId: null,
      animFrameId: null,
      // Estado de la app
    };

    // ── Helpers SDK ──────────────────────────────────────────────────────
    async function guardar(key, val) {
      const v = typeof val === 'string' ? val : JSON.stringify(val);
      try { await window.ModevI?.db?.set(key, v); } catch(e) {}
      try { localStorage.setItem(key, v); } catch(e) {}
    }
    async function cargar(key) {
      try { const v = await window.ModevI?.db?.get(key); if (v !== null) return v; } catch(e) {}
      return localStorage.getItem(key);
    }

    // ── Fetch con timeout ────────────────────────────────────────────────
    async function fetchData(url, ms = 8000) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch(err) {
        clearTimeout(t);
        if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
        throw err;
      }
    }

    // ── Inicialización ───────────────────────────────────────────────────
    async function init() {
      try {
        // Si la app necesita persistencia SQL, crear tablas aquí (idempotente):
        // await window.ModevI?.db?.exec(
        //   "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, ts INTEGER)"
        // );

        // Lógica principal aquí
      } catch(err) {
        mostrarEstado('Error al iniciar: ' + err.message);
      }
    }

    function mostrarEstado(msg) {
      const el = document.getElementById('__status__');
      if (el) el.textContent = msg;
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


ALLOWED_MODELS = {
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
}

HAIKU_SYSTEM_PROMPT = """\
Eres un desarrollador web creando aplicaciones para ModevI — apps HTML únicas que corren en un iframe táctil.

## REGLAS DE SALIDA — ABSOLUTAMENTE CRÍTICAS

1. Genera ÚNICAMENTE el archivo HTML completo. Sin markdown, sin code fences, sin texto antes ni después.
2. Empieza EXACTAMENTE con `<!DOCTYPE html>` y termina EXACTAMENTE con `</html>`.
3. TODO el CSS en `<style>`, todo el JS en `<script>`. Archivo único autocontenido.
4. **PROHIBIDO** cargar nada de CDNs externos (no Tailwind, no Bootstrap, no Google Fonts, nada).
5. Librerías permitidas ÚNICAMENTE desde el mirror local: `<script src="/api/sdk/libs/chart.js"></script>`, `three.js`, `alpine.js`, `anime.js`, `matter.js`, `tone.js`, `marked.js`, `jszip.js`.

## REGLA CRÍTICA: APIs EXTERNAS

**NUNCA uses APIs que requieran API key** (no OpenWeatherMap, no NewsAPI, no OpenAI, no nada con `apiKey`).
Si necesitas datos externos, usa SOLO estas APIs gratuitas sin key:

| Tipo | URL |
|------|-----|
| Clima | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true` |
| Geolocalización | `https://ipapi.co/json/` |
| Divisas | `https://open.er-api.com/v6/latest/EUR` |
| Hora mundial | `https://worldtimeapi.org/api/ip` |
| IP pública | `https://api.ipify.org?format=json` |
| Chiste | `https://official-joke-api.appspot.com/jokes/random` |

Si el usuario pide noticias/feeds, usa RSS vía `https://api.rss2json.com/v1/api.json?rss_url={url}` (sin key).

## SDK OBLIGATORIO

Incluye SIEMPRE este tag en `<head>` — sin él `window.ModevI` es undefined:
```html
<script src="/api/sdk/app/0/sdk.js"></script>
```

Guardar datos: `await window.ModevI.data.set('clave', 'valor')` / `.get('clave')` → `{value}|null`
Base de datos: `await window.ModevI.db.exec(sql, params)` / `.query(sql, params)` → `rows[]`

## DISEÑO

- Fondo oscuro obligatorio: `background: #0f0f1a`
- Responsive: usa `%`, `vw`, `flex`, `grid`. Nunca anchos fijos en px para contenedores.
- Botones táctiles: `min-height: 44px`
- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`

## ROBUSTEZ MÍNIMA OBLIGATORIA

```javascript
// Error handler — siempre al inicio del script
window.onerror = (msg, src, line) => {
  const el = document.getElementById('__err__');
  if (el) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
  return true;
};

// Fetch con timeout — usa SIEMPRE este patrón para APIs externas
async function fetchData(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch(e) { clearTimeout(t); throw e; }
}
```

Incluye siempre este overlay antes de `</body>`:
```html
<div id="__err__" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#7f1d1d;color:#fecaca;padding:8px;font-size:12px;font-family:monospace;z-index:9999"></div>
```

## ESTADO Y TIMERS

```javascript
const state = { /* todo el estado aquí, nunca variables globales sueltas */ };
// setInterval: guarda siempre el ID
if (state.timer) clearInterval(state.timer);
state.timer = setInterval(fn, 5000);
```

## IDIOMA

Interfaz en español (es-ES). Usa tildes y ñ correctamente.

## TEMPLATE BASE

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Nombre App</title>
  <script src="/api/sdk/app/0/sdk.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0f0f1a; color:#e2e8f0; font-family:system-ui,sans-serif; min-height:100vh; }
  </style>
</head>
<body>
  <!-- contenido -->
  <div id="__err__" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#7f1d1d;color:#fecaca;padding:8px;font-size:12px;font-family:monospace;z-index:9999"></div>
  <script>
    window.onerror = (msg) => { const e=document.getElementById('__err__'); if(e){e.textContent='⚠ '+msg;e.style.display='block';} return true; };
    const state = {};
    async function init() { /* inicialización */ }
    init();
  </script>
</body>
</html>
```
"""

SYSTEM_PROMPTS = {
    "claude-haiku-4-5-20251001": HAIKU_SYSTEM_PROMPT,
}

async def _stream(
    description: str,
    name: str,
    category_id: int | None,
    user: User,
    db: Session,
    device_db: Session,
    model: str = "claude-sonnet-4-6",
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
        system_prompt = SYSTEM_PROMPTS.get(model, SYSTEM_PROMPT)
        async with client.messages.stream(
            model=model,
            max_tokens=32768,
            system=system_prompt,
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
    # ------------------------------------------------------------------ #
    # Generate app description with Haiku (fast + cheap)                  #
    # ------------------------------------------------------------------ #
    yield evt({"type": "status", "step": "describing", "message": "Generando descripción..."})

    app_description = description[:500]  # fallback: user prompt truncated
    try:
        desc_response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
            messages=[{
                "role": "user",
                "content": (
                    f"Escribe una descripción en español de máximo 2 frases (80 palabras máximo) "
                    f"para una app llamada «{name}» que se puede instalar en una Raspberry Pi. "
                    f"Describe qué hace la app de forma atractiva para el usuario final. "
                    f"Solo responde con la descripción, sin comillas ni prefijos.\n\n"
                    f"La app fue creada con este prompt: {description[:300]}"
                ),
            }],
        )
        generated_desc = desc_response.content[0].text.strip()
        if generated_desc:
            app_description = generated_desc[:500]
    except Exception:
        pass  # fallback to user prompt

    yield evt({"type": "status", "step": "packaging", "message": "Empaquetando en ZIP..."})

    manifest = {
        "name": name,
        "version": "1.0.0",
        "description": app_description,
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
        description=app_description,
        long_description=app_description,
        ai_prompt=description,
        version="1.0.0",
        permissions=[],
        required_hardware=[],
        status="published",  # AI-generated apps go live immediately
    )
    db.add(store_app)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        slug = f"{slug}-{os.urandom(3).hex()}"
        store_app.slug = slug
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

    # Fix SDK script src: replace placeholder id=0 with the real installed id
    index_html = install_path / "index.html"
    if index_html.exists():
        html_content = index_html.read_text(encoding="utf-8")
        sdk_tag = f'<script src="/api/sdk/app/{installed.id}/sdk.js"></script>'
        # Replace placeholder tag (id=0) if present, otherwise inject before </head>
        if '/api/sdk/app/0/sdk.js' in html_content:
            html_content = html_content.replace(
                '<script src="/api/sdk/app/0/sdk.js"></script>', sdk_tag, 1
            )
        elif sdk_tag not in html_content:
            inject_before = "</head>" if "</head>" in html_content else "</body>"
            html_content = html_content.replace(inject_before, f"  {sdk_tag}\n{inject_before}", 1)
        index_html.write_text(html_content, encoding="utf-8")

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
    model: str = Query(default="claude-sonnet-4-6", description="Modelo Claude a usar"),
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

    if model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo no permitido. Usa uno de: {', '.join(ALLOWED_MODELS)}")

    return StreamingResponse(
        _stream(description, name, category_id, user, db, device_db, model=model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Suggest guided questions
# ---------------------------------------------------------------------------


class SuggestQuestionsIn(BaseModel):
    name: str
    description: str = ""


@router.post("/suggest-questions")
async def suggest_questions(
    body: SuggestQuestionsIn,
    current_user: User = Depends(get_current_user),
):
    """
    Ask Haiku to generate 3-4 clarifying questions to help the user
    describe their app idea more precisely before generation.
    """
    if current_user.role not in ("developer", "admin"):
        raise HTTPException(status_code=403, detail="Se requiere rol developer o admin")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    context = f"Nombre de la app: «{body.name}»"
    if body.description.strip():
        context += f"\nIdea inicial: {body.description[:300]}"

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": (
                    f"{context}\n\n"
                    "Eres un asistente que ayuda a personas sin conocimientos técnicos a describir una app.\n"
                    "Genera exactamente 3 preguntas en lenguaje cotidiano y sencillo (sin jerga técnica) "
                    "que ayuden al usuario a concretar su idea. "
                    "Para cada pregunta genera 3 opciones de respuesta cortas, concretas y variadas, "
                    "adaptadas específicamente al tipo de app descrita.\n\n"
                    "Responde ÚNICAMENTE con JSON válido, sin texto adicional:\n"
                    '[{"id":"q1","text":"Pregunta 1","options":["Op A","Op B","Op C"]},'
                    '{"id":"q2","text":"Pregunta 2","options":["Op A","Op B","Op C"]},'
                    '{"id":"q3","text":"Pregunta 3","options":["Op A","Op B","Op C"]}]'
                ),
            }],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        questions = json.loads(raw)
        if not isinstance(questions, list) or not all("options" in q for q in questions):
            raise ValueError("invalid format")
    except Exception:
        questions = [
            {"id": "q1", "text": "¿Para qué lo usarías principalmente?",
             "options": ["Para uso personal del día a día", "Para compartir con otras personas", "Como entretenimiento o juego"]},
            {"id": "q2", "text": "¿Debe recordar lo que haces entre sesiones?",
             "options": ["Sí, quiero que guarde todo", "Solo lo más importante", "No hace falta, cada vez empieza de cero"]},
            {"id": "q3", "text": "¿Qué aspecto visual prefieres?",
             "options": ["Sencillo y limpio, fácil de leer", "Colorido y llamativo", "Parecido a una app profesional"]},
        ]

    return {"questions": questions}


# ---------------------------------------------------------------------------
# Debug / improve an existing AI-generated app
# ---------------------------------------------------------------------------


async def _stream_debug(
    installed_id: int,
    feedback: str,
    user: User,
    device_db: Session,
    db: Session,
    model: str = "claude-sonnet-4-6",
) -> AsyncGenerator[str, None]:
    """Stream an improved version of an existing installed app."""

    def evt(data: dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    # Load installed app
    installed = device_db.query(InstalledApp).filter(InstalledApp.id == installed_id).first()
    if not installed:
        yield evt({"type": "error", "message": f"App instalada #{installed_id} no encontrada."})
        return

    install_path = Path(installed.install_path) if installed.install_path else INSTALLED_DIR / str(installed_id)
    index_html = install_path / "index.html"
    if not index_html.exists():
        yield evt({"type": "error", "message": "No se encontró el archivo index.html de la app. ¿Estás conectado a la Pi?"})
        return

    original_html = index_html.read_text(encoding="utf-8")

    # Get app name from StoreApp
    store_app = db.query(StoreApp).filter(StoreApp.id == installed.store_app_id).first()
    app_name = store_app.name if store_app else f"App #{installed_id}"

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        yield evt({"type": "error", "message": "ANTHROPIC_API_KEY no está configurada en el servidor."})
        return

    yield evt({"type": "status", "step": "connecting", "message": "Conectando con Claude..."})

    client = anthropic.AsyncAnthropic(api_key=api_key)
    new_html = ""

    yield evt({"type": "status", "step": "generating", "message": "Generando versión mejorada..."})

    try:
        system_prompt = SYSTEM_PROMPTS.get(model, SYSTEM_PROMPT)
        async with client.messages.stream(
            model=model,
            max_tokens=32768,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": (
                    f"Aquí está el código HTML completo de una app ModevI llamada «{app_name}»:\n\n"
                    f"{original_html}\n\n"
                    f"---\n\n"
                    f"El usuario quiere mejorarla con el siguiente feedback:\n{feedback}\n\n"
                    f"Genera una versión mejorada y completa del HTML. "
                    f"Mantén todo lo que funciona bien. Aplica los cambios pedidos con precisión."
                ),
            }],
        ) as stream:
            async for text in stream.text_stream:
                new_html += text
                yield evt({"type": "code_chunk", "text": text})

    except anthropic.APIError as e:
        yield evt({"type": "error", "message": f"Error de la API de IA: {e}"})
        return
    except Exception as e:
        yield evt({"type": "error", "message": f"Error inesperado: {e}"})
        return

    # Strip markdown fences
    if "```html" in new_html:
        new_html = new_html.split("```html", 1)[1].split("```", 1)[0].strip()
    elif "```" in new_html:
        new_html = new_html.split("```", 1)[1].split("```", 1)[0].strip()

    if not new_html.strip().upper().startswith("<!"):
        yield evt({"type": "error", "message": "La IA no devolvió un HTML válido."})
        return

    if not new_html.strip().upper().endswith("</HTML>"):
        yield evt({"type": "error", "message": "El código generado quedó incompleto. Inténtalo de nuevo."})
        return

    yield evt({"type": "status", "step": "packaging", "message": "Actualizando archivos..."})

    # Fix SDK src placeholder
    sdk_tag = f'<script src="/api/sdk/app/{installed_id}/sdk.js"></script>'
    if '/api/sdk/app/0/sdk.js' in new_html:
        new_html = new_html.replace('<script src="/api/sdk/app/0/sdk.js"></script>', sdk_tag, 1)
    elif sdk_tag not in new_html:
        inject_before = "</head>" if "</head>" in new_html else "</body>"
        new_html = new_html.replace(inject_before, f"  {sdk_tag}\n{inject_before}", 1)

    # Write updated HTML to disk
    index_html.write_text(new_html, encoding="utf-8")

    # Improvement is local-only — the user can publish as a new app from the UI

    device_db.add(ActivityLog(
        installed_app_id=installed_id,
        action="update",
        details=f"App mejorada con IA. Feedback: {feedback[:200]}",
    ))
    device_db.commit()

    yield evt({
        "type": "done",
        "app_id": store_app.id if store_app else None,
        "app_slug": store_app.slug if store_app else None,
        "installed_id": installed_id,
        "message": f"¡App «{app_name}» actualizada con éxito!",
    })


class PublishImprovedIn(BaseModel):
    installed_id: int
    name: str
    description: str
    category_id: int | None = None


@router.post("/publish-improved")
async def publish_improved_app(
    body: PublishImprovedIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_platform_db),
    device_db: Session = Depends(get_device_db),
):
    """
    Publish an improved installed app as a new Store entry.
    Reads the current index.html, packages it, uploads to R2, and registers in MySQL.
    """
    if user.role not in ("developer", "admin"):
        raise HTTPException(status_code=403, detail="Se requiere rol developer o admin")

    installed = device_db.query(InstalledApp).filter(InstalledApp.id == body.installed_id).first()
    if not installed:
        raise HTTPException(status_code=404, detail=f"App instalada #{body.installed_id} no encontrada.")

    install_path = Path(installed.install_path) if installed.install_path else INSTALLED_DIR / str(installed.id)
    index_html = install_path / "index.html"
    if not index_html.exists():
        raise HTTPException(status_code=404, detail="No se encontró el archivo index.html de la app.")

    html_code = index_html.read_text(encoding="utf-8")

    manifest = {
        "name": body.name,
        "version": "1.0.0",
        "description": body.description,
        "entry_point": "index.html",
        "required_hardware": [],
        "permissions": [],
    }

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("index.html", html_code)
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
    zip_bytes = zip_buf.getvalue()

    base_slug = _slugify(body.name) or "ai-app"
    slug = base_slug
    counter = 1
    while db.query(StoreApp).filter(StoreApp.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    store_app = StoreApp(
        developer_id=user.id,
        category_id=body.category_id,
        name=body.name,
        slug=slug,
        description=body.description,
        long_description=body.description,
        version="1.0.0",
        permissions=[],
        required_hardware=[],
        status="published",
    )
    db.add(store_app)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        slug = f"{slug}-{os.urandom(3).hex()}"
        store_app.slug = slug
        db.add(store_app)
        db.commit()
    db.refresh(store_app)

    package_url = r2.upload(
        key=f"packages/{store_app.id}/app.zip",
        data=zip_bytes,
        content_type="application/zip",
    )
    store_app.package_url = package_url
    db.commit()

    return {
        "app_id": store_app.id,
        "slug": store_app.slug,
        "message": f"App «{body.name}» publicada en la tienda.",
    }


@router.get("/debug-app")
async def debug_app_with_ai(
    installed_id: int = Query(..., description="ID de la app instalada a mejorar"),
    feedback: str = Query(..., min_length=5, description="Feedback del usuario"),
    model: str = Query(default="claude-sonnet-4-6", description="Modelo Claude a usar"),
    token: str = Query(..., description="JWT access token"),
    db: Session = Depends(get_platform_db),
    device_db: Session = Depends(get_device_db),
):
    """
    Stream an improved version of an installed app based on user feedback.
    Uses JWT via query param (EventSource limitation).
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

    if model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo no permitido. Usa uno de: {', '.join(ALLOWED_MODELS)}")

    return StreamingResponse(
        _stream_debug(installed_id, feedback, user, device_db, db, model=model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
